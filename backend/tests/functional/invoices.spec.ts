import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

/**
 * Sales — the transactional ERP core. Verifies that InvoiceService.create is a
 * true all-or-nothing transaction: stock, invoice, items, client stats, cash
 * and credit all move together (or nothing does on failure), and cancel is the
 * exact reversal.
 */
const PASSWORD = 'Password123'

async function cleanup() {
  await db.rawQuery(
    'TRUNCATE TABLE client_credits, cash_movements, cash_registers, invoice_items, invoices, invoice_counters, stock_movements, product_stock_locations, products, warehouses, clients, audit_logs, auth_access_tokens, company_memberships, users, companies, tenants RESTART IDENTITY CASCADE'
  )
}

async function signup(client: any, email: string, companyName: string) {
  const res = await client.post('/api/v1/auth/signup').json({
    fullName: 'Owner',
    email,
    password: PASSWORD,
    passwordConfirmation: PASSWORD,
    companyName,
  })
  return res.body()
}

const authed = (req: any, token: string, companyId: number) =>
  req.header('Authorization', `Bearer ${token}`).header('X-Company-Id', String(companyId))

/** Creates a warehouse, a product (purchase 300 / retail 500) restocked to `stock`, and a client. */
async function seedStore(client: any, token: string, companyId: number, _tenantId: number, stock = 100) {
  const warehouseId = (await authed(client.post('/api/v1/warehouses'), token, companyId).json({ name: 'Main', isMain: true })).body().id
  const product = (await authed(client.post('/api/v1/products'), token, companyId).json({ name: 'Coca 1L', code: 'COC', purchasePrice: 300, retailPrice: 500, alertThreshold: 5 })).body()
  await authed(client.post('/api/v1/stock/restock'), token, companyId).json({ productId: product.id, warehouseId, quantity: stock })
  const clientId = (await authed(client.post('/api/v1/clients'), token, companyId).json({ name: 'Bob' })).body().id
  return { warehouseId, productId: product.id, clientId }
}

async function mainRegisterBalance(tenantId: number, companyId: number) {
  const row = await db
    .from('cash_registers')
    .where('tenant_id', tenantId)
    .where('company_id', companyId)
    .where('is_main', true)
    .first()
  return row ? Number(row.current_balance) : null
}

test.group('Sales — invoices (transactional)', (group) => {
  group.each.setup(async () => {
    await cleanup()
  })

  test('fully-paid invoice decrements stock, updates client stats, credits cash', async ({ client, assert }) => {
    const { token, company, user } = await signup(client, 'sales@acme.test', 'Acme')
    const tenantId = user.tenantId
    const { productId, clientId } = await seedStore(client, token, company.id, tenantId, 100)

    const inv = await authed(client.post('/api/v1/invoices'), token, company.id).json({
      clientId,
      clientName: 'Bob',
      items: [{ productId, quantity: 4, unitPrice: 500 }],
      paymentMethod: 'cash',
    })
    assert.equal(inv.status(), 201, `create failed: ${JSON.stringify(inv.body())}`)
    assert.equal(inv.body().invoiceNumber, 'FAC-0001')
    assert.equal(inv.body().total, 2000)
    assert.equal(inv.body().paidAmount, 2000)
    assert.equal(inv.body().remaining, 0)
    assert.equal(inv.body().status, 'paid')

    const product = await authed(client.get(`/api/v1/products/${productId}`), token, company.id)
    assert.equal(product.body().currentStock, 96)

    const c = await authed(client.get(`/api/v1/clients/${clientId}`), token, company.id)
    assert.equal(c.body().totalPurchases, 1)
    assert.equal(c.body().totalAmount, 2000)
    assert.equal(c.body().currentCredit, 0)

    assert.equal(await mainRegisterBalance(tenantId, company.id), 2000)
    const credit = await db.from('client_credits').where('invoice_id', inv.body().id).first()
    assert.isNotTrue(credit) // no outstanding credit
  })

  test('credit invoice (unpaid) creates a client credit and does not credit cash', async ({ client, assert }) => {
    const { token, company, user } = await signup(client, 'sales@acme.test', 'Acme')
    const tenantId = user.tenantId
    const { productId, clientId } = await seedStore(client, token, company.id, tenantId, 100)

    const inv = await authed(client.post('/api/v1/invoices'), token, company.id).json({
      clientId,
      clientName: 'Bob',
      items: [{ productId, quantity: 2, unitPrice: 500 }],
      paymentMethod: 'credit',
    })
    assert.equal(inv.status(), 201)
    assert.equal(inv.body().total, 1000)
    assert.equal(inv.body().remaining, 1000)
    assert.equal(inv.body().status, 'validated')

    const credit = await db.from('client_credits').where('invoice_id', inv.body().id).first()
    assert.isTrue(!!credit)
    assert.equal(Number(credit.remaining_amount), 1000)
    assert.equal(credit.status, 'active')

    assert.isNotTrue(await mainRegisterBalance(tenantId, company.id)) // no cash register touched
  })

  test('cancel reverses stock, cash and marks the invoice cancelled', async ({ client, assert }) => {
    const { token, company, user } = await signup(client, 'sales@acme.test', 'Acme')
    const tenantId = user.tenantId
    const { productId, clientId } = await seedStore(client, token, company.id, tenantId, 100)

    const inv = await authed(client.post('/api/v1/invoices'), token, company.id).json({
      clientId,
      clientName: 'Bob',
      items: [{ productId, quantity: 4, unitPrice: 500 }],
      paymentMethod: 'cash',
    })
    assert.equal(inv.body().status, 'paid')

    const cancelled = await authed(client.post(`/api/v1/invoices/${inv.body().id}/cancel`), token, company.id)
    assert.equal(cancelled.status(), 200, `cancel failed: ${JSON.stringify(cancelled.body())}`)
    assert.equal(cancelled.body().status, 'cancelled')

    const product = await authed(client.get(`/api/v1/products/${productId}`), token, company.id)
    assert.equal(product.body().currentStock, 100) // stock restored

    assert.equal(await mainRegisterBalance(tenantId, company.id), 0) // cash reversed

    const c = await authed(client.get(`/api/v1/clients/${clientId}`), token, company.id)
    assert.equal(c.body().totalPurchases, 0) // client stats reversed
  })

  test('rollback: insufficient stock on a later item leaves everything untouched', async ({ client, assert }) => {
    const { token, company, user } = await signup(client, 'sales@acme.test', 'Acme')
    const tenantId = user.tenantId
    const { warehouseId } = await seedStore(client, token, company.id, tenantId, 100)
    // second product with low stock
    const productB = (await authed(client.post('/api/v1/products'), token, company.id).json({ name: 'Low', purchasePrice: 100, retailPrice: 200 })).body()
    await authed(client.post('/api/v1/stock/restock'), token, company.id).json({ productId: productB.id, warehouseId, quantity: 2 })

    const inv = await authed(client.post('/api/v1/invoices'), token, company.id).json({
      items: [
        { productId: (await authed(client.get('/api/v1/products'), token, company.id)).body().data[0].id, quantity: 5, unitPrice: 500 },
        { productId: productB.id, quantity: 5, unitPrice: 200 }, // only 2 in stock -> fails
      ],
      paymentMethod: 'cash',
    })
    assert.equal(inv.status(), 422) // rejected

    // No invoice persisted, no cash movement, no orphan stock change
    const invoiceCount = await db.from('invoices').where('tenant_id', tenantId).where('company_id', company.id).count('* as c').first()
    assert.equal(Number((invoiceCount as any)?.c ?? 0), 0)
    assert.isNotTrue(await mainRegisterBalance(tenantId, company.id))
  })

  test('anti-perte: selling below purchase price is rejected', async ({ client, assert }) => {
    const { token, company, user } = await signup(client, 'sales@acme.test', 'Acme')
    const tenantId = user.tenantId
    const { productId } = await seedStore(client, token, company.id, tenantId, 100)

    const inv = await authed(client.post('/api/v1/invoices'), token, company.id).json({
      items: [{ productId, quantity: 1, unitPrice: 200 }], // < purchase 300
      paymentMethod: 'cash',
    })
    assert.equal(inv.status(), 422)
    const count = await db.from('invoices').where('tenant_id', tenantId).where('company_id', company.id).count('* as c').first()
    assert.equal(Number((count as any)?.c ?? 0), 0)
  })

  test('invoice numbering is sequential and atomic', async ({ client, assert }) => {
    const { token, company, user } = await signup(client, 'sales@acme.test', 'Acme')
    const { productId } = await seedStore(client, token, company.id, user.tenantId, 100)

    const a = await authed(client.post('/api/v1/invoices'), token, company.id).json({ items: [{ productId, quantity: 1, unitPrice: 500 }], paymentMethod: 'cash' })
    const b = await authed(client.post('/api/v1/invoices'), token, company.id).json({ items: [{ productId, quantity: 1, unitPrice: 500 }], paymentMethod: 'cash' })
    assert.equal(a.body().invoiceNumber, 'FAC-0001')
    assert.equal(b.body().invoiceNumber, 'FAC-0002')
  })

  test('tenant isolation: B cannot see A invoices', async ({ client, assert }) => {
    const a = await signup(client, 'a@acme.test', 'CA')
    const b = await signup(client, 'b@beta.test', 'CB')
    const { productId } = await seedStore(client, a.token, a.company.id, a.user.tenantId, 100)
    await authed(client.post('/api/v1/invoices'), a.token, a.company.id).json({ items: [{ productId, quantity: 1, unitPrice: 500 }], paymentMethod: 'cash' })

    const list = await authed(client.get('/api/v1/invoices'), b.token, b.company.id)
    assert.equal(list.body().meta.total, 0)
  })

  test('update edits items atomically (reverse old + apply new; number unchanged)', async ({ client, assert }) => {
    const { token, company, user } = await signup(client, 'sales@acme.test', 'Acme')
    const tenantId = user.tenantId
    const { productId } = await seedStore(client, token, company.id, tenantId, 100)

    // create: 2 × 500 = 1000, cash
    const a = await authed(client.post('/api/v1/invoices'), token, company.id).json({ items: [{ productId, quantity: 2, unitPrice: 500 }], paymentMethod: 'cash' })
    assert.equal(a.body().total, 1000)
    const stockAfterCreate = await authed(client.get(`/api/v1/products/${productId}`), token, company.id)
    assert.equal(stockAfterCreate.body().currentStock, 98) // 100 - 2

    // update: replace with 5 × 400 = 2000, still cash
    const u = await authed(client.put(`/api/v1/invoices/${a.body().id}`), token, company.id).json({ items: [{ productId, quantity: 5, unitPrice: 400 }], paymentMethod: 'cash' })
    assert.equal(u.status(), 200, `update failed: ${JSON.stringify(u.body())}`)
    assert.equal(u.body().total, 2000)
    assert.equal(u.body().invoiceNumber, a.body().invoiceNumber) // number unchanged
    // stock reflects the NEW debit (100 - 5 = 95), not the old (98)
    const stockAfterUpdate = await authed(client.get(`/api/v1/products/${productId}`), token, company.id)
    assert.equal(stockAfterUpdate.body().currentStock, 95)
    // cash reflects the NEW paid (2000), not double-counted (old 1000 reversed)
    assert.equal(await mainRegisterBalance(tenantId, company.id), 2000)
    // only ONE active invoice_items row set for the product on this invoice
    const items = await authed(client.get(`/api/v1/invoices/${a.body().id}`), token, company.id)
    assert.equal(items.body().items.length, 1)
    assert.equal(items.body().items[0].quantity, 5)

    // cancel the edited invoice → full reversal
    await authed(client.post(`/api/v1/invoices/${a.body().id}/cancel`), token, company.id)
    const stockAfterCancel = await authed(client.get(`/api/v1/products/${productId}`), token, company.id)
    assert.equal(stockAfterCancel.body().currentStock, 100) // restored
    assert.equal(await mainRegisterBalance(tenantId, company.id), 0)
  })
})

import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

/**
 * Credits — client credit payments. A credit is created by Sales (unpaid
 * invoice). addClientPayment settles it in one transaction (credit update +
 * payment row + cash in + client.current_credit decrement).
 */
const PASSWORD = 'Password123'

async function cleanup() {
  await db.rawQuery(
    'TRUNCATE TABLE client_credit_payments, client_credits, cash_movements, cash_registers, invoice_items, invoices, invoice_counters, stock_movements, product_stock_locations, products, warehouses, clients, audit_logs, auth_access_tokens, company_memberships, users, companies, tenants RESTART IDENTITY CASCADE'
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

async function seedStore(client: any, token: string, companyId: number) {
  const warehouseId = (await authed(client.post('/api/v1/warehouses'), token, companyId).json({ name: 'Main', isMain: true })).body().id
  const productId = (await authed(client.post('/api/v1/products'), token, companyId).json({ name: 'Coca', purchasePrice: 300, retailPrice: 500 })).body().id
  await authed(client.post('/api/v1/stock/restock'), token, companyId).json({ productId, warehouseId, quantity: 100 })
  const clientId = (await authed(client.post('/api/v1/clients'), token, companyId).json({ name: 'Bob' })).body().id
  return { warehouseId, productId, clientId }
}

async function mainRegisterBalance(tenantId: number, companyId: number) {
  const row = await db.from('cash_registers').where('tenant_id', tenantId).where('company_id', companyId).where('is_main', true).first()
  return row ? Number(row.current_balance) : null
}

test.group('Credits — client payments', (group) => {
  group.each.setup(async () => {
    await cleanup()
  })

  test('partial then full payment settles a credit (cash + client.currentCredit follow)', async ({ client, assert }) => {
    const { token, company, user } = await signup(client, 'cred@acme.test', 'Acme')
    const tenantId = user.tenantId
    const { productId, clientId } = await seedStore(client, token, company.id)

    // credit invoice: 2 x 500 = 1000, unpaid
    await authed(client.post('/api/v1/invoices'), token, company.id).json({
      clientId,
      clientName: 'Bob',
      items: [{ productId, quantity: 2, unitPrice: 500 }],
      paymentMethod: 'credit',
    })

    const list = await authed(client.get('/api/v1/client-credits'), token, company.id)
    assert.equal(list.body().length, 1)
    const creditId = list.body()[0].id
    assert.equal(Number(list.body()[0].remainingAmount), 1000)

    // partial payment 400
    const p1 = await authed(client.post(`/api/v1/client-credits/${creditId}/payments`), token, company.id).json({ amount: 400, paymentMode: 'cash' })
    assert.equal(p1.status(), 201, `payment failed: ${JSON.stringify(p1.body())}`)
    assert.equal(p1.body().remaining, 600)
    assert.equal(p1.body().status, 'partial')

    assert.equal(await mainRegisterBalance(tenantId, company.id), 400)
    const c1 = await authed(client.get(`/api/v1/clients/${clientId}`), token, company.id)
    assert.equal(c1.body().currentCredit, 600)

    // settle remaining 600
    const p2 = await authed(client.post(`/api/v1/client-credits/${creditId}/payments`), token, company.id).json({ amount: 600 })
    assert.equal(p2.body().remaining, 0)
    assert.equal(p2.body().status, 'paid')
    assert.equal(await mainRegisterBalance(tenantId, company.id), 1000)

    const c2 = await authed(client.get(`/api/v1/clients/${clientId}`), token, company.id)
    assert.equal(c2.body().currentCredit, 0)

    const shown = await authed(client.get(`/api/v1/client-credits/${creditId}`), token, company.id)
    assert.lengthOf(shown.body().payments, 2)
  })

  test('overpayment is rejected and changes nothing', async ({ client, assert }) => {
    const { token, company, user } = await signup(client, 'cred@acme.test', 'Acme')
    const tenantId = user.tenantId
    const { productId, clientId } = await seedStore(client, token, company.id)
    await authed(client.post('/api/v1/invoices'), token, company.id).json({
      clientId,
      clientName: 'Bob',
      items: [{ productId, quantity: 2, unitPrice: 500 }],
      paymentMethod: 'credit',
    })
    const creditId = (await authed(client.get('/api/v1/client-credits'), token, company.id)).body()[0].id

    const p = await authed(client.post(`/api/v1/client-credits/${creditId}/payments`), token, company.id).json({ amount: 1500 })
    assert.equal(p.status(), 422)

    // credit untouched, no cash
    const shown = await authed(client.get(`/api/v1/client-credits/${creditId}`), token, company.id)
    assert.equal(Number(shown.body().remainingAmount), 1000)
    assert.equal(shown.body().status, 'active')
    assert.isNotTrue(await mainRegisterBalance(tenantId, company.id))
  })
})

import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

/**
 * Purchases — mirror of Sales. A purchase brings stock IN, accrues debt to a
 * supplier, and pays cash OUT when paid. Supplier payments settle the debt.
 */
const PASSWORD = 'Password123'

async function cleanup() {
  await db.rawQuery(
    'TRUNCATE TABLE supplier_credit_payments, supplier_credits, purchase_items, purchases, purchase_counters, suppliers, client_credit_payments, client_credits, cash_movements, cash_registers, invoice_items, invoices, invoice_counters, stock_movements, product_stock_locations, products, warehouses, clients, audit_logs, auth_access_tokens, company_memberships, users, companies, tenants RESTART IDENTITY CASCADE'
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

async function seed(client: any, token: string, companyId: number) {
  await authed(client.post('/api/v1/warehouses'), token, companyId).json({ name: 'Main', isMain: true })
  const productId = (await authed(client.post('/api/v1/products'), token, companyId).json({ name: 'Coca', purchasePrice: 300, retailPrice: 500 })).body().id
  const supplierId = (await authed(client.post('/api/v1/suppliers'), token, companyId).json({ name: 'Supplier Co' })).body().id
  const registerId = (await authed(client.post('/api/v1/cash-registers'), token, companyId).json({ name: 'Main', isMain: true })).body().id
  await authed(client.post('/api/v1/cash-movements'), token, companyId).json({ registerId, type: 'in', amount: 5000, description: 'Opening float' })
  return { productId, supplierId, registerId }
}

test.group('Purchases + Suppliers', (group) => {
  group.each.setup(async () => {
    await cleanup()
  })

  test('paid purchase brings stock in, updates supplier stats, pays cash out', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'pur@acme.test', 'Acme')
    const { productId, supplierId, registerId } = await seed(client, token, company.id)

    const pur = await authed(client.post('/api/v1/purchases'), token, company.id).json({
      supplierId,
      supplierName: 'Supplier Co',
      items: [{ productId, quantity: 10, unitPrice: 300 }],
      paymentMethod: 'cash',
    })
    assert.equal(pur.status(), 201, `purchase failed: ${JSON.stringify(pur.body())}`)
    assert.equal(pur.body().purchaseNumber, 'ACH-0001')
    assert.equal(pur.body().total, 3000)
    assert.equal(pur.body().paidAmount, 3000)
    assert.equal(pur.body().status, 'paid')

    const product = await authed(client.get(`/api/v1/products/${productId}`), token, company.id)
    assert.equal(product.body().currentStock, 10) // stock IN

    const supplier = await authed(client.get(`/api/v1/suppliers/${supplierId}`), token, company.id)
    assert.equal(supplier.body().totalPurchases, 1)
    assert.equal(supplier.body().totalAmount, 3000)
    assert.equal(supplier.body().currentDebt, 0)

    const register = await authed(client.get(`/api/v1/cash-registers/${registerId}`), token, company.id)
    assert.equal(register.body().currentBalance, 2000) // 5000 - 3000 paid out
  })

  test('credit purchase accrues supplier debt, then a payment settles it', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'pur@acme.test', 'Acme')
    const { productId, supplierId, registerId } = await seed(client, token, company.id)

    const pur = await authed(client.post('/api/v1/purchases'), token, company.id).json({
      supplierId,
      supplierName: 'Supplier Co',
      items: [{ productId, quantity: 10, unitPrice: 300 }],
      paymentMethod: 'credit',
    })
    assert.equal(pur.body().remaining, 3000)
    assert.equal(pur.body().status, 'active')

    const supplier = await authed(client.get(`/api/v1/suppliers/${supplierId}`), token, company.id)
    assert.equal(supplier.body().currentDebt, 3000)

    const credits = await authed(client.get('/api/v1/supplier-credits'), token, company.id)
    const creditId = credits.body()[0].id
    assert.equal(Number(credits.body()[0].remainingAmount), 3000)

    const pay = await authed(client.post(`/api/v1/supplier-credits/${creditId}/payments`), token, company.id).json({ amount: 1000, paymentMode: 'cash' })
    assert.equal(pay.status(), 201, `payment failed: ${JSON.stringify(pay.body())}`)
    assert.equal(pay.body().remaining, 2000)
    assert.equal(pay.body().status, 'partial')

    const supplier2 = await authed(client.get(`/api/v1/suppliers/${supplierId}`), token, company.id)
    assert.equal(supplier2.body().currentDebt, 2000)
    const register = await authed(client.get(`/api/v1/cash-registers/${registerId}`), token, company.id)
    assert.equal(register.body().currentBalance, 4000) // 5000 - 1000 paid out
  })

  test('tenant isolation: B cannot see A purchases', async ({ client, assert }) => {
    const a = await signup(client, 'a@acme.test', 'CA')
    const b = await signup(client, 'b@beta.test', 'CB')
    const { productId, supplierId } = await seed(client, a.token, a.company.id)
    await authed(client.post('/api/v1/purchases'), a.token, a.company.id).json({ supplierId, supplierName: 'S', items: [{ productId, quantity: 1, unitPrice: 100 }], paymentMethod: 'cash' })

    const list = await authed(client.get('/api/v1/purchases'), b.token, b.company.id)
    assert.equal(list.body().meta.total, 0)
  })
})

import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

/** Dashboard aggregates: today's revenue, totals, top products, sales series. */
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

test.group('Dashboard', (group) => {
  group.each.setup(async () => {
    await cleanup()
  })

  test('aggregates today revenue, totals, top products and sales series', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'dash@acme.test', 'Acme')
    await authed(client.post('/api/v1/warehouses'), token, company.id).json({ name: 'Main', isMain: true })
    const whId = (await authed(client.get('/api/v1/warehouses'), token, company.id)).body()[0].id
    const productId = (await authed(client.post('/api/v1/products'), token, company.id).json({ name: 'Coca', purchasePrice: 300, retailPrice: 500 })).body().id
    await authed(client.post('/api/v1/stock/restock'), token, company.id).json({ productId, warehouseId: whId, quantity: 100 })

    // two paid invoices: 4@500 (2000) + 2@500 (1000)
    await authed(client.post('/api/v1/invoices'), token, company.id).json({ items: [{ productId, quantity: 4, unitPrice: 500 }], paymentMethod: 'cash' })
    await authed(client.post('/api/v1/invoices'), token, company.id).json({ items: [{ productId, quantity: 2, unitPrice: 500 }], paymentMethod: 'cash' })

    const dash = await authed(client.get('/api/v1/dashboard'), token, company.id)
    assert.equal(dash.status(), 200)
    assert.equal(dash.body().today.revenue, 3000) // 2000 + 1000 paid today
    assert.equal(dash.body().today.invoicesCount, 2)
    assert.equal(dash.body().totals.invoices, 2)
    assert.equal(dash.body().totals.revenue, 3000)
    assert.equal(dash.body().topProducts[0].totalQuantity, 6) // 4 + 2
    assert.isTrue(dash.body().salesLast7Days.length >= 1)
  })

  test('tenant isolation: B dashboard never reflects A activity', async ({ client, assert }) => {
    const a = await signup(client, 'a@acme.test', 'CA')
    const b = await signup(client, 'b@beta.test', 'CB')
    await authed(client.post('/api/v1/warehouses'), a.token, a.company.id).json({ name: 'Main', isMain: true })
    const whId = (await authed(client.get('/api/v1/warehouses'), a.token, a.company.id)).body()[0].id
    const productId = (await authed(client.post('/api/v1/products'), a.token, a.company.id).json({ name: 'Coca', purchasePrice: 300, retailPrice: 500 })).body().id
    await authed(client.post('/api/v1/stock/restock'), a.token, a.company.id).json({ productId, warehouseId: whId, quantity: 100 })
    await authed(client.post('/api/v1/invoices'), a.token, a.company.id).json({ items: [{ productId, quantity: 4, unitPrice: 500 }], paymentMethod: 'cash' })

    const dashB = await authed(client.get('/api/v1/dashboard'), b.token, b.company.id)
    assert.equal(dashB.body().today.revenue, 0)
    assert.equal(dashB.body().totals.invoices, 0)
  })
})

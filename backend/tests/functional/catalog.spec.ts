import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

/**
 * Catalog module: products, warehouses, and the transactional stock operations
 * (restock / loss / transfer). Verifies the StockService atomicity guarantees
 * that Sales will rely on, including full rollback on insufficient stock.
 */
const PASSWORD = 'Password123'

async function cleanup() {
  await db.rawQuery(
    'TRUNCATE TABLE stock_movements, product_stock_locations, products, warehouses, clients, audit_logs, auth_access_tokens, company_memberships, users, companies, tenants RESTART IDENTITY CASCADE'
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

/** Proven header pattern (matches clients.spec.ts). */
const authed = (req: any, token: string, companyId: number) =>
  req.header('Authorization', `Bearer ${token}`).header('X-Company-Id', String(companyId))

test.group('Catalog — products, warehouses, stock', (group) => {
  group.each.setup(async () => {
    await cleanup()
  })

  test('warehouse + product CRUD with soft delete', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'cat@acme.test', 'Acme')

    const wh = await authed(client.post('/api/v1/warehouses'), token, company.id).json({ name: 'Main depot', code: 'WH1', isMain: true })
    assert.equal(wh.status(), 201)
    const warehouseId = wh.body().id

    const pr = await authed(client.post('/api/v1/products'), token, company.id).json({ name: 'Coca 1L', code: 'COC1', purchasePrice: 300, retailPrice: 500, wholesalePrice: 450, wholesaleThreshold: 12, alertThreshold: 5, unit: 'pièce', warehouseId })
    assert.equal(pr.status(), 201)
    const productId = pr.body().id

    const shown = await authed(client.get(`/api/v1/products/${productId}`), token, company.id)
    assert.equal(shown.status(), 200)
    assert.equal(shown.body().name, 'Coca 1L')

    const del = await authed(client.delete(`/api/v1/products/${productId}`), token, company.id)
    assert.equal(del.status(), 204)
    const afterDel = await authed(client.get(`/api/v1/products/${productId}`), token, company.id)
    assert.equal(afterDel.status(), 404)
  })

  test('restock creates stock location + movement and updates product cache', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'cat@acme.test', 'Acme')

    const wh = await authed(client.post('/api/v1/warehouses'), token, company.id).json({ name: 'WH', isMain: true })
    assert.equal(wh.status(), 201)
    const warehouseId = wh.body().id

    const pr = await authed(client.post('/api/v1/products'), token, company.id).json({ name: 'P', purchasePrice: 100, retailPrice: 200, alertThreshold: 5 })
    assert.equal(pr.status(), 201)
    const productId = pr.body().id

    const r = await authed(client.post('/api/v1/stock/restock'), token, company.id).json({ productId, warehouseId, quantity: 20, reason: 'initial' })
    assert.equal(r.status(), 200, `restock failed: ${JSON.stringify(r.body())}`)
    assert.equal(r.body().after, 20)

    const product = await authed(client.get(`/api/v1/products/${productId}`), token, company.id)
    assert.equal(product.body().currentStock, 20)
    assert.equal(product.body().status, 'ok')

    const stock = await authed(client.get(`/api/v1/products/${productId}/stock`), token, company.id)
    assert.lengthOf(stock.body(), 1)
    assert.equal(stock.body()[0].quantity, 20)
  })

  test('transfer moves stock between warehouses atomically (2 movements, total unchanged)', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'cat@acme.test', 'Acme')
    const wh1 = (await authed(client.post('/api/v1/warehouses'), token, company.id).json({ name: 'A', isMain: true })).body().id
    const wh2 = (await authed(client.post('/api/v1/warehouses'), token, company.id).json({ name: 'B' })).body().id
    const productId = (await authed(client.post('/api/v1/products'), token, company.id).json({ name: 'P', purchasePrice: 100, retailPrice: 200 })).body().id
    const restock = await authed(client.post('/api/v1/stock/restock'), token, company.id).json({ productId, warehouseId: wh1, quantity: 10 })
    assert.equal(restock.status(), 200, `restock failed: ${JSON.stringify(restock.body())}`)

    const t = await authed(client.post('/api/v1/stock/transfer'), token, company.id).json({ productId, fromWarehouseId: wh1, toWarehouseId: wh2, quantity: 4 })
    assert.equal(t.status(), 200, `transfer failed: ${JSON.stringify(t.body())}`)
    assert.equal(t.body().from.after, 6)
    assert.equal(t.body().to.after, 4)

    const stock = await authed(client.get(`/api/v1/products/${productId}/stock`), token, company.id)
    const byWh: Record<string, number> = {}
    for (const s of stock.body()) byWh[String(s.warehouseId)] = s.quantity
    assert.equal(byWh[String(wh1)], 6)
    assert.equal(byWh[String(wh2)], 4)

    const product = await authed(client.get(`/api/v1/products/${productId}`), token, company.id)
    assert.equal(product.body().currentStock, 10)

    const movements = await authed(client.get('/api/v1/stock/movements'), token, company.id)
    assert.equal(movements.body().meta.total, 3)
  })

  test('transfer rolls back fully when source has insufficient stock', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'cat@acme.test', 'Acme')
    const wh1 = (await authed(client.post('/api/v1/warehouses'), token, company.id).json({ name: 'A', isMain: true })).body().id
    const wh2 = (await authed(client.post('/api/v1/warehouses'), token, company.id).json({ name: 'B' })).body().id
    const productId = (await authed(client.post('/api/v1/products'), token, company.id).json({ name: 'P', purchasePrice: 100, retailPrice: 200 })).body().id
    await authed(client.post('/api/v1/stock/restock'), token, company.id).json({ productId, warehouseId: wh1, quantity: 3 })

    const t = await authed(client.post('/api/v1/stock/transfer'), token, company.id).json({ productId, fromWarehouseId: wh1, toWarehouseId: wh2, quantity: 10 })
    assert.notEqual(t.status(), 200)

    const stock = await authed(client.get(`/api/v1/products/${productId}/stock`), token, company.id)
    assert.isArray(stock.body())
    assert.lengthOf(stock.body(), 1)
    assert.equal(stock.body()[0].quantity, 3)
  })

  test('low-stock threshold recomputes product status', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'cat@acme.test', 'Acme')
    const warehouseId = (await authed(client.post('/api/v1/warehouses'), token, company.id).json({ name: 'A', isMain: true })).body().id
    const productId = (await authed(client.post('/api/v1/products'), token, company.id).json({ name: 'P', purchasePrice: 100, retailPrice: 200, alertThreshold: 5 })).body().id
    const r = await authed(client.post('/api/v1/stock/restock'), token, company.id).json({ productId, warehouseId, quantity: 3 })
    assert.equal(r.status(), 200, `restock failed: ${JSON.stringify(r.body())}`)

    const product = await authed(client.get(`/api/v1/products/${productId}`), token, company.id)
    assert.equal(product.body().status, 'low')
  })

  test('tenant isolation: B cannot see A products', async ({ client, assert }) => {
    const a = await signup(client, 'a@acme.test', 'CA')
    const b = await signup(client, 'b@beta.test', 'CB')
    await authed(client.post('/api/v1/products'), a.token, a.company.id).json({ name: 'A product', purchasePrice: 1, retailPrice: 2 })

    const list = await authed(client.get('/api/v1/products'), b.token, b.company.id)
    assert.equal(list.body().meta.total, 0)
  })
})

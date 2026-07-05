import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

/**
 * Employee invites (atomic user + membership + seat) and the permission matrix
 * (module/action gates; owner bypasses; employee checked against membership).
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

async function login(client: any, email: string) {
  const res = await client.post('/api/v1/auth/login').json({ email, password: PASSWORD })
  return res.body().token
}

const authed = (req: any, token: string, companyId: number) =>
  req.header('Authorization', `Bearer ${token}`).header('X-Company-Id', String(companyId))

test.group('Employees + Permissions', (group) => {
  group.each.setup(async () => {
    await cleanup()
  })

  test('owner invites an employee; employee acts within their permissions', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'owner@acme.test', 'Acme')

    const emp = await authed(client.post('/api/v1/employees'), token, company.id).json({
      fullName: 'Jean Cashier',
      email: 'jean@acme.test',
      password: PASSWORD,
      permissions: [{ module: 'clients', actions: ['read', 'create'] }],
    })
    assert.equal(emp.status(), 201, `invite failed: ${JSON.stringify(emp.body())}`)

    const empToken = await login(client, 'jean@acme.test')
    assert.isTrue(!!empToken)

    // employee CAN create a client (has clients.create)
    const created = await authed(client.post('/api/v1/clients'), empToken, company.id).json({ name: 'Via employee' })
    assert.equal(created.status(), 201, `create failed: ${JSON.stringify(created.body())}`)

    // employee CANNOT delete a client (no clients.delete) -> 403
    const deleted = await authed(client.delete(`/api/v1/clients/${created.body().id}`), empToken, company.id)
    assert.equal(deleted.status(), 403)

    // owner lists employees
    const list = await authed(client.get('/api/v1/employees'), token, company.id)
    assert.equal(list.body().length, 1)
    assert.equal(list.body()[0].email, 'jean@acme.test')
  })

  test('employee without clients.create is forbidden', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'owner@acme.test', 'Acme')
    await authed(client.post('/api/v1/employees'), token, company.id).json({
      fullName: 'Read Only',
      email: 'ro@acme.test',
      password: PASSWORD,
      permissions: [{ module: 'clients', actions: ['read'] }],
    })
    const empToken = await login(client, 'ro@acme.test')

    const created = await authed(client.post('/api/v1/clients'), empToken, company.id).json({ name: 'X' })
    assert.equal(created.status(), 403)
  })

  test('non-owner cannot invite employees', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'owner@acme.test', 'Acme')
    await authed(client.post('/api/v1/employees'), token, company.id).json({
      fullName: 'Emp',
      email: 'emp@acme.test',
      password: PASSWORD,
      permissions: [{ module: 'clients', actions: ['read'] }],
    })
    const empToken = await login(client, 'emp@acme.test')

    const res = await authed(client.post('/api/v1/employees'), empToken, company.id).json({
      fullName: 'X',
      email: 'x@acme.test',
      password: PASSWORD,
    })
    assert.equal(res.status(), 403)
  })

  test('seat limit blocks further employees', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'owner@acme.test', 'Acme') // seatsUsed=1, limit=5
    for (let i = 0; i < 4; i++) {
      const r = await authed(client.post('/api/v1/employees'), token, company.id).json({
        fullName: `E${i}`,
        email: `e${i}@acme.test`,
        password: PASSWORD,
        permissions: [],
      })
      assert.equal(r.status(), 201, `employee ${i} should be created`)
    }
    // 5th employee -> 402 (seat limit reached: 1 owner + 4 = 5)
    const blocked = await authed(client.post('/api/v1/employees'), token, company.id).json({
      fullName: 'E5',
      email: 'e5@acme.test',
      password: PASSWORD,
      permissions: [],
    })
    assert.equal(blocked.status(), 402, `expected 402, got ${blocked.status()}: ${JSON.stringify(blocked.body())}`)
  })

  test('employee of tenant A cannot access tenant B company', async ({ client, assert }) => {
    const a = await signup(client, 'owner@acme.test', 'Acme')
    const b = await signup(client, 'owner@beta.test', 'Beta')
    await authed(client.post('/api/v1/employees'), a.token, a.company.id).json({
      fullName: 'A emp',
      email: 'aemp@acme.test',
      password: PASSWORD,
      permissions: [{ module: 'clients', actions: ['read'] }],
    })
    const empToken = await login(client, 'aemp@acme.test')

    const res = await client
      .get('/api/v1/clients')
      .header('Authorization', `Bearer ${empToken}`)
      .header('X-Company-Id', String(b.company.id))
    assert.equal(res.status(), 403)
  })

  test('profile returns role + permissions for the current company', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'owner@acme.test', 'Acme')

    const ownerProfile = await client
      .get('/api/v1/account/profile')
      .header('Authorization', `Bearer ${token}`)
      .header('X-Company-Id', String(company.id))
    assert.equal(ownerProfile.body().role, 'admin')
    assert.deepEqual(ownerProfile.body().permissions, [])

    await authed(client.post('/api/v1/employees'), token, company.id).json({
      fullName: 'Jean Cashier',
      email: 'jean@acme.test',
      password: PASSWORD,
      permissions: [{ module: 'stock', actions: ['read', 'restock'] }],
    })
    const empToken = await login(client, 'jean@acme.test')

    const empProfile = await client
      .get('/api/v1/account/profile')
      .header('Authorization', `Bearer ${empToken}`)
      .header('X-Company-Id', String(company.id))
    assert.equal(empProfile.body().role, 'employee')
    assert.equal(empProfile.body().permissions.length, 1)
    assert.equal(empProfile.body().permissions[0].module, 'stock')
    assert.isTrue(empProfile.body().permissions[0].actions.includes('restock'))
  })

  test('owner updates an employee name + permissions (seats unchanged)', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'owner@acme.test', 'Acme')
    const emp = (
      await authed(client.post('/api/v1/employees'), token, company.id).json({
        fullName: 'Old Name',
        email: 'up@acme.test',
        password: PASSWORD,
        permissions: [{ module: 'clients', actions: ['read'] }],
      })
    ).body()

    const updated = await authed(client.put(`/api/v1/employees/${emp.id}`), token, company.id).json({
      fullName: 'New Name',
      permissions: [{ module: 'stock', actions: ['read', 'restock', 'loss'] }],
    })
    assert.equal(updated.status(), 200, `update failed: ${JSON.stringify(updated.body())}`)
    assert.equal(updated.body().fullName, 'New Name')
    assert.equal(updated.body().permissions[0].module, 'stock')

    const seats = await db.from('tenants').select('seats_used').first()
    assert.equal(Number(seats?.seats_used), 2) // owner + 1 employee
  })

  test('owner deletes an employee; seat decremented; gone from list', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'owner@acme.test', 'Acme')
    const emp = (
      await authed(client.post('/api/v1/employees'), token, company.id).json({
        fullName: 'Gone',
        email: 'gone@acme.test',
        password: PASSWORD,
        permissions: [],
      })
    ).body()

    const del = await authed(client.delete(`/api/v1/employees/${emp.id}`), token, company.id)
    assert.equal(del.status(), 204, `delete failed: ${JSON.stringify(del.body())}`)

    const seats = await db.from('tenants').select('seats_used').first()
    assert.equal(Number(seats?.seats_used), 1) // back to owner only

    const list = await authed(client.get('/api/v1/employees'), token, company.id)
    assert.equal(list.body().length, 0)
  })
})

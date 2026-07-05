import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Tenant from '#models/tenant'

/**
 * End-to-end tests for the multi-tenant foundation:
 *  - atomic signup (tenant + company + owner)
 *  - login (password hashing via withAuthFinder)
 *  - company-scoped Clients CRUD (tenant/company auto-filled by the base hook)
 *  - cross-tenant isolation (B never sees A's data)
 *  - cross-tenant company access is forbidden (403)
 *
 * Runs against the dev database (omnigestion_dev); tables are truncated before
 * every test for isolation.
 */
const PASSWORD = 'Password123'

async function cleanup() {
  await db.rawQuery(
    'TRUNCATE TABLE audit_logs, auth_access_tokens, clients, company_memberships, users, companies, tenants RESTART IDENTITY CASCADE'
  )
}

async function signup(client: any, email: string, companyName: string, fullName = 'Owner') {
  const res = await client.post('/api/v1/auth/signup').json({
    fullName,
    email,
    password: PASSWORD,
    passwordConfirmation: PASSWORD,
    companyName,
  })
  return { status: res.status(), body: res.body() }
}

test.group('Auth + Clients — multi-tenant', (group) => {
  group.each.setup(async () => {
    await cleanup()
  })

  test('signup is atomic and returns a token + company', async ({ client, assert }) => {
    const { status, body } = await signup(client, 'alice@acme.test', 'Acme')
    assert.equal(status, 200)
    assert.isTrue(!!body.token)
    assert.isTrue(!!body.user.id)
    assert.equal(body.user.isOwner, true)
    assert.isTrue(!!body.company.id)
    assert.equal(body.company.name, 'Acme')
  })

  test('login returns a token for a registered owner (password is hashed)', async ({
    client,
    assert,
  }) => {
    await signup(client, 'alice@acme.test', 'Acme')
    const res = await client.post('/api/v1/auth/login').json({
      email: 'alice@acme.test',
      password: PASSWORD,
    })
    assert.equal(res.status(), 200)
    assert.isTrue(!!res.body().token)
  })

  test('login with wrong password fails', async ({ client, assert }) => {
    await signup(client, 'alice@acme.test', 'Acme')
    const res = await client.post('/api/v1/auth/login').json({
      email: 'alice@acme.test',
      password: 'WrongPassword1',
    })
    assert.notEqual(res.status(), 200)
  })

  test('owner can create and list clients in their company (tenant/company auto-filled)', async ({
    client,
    assert,
  }) => {
    const { body } = await signup(client, 'alice@acme.test', 'Acme')
    const token = body.token
    const companyId = body.company.id

    const create = await client
      .post('/api/v1/clients')
      .header('Authorization', `Bearer ${token}`)
      .header('X-Company-Id', String(companyId))
      .json({ name: 'Bob the Client', phone: '+224 600' })
    assert.equal(create.status(), 201)

    const list: any = await client
      .get('/api/v1/clients')
      .header('Authorization', `Bearer ${token}`)
      .header('X-Company-Id', String(companyId))
    assert.equal(list.status(), 200)
    assert.lengthOf(list.body().data, 1)
    assert.equal(list.body().data[0].name, 'Bob the Client')
    assert.equal(list.body().data[0].companyId, companyId) // auto-filled by the base hook
    assert.equal(list.body().data[0].tenantId, body.user.tenantId)
  })

  test('tenant B cannot see tenant A clients (strict isolation)', async ({ client, assert }) => {
    const a = await signup(client, 'a@acme.test', 'CompanyA')
    await client
      .post('/api/v1/clients')
      .header('Authorization', `Bearer ${a.body.token}`)
      .header('X-Company-Id', String(a.body.company.id))
      .json({ name: 'Secret client of A' })

    const b = await signup(client, 'b@beta.test', 'CompanyB')
    const list: any = await client
      .get('/api/v1/clients')
      .header('Authorization', `Bearer ${b.body.token}`)
      .header('X-Company-Id', String(b.body.company.id))

    assert.equal(list.status(), 200)
    assert.lengthOf(list.body().data, 0) // B sees nothing of A
  })

  test('owner cannot access a company belonging to another tenant (403)', async ({
    client,
    assert,
  }) => {
    const a = await signup(client, 'a@acme.test', 'CompanyA')
    const b = await signup(client, 'b@beta.test', 'CompanyB')

    const res = await client
      .get('/api/v1/clients')
      .header('Authorization', `Bearer ${a.body.token}`)
      .header('X-Company-Id', String(b.body.company.id)) // A tries B's company

    assert.equal(res.status(), 403)
  })

  test('show/update/delete are scoped to the current company', async ({ client, assert }) => {
    const { body } = await signup(client, 'alice@acme.test', 'Acme')
    const token = body.token
    const companyId = body.company.id

    const created: any = await client
      .post('/api/v1/clients')
      .header('Authorization', `Bearer ${token}`)
      .header('X-Company-Id', String(companyId))
      .json({ name: 'To Update' })
    const clientId = created.body().id

    const updated: any = await client
      .put(`/api/v1/clients/${clientId}`)
      .header('Authorization', `Bearer ${token}`)
      .header('X-Company-Id', String(companyId))
      .json({ name: 'Updated Name' })
    assert.equal(updated.status(), 200)
    assert.equal(updated.body().name, 'Updated Name')

    const shown = await client
      .get(`/api/v1/clients/${clientId}`)
      .header('Authorization', `Bearer ${token}`)
      .header('X-Company-Id', String(companyId))
    assert.equal(shown.status(), 200)

    const deleted = await client
      .delete(`/api/v1/clients/${clientId}`)
      .header('Authorization', `Bearer ${token}`)
      .header('X-Company-Id', String(companyId))
    assert.equal(deleted.status(), 204)

    const list: any = await client
      .get('/api/v1/clients')
      .header('Authorization', `Bearer ${token}`)
      .header('X-Company-Id', String(companyId))
    assert.lengthOf(list.body().data, 0)
  })

  test('mutations are recorded in the audit log (create/update/delete)', async ({
    client,
    assert,
  }) => {
    const { body } = await signup(client, 'alice@acme.test', 'Acme')
    const token = body.token
    const companyId = body.company.id
    const tenantId = body.user.tenantId

    const created: any = await client
      .post('/api/v1/clients')
      .header('Authorization', `Bearer ${token}`)
      .header('X-Company-Id', String(companyId))
      .json({ name: 'Audited' })
    const clientId = created.body().id

    await client
      .put(`/api/v1/clients/${clientId}`)
      .header('Authorization', `Bearer ${token}`)
      .header('X-Company-Id', String(companyId))
      .json({ name: 'Audited Renamed' })
    await client
      .delete(`/api/v1/clients/${clientId}`)
      .header('Authorization', `Bearer ${token}`)
      .header('X-Company-Id', String(companyId))

    const logs = await db
      .from('audit_logs')
      .where('tenant_id', tenantId)
      .where('company_id', companyId)
      .orderBy('id', 'asc')

    const actions = logs.map((row: any) => row.action)
    assert.deepEqual(actions, ['create', 'update', 'delete'])
    assert.equal(logs[0].entity, 'client')
    assert.equal(logs[0].entity_id, clientId)
    assert.equal(logs[0].user_id, body.user.id) // who did it
    assert.isNotNull(logs[2].before) // delete keeps a before snapshot
  })

  test('db.transaction rolls back fully on throw (no partial writes)', async ({ assert }) => {
    let threw = false
    try {
      await db.transaction(async (trx) => {
        await Tenant.create(
          { name: 'RollbackTenant', plan: 'free', seatsLimit: 1, seatsUsed: 0 },
          { client: trx },
        )
        throw new Error('force rollback')
      })
    } catch {
      threw = true
    }

    assert.isTrue(threw)
    const countRow = await db
      .from('tenants')
      .where('name', 'RollbackTenant')
      .count('* as total')
      .first()
    assert.equal(Number(countRow?.total ?? 0), 0) // nothing persisted — full rollback
  })
})

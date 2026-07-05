import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

/** Cash: registers CRUD, transfers between registers, manual in/out, guards. */
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

test.group('Cash — registers, transfers, movements', (group) => {
  group.each.setup(async () => {
    await cleanup()
  })

  test('registers CRUD + transfer + manual in/out', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'cash@acme.test', 'Acme')

    const a = await authed(client.post('/api/v1/cash-registers'), token, company.id).json({ name: 'Main', isMain: true })
    assert.equal(a.status(), 201)
    const idA = a.body().id
    const b = await authed(client.post('/api/v1/cash-registers'), token, company.id).json({ name: 'Bank' })
    const idB = b.body().id

    // open Main with 1000
    const dep = await authed(client.post('/api/v1/cash-movements'), token, company.id).json({ registerId: idA, type: 'in', amount: 1000, description: 'Opening float' })
    assert.equal(dep.status(), 201, `deposit failed: ${JSON.stringify(dep.body())}`)
    assert.equal(dep.body().after, 1000)

    // transfer 400 Main -> Bank
    const t = await authed(client.post('/api/v1/cash-registers/transfer'), token, company.id).json({ fromRegisterId: idA, toRegisterId: idB, amount: 400 })
    assert.equal(t.status(), 200, `transfer failed: ${JSON.stringify(t.body())}`)
    assert.equal(t.body().from.after, 600)
    assert.equal(t.body().to.after, 400)

    const regA = await authed(client.get(`/api/v1/cash-registers/${idA}`), token, company.id)
    const regB = await authed(client.get(`/api/v1/cash-registers/${idB}`), token, company.id)
    assert.equal(regA.body().currentBalance, 600)
    assert.equal(regB.body().currentBalance, 400)

    // expense 200 from Bank
    await authed(client.post('/api/v1/cash-movements'), token, company.id).json({ registerId: idB, type: 'out', amount: 200, description: 'Expense' })
    const regB2 = await authed(client.get(`/api/v1/cash-registers/${idB}`), token, company.id)
    assert.equal(regB2.body().currentBalance, 200)

    // movements: in(1) + transfer(2) + out(1) = 4
    const movs = await authed(client.get('/api/v1/cash-movements'), token, company.id)
    assert.equal(movs.body().meta.total, 4)
  })

  test('insufficient balance is rejected (out + transfer)', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'cash@acme.test', 'Acme')
    const idA = (await authed(client.post('/api/v1/cash-registers'), token, company.id).json({ name: 'Main', isMain: true })).body().id
    const idB = (await authed(client.post('/api/v1/cash-registers'), token, company.id).json({ name: 'Bank' })).body().id

    const out = await authed(client.post('/api/v1/cash-movements'), token, company.id).json({ registerId: idA, type: 'out', amount: 500 })
    assert.equal(out.status(), 422) // empty register

    const t = await authed(client.post('/api/v1/cash-registers/transfer'), token, company.id).json({ fromRegisterId: idA, toRegisterId: idB, amount: 500 })
    assert.equal(t.status(), 422)
  })

  test('cannot delete the main register', async ({ client, assert }) => {
    const { token, company } = await signup(client, 'cash@acme.test', 'Acme')
    const idA = (await authed(client.post('/api/v1/cash-registers'), token, company.id).json({ name: 'Main', isMain: true })).body().id
    const del = await authed(client.delete(`/api/v1/cash-registers/${idA}`), token, company.id)
    assert.equal(del.status(), 409)
  })

  test('tenant isolation: B cannot see A registers', async ({ client, assert }) => {
    const a = await signup(client, 'a@acme.test', 'CA')
    const b = await signup(client, 'b@beta.test', 'CB')
    await authed(client.post('/api/v1/cash-registers'), a.token, a.company.id).json({ name: 'A register', isMain: true })

    const list = await authed(client.get('/api/v1/cash-registers'), b.token, b.company.id)
    // B sees only its own seeded default register — never A's registers.
    assert.lengthOf(list.body(), 1)
    assert.isFalse(list.body().some((r: any) => r.name === 'A register'))
  })
})

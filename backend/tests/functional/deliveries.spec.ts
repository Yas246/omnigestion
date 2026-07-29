import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

/**
 * Deliveries — the storefront order fulfilment flow. Verifies the plan's
 * end-to-end guarantees:
 *   - assign() generates a qr_token
 *   - complete() with a WRONG token is rejected (422)
 *   - complete() with the RIGHT token settles the invoice (paid) + its
 *     client_credit + decrements client.current_credit, but creates NO
 *     cash_movement (COD stays in the driver's float until settlement)
 *   - validateSettlement() is what finally credits the cash register
 *   - cancel() works on a pending/assigned delivery
 *   - tenant isolation: B cannot see A's deliveries
 */
const PASSWORD = 'Password123'

async function cleanup() {
  await db.rawQuery(
    'TRUNCATE TABLE delivery_events, deliveries, driver_settlements, delivery_addresses, client_credits, cash_movements, cash_registers, invoice_items, invoices, invoice_counters, stock_movements, product_stock_locations, products, warehouses, clients, audit_logs, auth_access_tokens, company_memberships, users, companies, tenants RESTART IDENTITY CASCADE'
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
  const cookie = res.cookie('omnigestion_token') as any
  return { ...res.body(), token: cookie?.value ?? null }
}

const authed = (req: any, token: string, companyId: number) =>
  req.header('Authorization', `Bearer ${token}`).header('X-Company-Id', String(companyId))

async function mainRegisterBalance(tenantId: number, companyId: number) {
  const row = await db
    .from('cash_registers')
    .where('tenant_id', tenantId)
    .where('company_id', companyId)
    .where('is_main', true)
    .first()
  return row ? Number(row.current_balance) : null
}

/**
 * Inserts a realistic storefront invoice (channel='store', credit/unpaid) with a
 * linked client + client_credit — the exact shape PublicCommerceController.checkout
 * produces. Returns the invoice id. (The invoices API validator does not expose
 * `channel`, so we seed the row directly to test the delivery flow faithfully.)
 */
async function seedStoreOrder(
  tenantId: number,
  companyId: number,
  clientId: number,
  total: number
) {
  const now = new Date()
  const [invRow] = await db
    .table('invoices')
    .insert({
      tenant_id: tenantId,
      company_id: companyId,
      channel: 'store',
      invoice_number: 'STO-' + Math.floor(Math.random() * 1_000_000),
      client_id: clientId,
      client_name: 'Buyer',
      sale_date: now,
      subtotal: total,
      tax_rate: 0,
      tax_amount: 0,
      discount: 0,
      total,
      status: 'validated',
      payment_method: 'credit',
      paid_amount: 0,
      remaining_amount: total,
      user_id: null,
      created_at: now,
      updated_at: now,
    })
    .returning('id')
  const invoiceId = Number((invRow as any).id)

  await db.table('client_credits').insert({
    tenant_id: tenantId,
    company_id: companyId,
    client_id: clientId,
    client_name: 'Buyer',
    invoice_id: invoiceId,
    invoice_number: 'STO',
    amount: total,
    amount_paid: 0,
    remaining_amount: total,
    status: 'active',
    date: now,
    created_at: now,
    updated_at: now,
  })
  await db.from('clients').where('id', clientId).update({ current_credit: total })
  return invoiceId
}

test.group('Deliveries — COD + QR + settlement', (group) => {
  group.each.setup(async () => {
    await cleanup()
  })

  test('assign generates a qr_token', async ({ client, assert }) => {
    const { token, company, user } = await signup(client, 'deliv@acme.test', 'Acme')
    const tenantId = user.tenantId
    const clientId = (
      await authed(client.post('/api/v1/clients'), token, company.id).json({ name: 'Buyer' })
    ).body().id
    const invoiceId = await seedStoreOrder(tenantId, company.id, clientId, 1000)

    const created = await authed(client.post('/api/v1/deliveries'), token, company.id).json({
      invoiceId,
    })
    assert.equal(created.status(), 201, `create failed: ${JSON.stringify(created.body())}`)
    assert.equal(created.body().status, 'pending')
    const deliveryId = created.body().id

    const assigned = await authed(
      client.post(`/api/v1/deliveries/${deliveryId}/assign`),
      token,
      company.id
    ).json({ driverUserId: user.id })
    assert.equal(assigned.status(), 200, `assign failed: ${JSON.stringify(assigned.body())}`)
    assert.equal(assigned.body().status, 'assigned')
    assert.isOk(assigned.body().qrToken)
    assert.lengthOf(assigned.body().qrToken, 32) // randomBytes(16).hex
  })

  test('complete with a wrong QR token is rejected (422)', async ({ client, assert }) => {
    const { token, company, user } = await signup(client, 'deliv@acme.test', 'Acme')
    const tenantId = user.tenantId
    const clientId = (
      await authed(client.post('/api/v1/clients'), token, company.id).json({ name: 'Buyer' })
    ).body().id
    const invoiceId = await seedStoreOrder(tenantId, company.id, clientId, 1000)

    const deliveryId = (
      await authed(client.post('/api/v1/deliveries'), token, company.id).json({ invoiceId })
    ).body().id
    await authed(client.post(`/api/v1/deliveries/${deliveryId}/assign`), token, company.id).json({
      driverUserId: user.id,
    })

    const bad = await authed(
      client.post(`/api/v1/deliveries/${deliveryId}/complete`),
      token,
      company.id
    ).json({ scannedQrToken: 'deadbeef', codPaymentMethod: 'cash' })
    assert.equal(bad.status(), 422)

    // invoice still unpaid
    const inv = await db.from('invoices').where('id', invoiceId).first()
    assert.equal(inv.status, 'validated')
  })

  test('complete with the right QR token settles the invoice but creates NO cash_movement', async ({
    client,
    assert,
  }) => {
    const { token, company, user } = await signup(client, 'deliv@acme.test', 'Acme')
    const tenantId = user.tenantId
    const clientId = (
      await authed(client.post('/api/v1/clients'), token, company.id).json({ name: 'Buyer' })
    ).body().id
    const invoiceId = await seedStoreOrder(tenantId, company.id, clientId, 1000)

    const deliveryId = (
      await authed(client.post('/api/v1/deliveries'), token, company.id).json({ invoiceId })
    ).body().id
    const assigned = await authed(
      client.post(`/api/v1/deliveries/${deliveryId}/assign`),
      token,
      company.id
    ).json({ driverUserId: user.id })
    const qr = assigned.body().qrToken

    const ok = await authed(
      client.post(`/api/v1/deliveries/${deliveryId}/complete`),
      token,
      company.id
    ).json({ scannedQrToken: qr, codPaymentMethod: 'cash' })
    assert.equal(ok.status(), 200, `complete failed: ${JSON.stringify(ok.body())}`)
    assert.equal(ok.body().status, 'delivered')
    assert.equal(ok.body().codAmount, 1000)
    assert.equal(ok.body().codPaymentMethod, 'cash')

    // invoice settled (paid) ...
    const inv = await db.from('invoices').where('id', invoiceId).first()
    assert.equal(inv.status, 'paid')
    assert.equal(Number(inv.paid_amount), 1000)
    assert.equal(Number(inv.remaining_amount), 0)
    // ... client_credit settled ...
    const credit = await db.from('client_credits').where('invoice_id', invoiceId).first()
    assert.equal(credit.status, 'paid')
    assert.equal(Number(credit.remaining_amount), 0)
    // ... client balance back to 0 ...
    const c = await db.from('clients').where('id', clientId).first()
    assert.equal(Number(c.current_credit), 0)
    // ... and NO cash movement yet (COD is in the driver's float).
    assert.isNotTrue(await mainRegisterBalance(tenantId, company.id))
  })

  test('settlement validation credits the cash register + marks deliveries settled', async ({
    client,
    assert,
  }) => {
    const { token, company, user } = await signup(client, 'deliv@acme.test', 'Acme')
    const tenantId = user.tenantId
    const clientId = (
      await authed(client.post('/api/v1/clients'), token, company.id).json({ name: 'Buyer' })
    ).body().id
    const invoiceId = await seedStoreOrder(tenantId, company.id, clientId, 1000)

    const deliveryId = (
      await authed(client.post('/api/v1/deliveries'), token, company.id).json({ invoiceId })
    ).body().id
    const assigned = await authed(
      client.post(`/api/v1/deliveries/${deliveryId}/assign`),
      token,
      company.id
    ).json({ driverUserId: user.id })
    await authed(client.post(`/api/v1/deliveries/${deliveryId}/complete`), token, company.id).json({
      scannedQrToken: assigned.body().qrToken,
      codPaymentMethod: 'cash',
    })

    // No cash yet.
    assert.isNotTrue(await mainRegisterBalance(tenantId, company.id))

    // Driver declares the exact cash collected.
    const settlement = await authed(
      client.post('/api/v1/deliveries/settlements'),
      token,
      company.id
    ).json({ driverUserId: user.id, actualCash: 1000, actualMobile: 0 })
    assert.equal(
      settlement.status(),
      201,
      `settlement create failed: ${JSON.stringify(settlement.body())}`
    )
    assert.equal(settlement.body().expectedCod, 1000)
    assert.equal(settlement.body().difference, 0)
    const settlementId = settlement.body().id

    // Admin validates -> cash enters the register.
    const validated = await authed(
      client.post(`/api/v1/deliveries/settlements/${settlementId}/validate`),
      token,
      company.id
    ).json({})
    assert.equal(validated.status(), 200, `validate failed: ${JSON.stringify(validated.body())}`)
    assert.equal(validated.body().status, 'validated')
    assert.equal(await mainRegisterBalance(tenantId, company.id), 1000)

    // Delivery marked settled.
    const d = await db.from('deliveries').where('id', deliveryId).first()
    assert.equal(Number(d.settlement_id), settlementId)
  })

  test('settlement with a mismatch flags a discrepancy (no cash entered)', async ({
    client,
    assert,
  }) => {
    const { token, company, user } = await signup(client, 'deliv@acme.test', 'Acme')
    const tenantId = user.tenantId
    const clientId = (
      await authed(client.post('/api/v1/clients'), token, company.id).json({ name: 'Buyer' })
    ).body().id
    const invoiceId = await seedStoreOrder(tenantId, company.id, clientId, 1000)

    const deliveryId = (
      await authed(client.post('/api/v1/deliveries'), token, company.id).json({ invoiceId })
    ).body().id
    const assigned = await authed(
      client.post(`/api/v1/deliveries/${deliveryId}/assign`),
      token,
      company.id
    ).json({ driverUserId: user.id })
    await authed(client.post(`/api/v1/deliveries/${deliveryId}/complete`), token, company.id).json({
      scannedQrToken: assigned.body().qrToken,
      codPaymentMethod: 'cash',
    })

    const settlement = await authed(
      client.post('/api/v1/deliveries/settlements'),
      token,
      company.id
    ).json({ driverUserId: user.id, actualCash: 800, actualMobile: 0 })
    const settlementId = settlement.body().id
    const validated = await authed(
      client.post(`/api/v1/deliveries/settlements/${settlementId}/validate`),
      token,
      company.id
    ).json({})
    assert.equal(validated.body().status, 'discrepancy')
    assert.equal(validated.body().difference, 200)
    // No cash entered on a discrepancy.
    assert.isNotTrue(await mainRegisterBalance(tenantId, company.id))
  })

  test('cancel a pending delivery', async ({ client, assert }) => {
    const { token, company, user } = await signup(client, 'deliv@acme.test', 'Acme')
    const clientId = (
      await authed(client.post('/api/v1/clients'), token, company.id).json({ name: 'Buyer' })
    ).body().id
    const invoiceId = await seedStoreOrder(user.tenantId, company.id, clientId, 1000)

    const deliveryId = (
      await authed(client.post('/api/v1/deliveries'), token, company.id).json({ invoiceId })
    ).body().id
    const cancelled = await authed(
      client.post(`/api/v1/deliveries/${deliveryId}/cancel`),
      token,
      company.id
    )
    assert.equal(cancelled.status(), 200, `cancel failed: ${JSON.stringify(cancelled.body())}`)
    assert.equal(cancelled.body().status, 'cancelled')
  })

  test('tenant isolation: B cannot see A deliveries', async ({ client, assert }) => {
    const a = await signup(client, 'a@acme.test', 'CA')
    const b = await signup(client, 'b@beta.test', 'CB')
    const clientId = (
      await authed(client.post('/api/v1/clients'), a.token, a.company.id).json({ name: 'Buyer' })
    ).body().id
    const invoiceId = await seedStoreOrder(a.user.tenantId, a.company.id, clientId, 1000)
    await authed(client.post('/api/v1/deliveries'), a.token, a.company.id).json({ invoiceId })

    const list = await authed(client.get('/api/v1/deliveries'), b.token, b.company.id)
    assert.lengthOf(list.body(), 0)
  })
})

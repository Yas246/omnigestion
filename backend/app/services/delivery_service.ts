import db from '@adonisjs/lucid/services/db'
import { randomBytes } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import { AuditService } from '#services/audit_service'
import { CashService } from '#services/cash_service'

/**
 * Deliveries — fulfils storefront orders (invoice channel='store').
 *
 * Mirrors InvoiceService: every state transition runs in ONE transaction with a
 * FOR UPDATE lock on the delivery row, and an audit row written in-tx.
 *
 * COD is a TWO-STEP flow (plan §8b):
 *   - `complete()` settles the invoice (status 'paid') + its client_credit +
 *     decrements clients.current_credit, but creates NO cash_movement — the
 *     cash is still in the driver's float.
 *   - `validateSettlement()` is what finally records the cash_movement 'in'
 *     (category 'delivery_cod') for the cash portion the driver hands in.
 */
const now = () => new Date()

/** Best-effort server-side geocoding via Nominatim (no API key). Returns null
 *  on any failure so delivery creation never blocks on a map service. */
async function geocode(address: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Omnigestion/1.0 (deliveries)' },
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) return null
    const data = (await res.json()) as any
    const hit = Array.isArray(data) && data[0]
    if (!hit) return null
    const latitude = Number(hit.lat)
    const longitude = Number(hit.lon)
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null
    return { latitude, longitude }
  } catch {
    return null
  }
}

export interface AddressInput {
  deliveryAddressId?: number | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  city?: string | null
}

export const DeliveryService = {
  /** Insert a delivery_events row (status_change or location). */
  async logEvent(
    trx: any,
    ctx: { tenantId: number; companyId: number },
    deliveryId: number,
    type: 'status_change' | 'location',
    fields: {
      driverUserId?: number | null
      latitude?: number | null
      longitude?: number | null
      status?: string | null
      note?: string | null
    }
  ) {
    await trx.table('delivery_events').insert({
      tenant_id: ctx.tenantId,
      company_id: ctx.companyId,
      delivery_id: deliveryId,
      driver_user_id: fields.driverUserId ?? null,
      type,
      latitude: fields.latitude ?? null,
      longitude: fields.longitude ?? null,
      status: fields.status ?? null,
      note: fields.note ?? null,
      recorded_at: now(),
    })
  },

  /** Dispatcher creates a delivery from a storefront invoice. */
  async createFromInvoice(ctx: HttpContext, invoiceId: number, address: AddressInput) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId
    if (!companyId) throw new Error('No company context')
    const userId = ctx.auth.user?.id ?? null

    return db.transaction(async (trx) => {
      const inv: any = await trx
        .from('invoices')
        .where('id', invoiceId)
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .forUpdate()
        .first()
      if (!inv) throw new Error('Invoice not found')
      if (inv.channel !== 'store') throw new Error('Only storefront orders can be delivered')

      const existing = await trx
        .from('deliveries')
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .where('invoice_id', invoiceId)
        .whereNotIn('status', ['cancelled'])
        .first()
      if (existing) throw new Error('A delivery already exists for this order')

      // Resolve the address snapshot: explicit saved id > inline > the buyer's
      // default saved address (looked up via the invoice's client). This lets
      // the dispatcher create a delivery in one click without typing an address.
      let snapAddress: string | null = address.address ?? null
      let snapLat: number | null = address.latitude ?? null
      let snapLng: number | null = address.longitude ?? null
      let snapCity: string | null = address.city ?? null
      const deliveryAddressId: number | null = address.deliveryAddressId ?? null

      if (deliveryAddressId) {
        const saved = await trx.from('delivery_addresses').where('id', deliveryAddressId).first()
        if (saved) {
          snapAddress = saved.address
          snapLat = saved.latitude != null ? Number(saved.latitude) : null
          snapLng = saved.longitude != null ? Number(saved.longitude) : null
          snapCity = saved.city
        }
      } else if (!snapAddress && inv.client_id) {
        const client: any = await trx.from('clients').where('id', inv.client_id).first()
        if (client?.store_account_id) {
          const def =
            (await trx
              .from('delivery_addresses')
              .where('store_account_id', client.store_account_id)
              .where('is_default', true)
              .first()) ??
            (await trx
              .from('delivery_addresses')
              .where('store_account_id', client.store_account_id)
              .orderBy('created_at', 'desc')
              .first())
          if (def) {
            snapAddress = def.address
            snapLat = def.latitude != null ? Number(def.latitude) : null
            snapLng = def.longitude != null ? Number(def.longitude) : null
            snapCity = def.city
          }
        }
      }

      // Geocode whenever we have an address but no coordinates.
      if (snapAddress && (snapLat == null || snapLng == null)) {
        const geo = await geocode(snapAddress)
        if (geo) {
          snapLat = geo.latitude
          snapLng = geo.longitude
        }
      }

      const codAmount = Number(inv.remaining_amount) || Number(inv.total) || 0

      const [row] = await trx
        .table('deliveries')
        .insert({
          tenant_id: tenantId,
          company_id: companyId,
          invoice_id: inv.id,
          client_id: inv.client_id ?? null,
          client_name: inv.client_name ?? null,
          store_account_id: null,
          driver_user_id: null,
          driver_name: null,
          status: 'pending',
          delivery_address_id: deliveryAddressId,
          delivery_address: snapAddress,
          delivery_latitude: snapLat,
          delivery_longitude: snapLng,
          delivery_city: snapCity,
          scheduled_at: null,
          assigned_at: null,
          picked_up_at: null,
          delivered_at: null,
          cod_amount: codAmount,
          cod_payment_method: null,
          cod_collected: false,
          settlement_id: null,
          qr_token: null,
          failure_reason: null,
          created_by_user_id: userId,
          created_at: now(),
          updated_at: now(),
        })
        .returning('id')
      const deliveryId = Number((row as any).id)

      await this.logEvent(trx, { tenantId, companyId }, deliveryId, 'status_change', {
        driverUserId: null,
        status: 'pending',
        note: 'Delivery created',
      })
      await AuditService.log(
        ctx,
        {
          action: 'create',
          entity: 'delivery',
          entityId: deliveryId,
          after: { invoiceId: inv.id, codAmount },
        },
        { client: trx }
      )
      return { id: deliveryId, invoiceId: inv.id, status: 'pending', codAmount }
    })
  },

  /** Attribute a delivery to a driver and generate the QR confirmation token. */
  async assign(ctx: HttpContext, deliveryId: number, driverUserId: number) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId
    if (!companyId) throw new Error('No company context')

    return db.transaction(async (trx) => {
      const del: any = await trx
        .from('deliveries')
        .where('id', deliveryId)
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .forUpdate()
        .first()
      if (!del) throw new Error('Delivery not found')
      if (del.status !== 'pending')
        throw new Error(`Cannot assign a delivery in status '${del.status}'`)

      const driver: any = await trx
        .from('users')
        .where('id', driverUserId)
        .where('tenant_id', tenantId)
        .first()
      if (!driver) throw new Error('Driver not found in this tenant')

      const qrToken = randomBytes(16).toString('hex')
      await trx
        .from('deliveries')
        .where('id', deliveryId)
        .update({
          driver_user_id: driverUserId,
          driver_name: driver.full_name ?? null,
          status: 'assigned',
          assigned_at: now(),
          qr_token: qrToken,
          updated_at: now(),
        })

      await this.logEvent(trx, { tenantId, companyId }, deliveryId, 'status_change', {
        driverUserId,
        status: 'assigned',
        note: `Assigned to ${driver.full_name ?? '#' + driverUserId}`,
      })
      await AuditService.log(
        ctx,
        {
          action: 'update',
          entity: 'delivery',
          entityId: deliveryId,
          after: { status: 'assigned', driverUserId },
        },
        { client: trx }
      )
      return { id: deliveryId, status: 'assigned', driverUserId, qrToken }
    })
  },

  /** Driver picks up the goods. */
  async pickup(ctx: HttpContext, deliveryId: number) {
    return this.transition(ctx, deliveryId, 'picked_up', ['assigned'], 'Picked up')
  },

  /** Driver is en route. */
  async start(ctx: HttpContext, deliveryId: number) {
    return this.transition(ctx, deliveryId, 'in_transit', ['picked_up'], 'In transit')
  },

  /** Shared status transition (lock + validate from-status + event + audit). */
  async transition(
    ctx: HttpContext,
    deliveryId: number,
    toStatus: 'picked_up' | 'in_transit',
    fromStatuses: string[],
    note: string
  ) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId
    if (!companyId) throw new Error('No company context')
    const userId = ctx.auth.user?.id ?? null

    return db.transaction(async (trx) => {
      const del: any = await trx
        .from('deliveries')
        .where('id', deliveryId)
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .forUpdate()
        .first()
      if (!del) throw new Error('Delivery not found')
      if (!fromStatuses.includes(del.status)) {
        throw new Error(`Cannot move a delivery from '${del.status}' to '${toStatus}'`)
      }
      const patch: Record<string, any> = { status: toStatus, updated_at: now() }
      if (toStatus === 'picked_up') patch.picked_up_at = now()
      await trx.from('deliveries').where('id', deliveryId).update(patch)
      await this.logEvent(trx, { tenantId, companyId }, deliveryId, 'status_change', {
        driverUserId: userId,
        status: toStatus,
        note,
      })
      await AuditService.log(
        ctx,
        { action: 'update', entity: 'delivery', entityId: deliveryId, after: { status: toStatus } },
        { client: trx }
      )
      return { id: deliveryId, status: toStatus }
    })
  },

  /** Driver posts a live position (route throttled ~1 req/20s). */
  async updatePosition(ctx: HttpContext, deliveryId: number, latitude: number, longitude: number) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId
    if (!companyId) throw new Error('No company context')
    const userId = ctx.auth.user?.id ?? null

    return db.transaction(async (trx) => {
      const del: any = await trx
        .from('deliveries')
        .where('id', deliveryId)
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .first()
      if (!del) throw new Error('Delivery not found')
      await this.logEvent(trx, { tenantId, companyId }, deliveryId, 'location', {
        driverUserId: userId,
        latitude,
        longitude,
      })
      return { ok: true }
    })
  },

  /**
   * Driver confirms delivery. Verifies the scanned QR token (if one was issued),
   * settles the invoice (paid) + its client_credit + decrements the client's
   * current_credit. Records cod_collected + cod_amount + cod_payment_method but
   * creates NO cash_movement (deferred to settlement validation).
   */
  async complete(
    ctx: HttpContext,
    deliveryId: number,
    input: { scannedQrToken?: string | null; codPaymentMethod?: string | null }
  ) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId
    if (!companyId) throw new Error('No company context')
    const userId = ctx.auth.user?.id ?? null

    return db.transaction(async (trx) => {
      const del: any = await trx
        .from('deliveries')
        .where('id', deliveryId)
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .forUpdate()
        .first()
      if (!del) throw new Error('Delivery not found')
      if (del.status === 'delivered') throw new Error('Delivery already completed')
      if (del.status === 'cancelled') throw new Error('Delivery was cancelled')
      if (!['assigned', 'picked_up', 'in_transit'].includes(del.status)) {
        throw new Error(`Cannot complete a delivery in status '${del.status}'`)
      }

      // QR confirmation — only enforced when a token was issued (assigned).
      if (del.qr_token) {
        if (!input.scannedQrToken || input.scannedQrToken !== del.qr_token) {
          throw new Error('QR token mismatch — cannot confirm delivery')
        }
      }

      const codAmount = Number(del.cod_amount) || 0
      const codPaymentMethod = input.codPaymentMethod ?? 'cash'

      // Settle the invoice (paid) — no cash_movement here.
      if (del.invoice_id) {
        const inv: any = await trx
          .from('invoices')
          .where('id', del.invoice_id)
          .where('tenant_id', tenantId)
          .where('company_id', companyId)
          .forUpdate()
          .first()
        if (inv && inv.status !== 'cancelled') {
          const total = Number(inv.total) || 0
          await trx.from('invoices').where('id', inv.id).update({
            paid_amount: total,
            remaining_amount: 0,
            status: 'paid',
            paid_at: now(),
            payment_method: codPaymentMethod,
            updated_at: now(),
          })
          // Settle the linked client_credit + decrement the client balance.
          const credit: any = await trx
            .from('client_credits')
            .where('invoice_id', inv.id)
            .where('tenant_id', tenantId)
            .where('company_id', companyId)
            .forUpdate()
            .first()
          if (credit && credit.status !== 'cancelled') {
            const settle = Number(credit.remaining_amount) || 0
            await trx
              .from('client_credits')
              .where('id', credit.id)
              .update({
                amount_paid: trx.raw('amount_paid + ?', [settle]),
                remaining_amount: 0,
                status: 'paid',
                updated_at: now(),
              })
            if (credit.client_id) {
              await trx
                .from('clients')
                .where('id', credit.client_id)
                .where('tenant_id', tenantId)
                .where('company_id', companyId)
                .update({
                  current_credit: trx.raw('GREATEST(0, current_credit - ?)', [settle]),
                  updated_at: now(),
                })
            }
          }
        }
      }

      await trx.from('deliveries').where('id', deliveryId).update({
        status: 'delivered',
        delivered_at: now(),
        cod_amount: codAmount,
        cod_payment_method: codPaymentMethod,
        cod_collected: true,
        updated_at: now(),
      })

      await this.logEvent(trx, { tenantId, companyId }, deliveryId, 'status_change', {
        driverUserId: userId,
        status: 'delivered',
        note: `Delivered (COD ${codPaymentMethod})`,
      })
      await AuditService.log(
        ctx,
        {
          action: 'update',
          entity: 'delivery',
          entityId: deliveryId,
          after: { status: 'delivered', codAmount, codPaymentMethod },
        },
        { client: trx }
      )
      return { id: deliveryId, status: 'delivered', codAmount, codPaymentMethod }
    })
  },

  /** Mark a delivery as failed (undelivered). */
  async fail(ctx: HttpContext, deliveryId: number, reason: string) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId
    if (!companyId) throw new Error('No company context')
    const userId = ctx.auth.user?.id ?? null

    return db.transaction(async (trx) => {
      const del: any = await trx
        .from('deliveries')
        .where('id', deliveryId)
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .forUpdate()
        .first()
      if (!del) throw new Error('Delivery not found')
      if (['delivered', 'cancelled'].includes(del.status)) {
        throw new Error(`Cannot fail a delivery in status '${del.status}'`)
      }
      await trx.from('deliveries').where('id', deliveryId).update({
        status: 'failed',
        failure_reason: reason,
        updated_at: now(),
      })
      await this.logEvent(trx, { tenantId, companyId }, deliveryId, 'status_change', {
        driverUserId: userId,
        status: 'failed',
        note: reason,
      })
      await AuditService.log(
        ctx,
        {
          action: 'update',
          entity: 'delivery',
          entityId: deliveryId,
          after: { status: 'failed', reason },
        },
        { client: trx }
      )
      return { id: deliveryId, status: 'failed' }
    })
  },

  /** Cancel a delivery (only if pending/assigned). Does NOT reverse the invoice. */
  async cancel(ctx: HttpContext, deliveryId: number) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId
    if (!companyId) throw new Error('No company context')
    const userId = ctx.auth.user?.id ?? null

    return db.transaction(async (trx) => {
      const del: any = await trx
        .from('deliveries')
        .where('id', deliveryId)
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .forUpdate()
        .first()
      if (!del) throw new Error('Delivery not found')
      if (!['pending', 'assigned'].includes(del.status)) {
        throw new Error(`Cannot cancel a delivery in status '${del.status}'`)
      }
      await trx.from('deliveries').where('id', deliveryId).update({
        status: 'cancelled',
        updated_at: now(),
      })
      await this.logEvent(trx, { tenantId, companyId }, deliveryId, 'status_change', {
        driverUserId: userId,
        status: 'cancelled',
        note: 'Cancelled',
      })
      await AuditService.log(
        ctx,
        {
          action: 'delete',
          entity: 'delivery',
          entityId: deliveryId,
          before: { status: del.status },
          after: { status: 'cancelled' },
        },
        { client: trx }
      )
      return { id: deliveryId, status: 'cancelled' }
    })
  },

  /** Sum the COD of a driver's delivered-but-unsettled deliveries. */
  async computeExpectedCod(trx: any, tenantId: number, companyId: number, driverUserId: number) {
    const rows = await trx
      .from('deliveries')
      .where('tenant_id', tenantId)
      .where('company_id', companyId)
      .where('driver_user_id', driverUserId)
      .where('status', 'delivered')
      .whereNull('settlement_id')
    const deliveries = rows as any[]
    const expectedCod = deliveries.reduce((sum, d) => sum + (Number(d.cod_amount) || 0), 0)
    return { deliveries, count: deliveries.length, expectedCod }
  },

  /** Open + submit a settlement for a driver (computes expected_cod). */
  async createSettlement(
    ctx: HttpContext,
    input: {
      driverUserId?: number | null
      actualCash?: number | null
      actualMobile?: number | null
      notes?: string | null
    }
  ) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId
    if (!companyId) throw new Error('No company context')
    const userId = ctx.auth.user?.id ?? null
    const driverUserId = input.driverUserId ?? userId
    if (!driverUserId) throw new Error('Driver is required')

    return db.transaction(async (trx) => {
      const driver: any = await trx
        .from('users')
        .where('id', driverUserId)
        .where('tenant_id', tenantId)
        .first()
      const { count, expectedCod } = await this.computeExpectedCod(
        trx,
        tenantId,
        companyId,
        driverUserId
      )
      if (count === 0) throw new Error('No delivered deliveries to settle for this driver')

      const actualCash = input.actualCash ?? 0
      const actualMobile = input.actualMobile ?? 0
      const difference = expectedCod - actualCash - actualMobile
      const status = input.actualCash != null || input.actualMobile != null ? 'submitted' : 'open'

      const [row] = await trx
        .table('driver_settlements')
        .insert({
          tenant_id: tenantId,
          company_id: companyId,
          driver_user_id: driverUserId,
          driver_name: driver?.full_name ?? null,
          status,
          period_start: null,
          period_end: now(),
          deliveries_count: count,
          expected_cod: expectedCod,
          actual_cash: actualCash,
          actual_mobile: actualMobile,
          difference,
          validated_by_user_id: null,
          validated_at: null,
          notes: input.notes ?? null,
          created_at: now(),
          updated_at: now(),
        })
        .returning('id')
      const settlementId = Number((row as any).id)

      await AuditService.log(
        ctx,
        {
          action: 'create',
          entity: 'driver_settlement',
          entityId: settlementId,
          after: { driverUserId, expectedCod, actualCash, actualMobile, difference, status },
        },
        { client: trx }
      )
      return {
        id: settlementId,
        driverUserId,
        deliveriesCount: count,
        expectedCod,
        actualCash,
        actualMobile,
        difference,
        status,
      }
    })
  },

  /** Admin validates a submitted settlement. On a clean (zero) difference, the
   *  cash portion enters the main register as a cash_movement 'in' and the
   *  covered deliveries are marked settled. Non-zero -> 'discrepancy'. */
  async validateSettlement(
    ctx: HttpContext,
    settlementId: number,
    input: { actualCash?: number | null; actualMobile?: number | null; notes?: string | null }
  ) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId
    if (!companyId) throw new Error('No company context')
    const userId = ctx.auth.user?.id ?? null

    return db.transaction(async (trx) => {
      const st: any = await trx
        .from('driver_settlements')
        .where('id', settlementId)
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .forUpdate()
        .first()
      if (!st) throw new Error('Settlement not found')
      if (st.status === 'validated') throw new Error('Settlement already validated')

      const actualCash = input.actualCash != null ? input.actualCash : Number(st.actual_cash) || 0
      const actualMobile =
        input.actualMobile != null ? input.actualMobile : Number(st.actual_mobile) || 0
      const expectedCod = Number(st.expected_cod) || 0
      const difference = expectedCod - actualCash - actualMobile

      if (difference === 0) {
        // Clean: the cash portion enters the register now.
        if (actualCash > 0) {
          await CashService.recordCashIn(trx, ctx, {
            amount: actualCash,
            category: 'delivery_cod',
            description: `Driver settlement #${st.id} — COD cash`,
            referenceType: 'driver_settlement',
            referenceId: st.id,
          })
        }
        // Mark the driver's oldest delivered+unsettled deliveries as settled.
        const { deliveries } = await this.computeExpectedCod(
          trx,
          tenantId,
          companyId,
          Number(st.driver_user_id)
        )
        for (const d of deliveries) {
          await trx
            .from('deliveries')
            .where('id', d.id)
            .update({ settlement_id: settlementId, updated_at: now() })
        }
        await trx
          .from('driver_settlements')
          .where('id', settlementId)
          .update({
            actual_cash: actualCash,
            actual_mobile: actualMobile,
            difference: 0,
            status: 'validated',
            validated_by_user_id: userId,
            validated_at: now(),
            notes: input.notes ?? st.notes,
            updated_at: now(),
          })
      } else {
        await trx
          .from('driver_settlements')
          .where('id', settlementId)
          .update({
            actual_cash: actualCash,
            actual_mobile: actualMobile,
            difference,
            status: 'discrepancy',
            notes: input.notes ?? st.notes,
            updated_at: now(),
          })
      }

      await AuditService.log(
        ctx,
        {
          action: 'update',
          entity: 'driver_settlement',
          entityId: settlementId,
          after: { status: difference === 0 ? 'validated' : 'discrepancy', difference },
        },
        { client: trx }
      )
      return {
        id: settlementId,
        status: difference === 0 ? 'validated' : 'discrepancy',
        difference,
        actualCash,
        actualMobile,
      }
    })
  },
}

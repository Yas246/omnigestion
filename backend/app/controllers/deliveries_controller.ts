import Delivery from '#models/delivery'
import DeliveryEvent from '#models/delivery_event'
import DriverSettlement from '#models/driver_settlement'
import CompanyMembership from '#models/company_membership'
import User from '#models/user'
import { DeliveryService } from '#services/delivery_service'
import {
  createDeliveryValidator,
  assignDeliveryValidator,
  updatePositionValidator,
  completeDeliveryValidator,
  failDeliveryValidator,
  createSettlementValidator,
  validateSettlementValidator,
} from '#validators/delivery'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

/**
 * Deliveries — dispatcher (ERP /deliveries) + driver (app /livreur) endpoints.
 * Every mutating action delegates to DeliveryService (transactional). Reads use
 * Delivery.forContext(ctx) so they are scoped to the current tenant+company.
 */
export default class DeliveriesController {
  /** List deliveries (optional ?status=, ?driver=, ?mine=1 for the driver app). */
  async index(ctx: HttpContext) {
    const status = ctx.request.input('status') as string | undefined
    let q = Delivery.forContext(ctx).orderBy('createdAt', 'desc').limit(300)
    if (status) q = q.where('status', status)
    if (ctx.request.input('mine') === '1') {
      const userId = ctx.auth.user?.id
      if (userId) q = q.where('driverUserId', userId)
    }
    const driverFilter = ctx.request.input('driver') as string | undefined
    if (driverFilter) q = q.where('driverUserId', Number(driverFilter))
    const deliveries = await q
    return deliveries.map((d) => this.mapDelivery(d))
  }

  /** The driver's own deliveries (active + history). */
  async mine(ctx: HttpContext) {
    const userId = ctx.auth.user?.id
    if (!userId) return []
    const deliveries = await Delivery.forContext(ctx)
      .where('driverUserId', userId)
      .orderBy('createdAt', 'desc')
      .limit(200)
    return deliveries.map((d) => this.mapDelivery(d))
  }

  async show(ctx: HttpContext) {
    const delivery = await Delivery.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    const events = await DeliveryEvent.forContext(ctx)
      .where('deliveryId', delivery.id)
      .orderBy('recordedAt', 'desc')
      .limit(200)
    return { ...this.mapDelivery(delivery), events: events.map((e) => e.toJSON()) }
  }

  /** Dispatcher creates a delivery from a storefront invoice. */
  async store(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(createDeliveryValidator)
    try {
      const result = await DeliveryService.createFromInvoice(ctx, Number(data.invoiceId), {
        deliveryAddressId: data.deliveryAddressId ?? null,
        address: data.address ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        city: data.city ?? null,
      })
      return ctx.response.created(result)
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  async assign(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(assignDeliveryValidator)
    try {
      return await DeliveryService.assign(ctx, Number(ctx.params.id), Number(data.driverUserId))
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  async pickup(ctx: HttpContext) {
    try {
      return await DeliveryService.pickup(ctx, Number(ctx.params.id))
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  async start(ctx: HttpContext) {
    try {
      return await DeliveryService.start(ctx, Number(ctx.params.id))
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  async complete(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(completeDeliveryValidator)
    try {
      return await DeliveryService.complete(ctx, Number(ctx.params.id), {
        scannedQrToken: data.scannedQrToken ?? null,
        codPaymentMethod: data.codPaymentMethod ?? null,
      })
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  async fail(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(failDeliveryValidator)
    try {
      return await DeliveryService.fail(ctx, Number(ctx.params.id), data.reason)
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  async cancel(ctx: HttpContext) {
    try {
      return await DeliveryService.cancel(ctx, Number(ctx.params.id))
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  /** Driver posts a live position. */
  async updatePosition(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(updatePositionValidator)
    try {
      return await DeliveryService.updatePosition(
        ctx,
        Number(ctx.params.id),
        data.latitude,
        data.longitude
      )
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  /** Latest position of every in_transit delivery (for the dispatch map). */
  async live(ctx: HttpContext) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId as number
    const deliveries = await db
      .from('deliveries')
      .where('tenant_id', tenantId)
      .where('company_id', companyId)
      .whereIn('status', ['assigned', 'picked_up', 'in_transit'])
      .select(
        'id',
        'driver_user_id',
        'driver_name',
        'client_name',
        'status',
        'delivery_address',
        'delivery_latitude',
        'delivery_longitude'
      )

    const ids = deliveries.map((d: any) => d.id)
    if (ids.length === 0) return []
    // Last known position per delivery.
    const positions = await db
      .from('delivery_events')
      .where('tenant_id', tenantId)
      .where('company_id', companyId)
      .where('type', 'location')
      .whereIn('delivery_id', ids)
      .orderBy('recorded_at', 'desc')
    const lastByDelivery = new Map<number, any>()
    for (const p of positions) {
      if (!lastByDelivery.has(p.delivery_id)) lastByDelivery.set(p.delivery_id, p)
    }
    return deliveries.map((d: any) => {
      const p = lastByDelivery.get(d.id)
      return {
        id: d.id,
        driverUserId: d.driver_user_id,
        driverName: d.driver_name,
        clientName: d.client_name,
        status: d.status,
        destination: {
          address: d.delivery_address,
          latitude: d.delivery_latitude,
          longitude: d.delivery_longitude,
        },
        position: p
          ? {
              latitude: Number(p.latitude),
              longitude: Number(p.longitude),
              recordedAt: p.recorded_at,
            }
          : null,
      }
    })
  }

  /** Storefront invoices that have no delivery yet (the "À attribuer" picker). */
  async pendingInvoices(ctx: HttpContext) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId as number
    const rows = await db
      .from('invoices')
      .where('tenant_id', tenantId)
      .where('company_id', companyId)
      .where('channel', 'store')
      .where('status', '!=', 'cancelled')
      .whereNotIn('id', (builder) => {
        builder
          .from('deliveries')
          .where('tenant_id', tenantId)
          .where('company_id', companyId)
          .whereNotIn('status', ['cancelled'])
          .select('invoice_id')
      })
      .orderBy('sale_date', 'desc')
      .limit(100)
      .select(
        'id',
        'invoice_number',
        'client_name',
        'total',
        'remaining_amount',
        'status',
        'sale_date'
      )
    return rows.map((r: any) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      clientName: r.client_name,
      total: Number(r.total ?? 0),
      codAmount: Number(r.remaining_amount ?? r.total ?? 0),
      status: r.status,
      date: r.sale_date,
    }))
  }

  /** Employees who can act as drivers (have any `deliveries` permission). */
  async drivers(ctx: HttpContext) {
    const companyId = ctx.companyId as number
    const memberships = await CompanyMembership.query()
      .where('tenant_id', ctx.tenantId)
      .where('company_id', companyId)
    const driverMemberships = memberships.filter((m: any) => {
      const perms = m.permissions ?? []
      return Array.isArray(perms) && perms.some((p: any) => p?.module === 'deliveries')
    })
    const userIds = driverMemberships.map((m) => m.userId)
    const users = userIds.length ? await User.query().whereIn('id', userIds) : []
    const userById = new Map(users.map((u) => [u.id, u]))
    // The owner is also a valid dispatcher/driver fallback.
    const owners = await User.query().where('tenant_id', ctx.tenantId).where('is_owner', true)
    for (const o of owners) {
      if (!userById.has(o.id)) userById.set(o.id, o)
    }
    return [...userById.values()].map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      isOwner: u.isOwner,
    }))
  }

  /** Per-driver performance (deliveries + COD collected + settlement gaps). */
  async performance(ctx: HttpContext) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId as number
    const rows = await db
      .from('deliveries')
      .where('tenant_id', tenantId)
      .where('company_id', companyId)
      .whereNotNull('driver_user_id')
      .select(
        'driver_user_id',
        'driver_name',
        db.raw('count(*) as total'),
        db.raw("SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered"),
        db.raw("SUM(CASE WHEN status = 'delivered' THEN cod_amount ELSE 0 END) as cod"),
        // Livraisons livrées mais PAS encore soldées (settlement_id IS NULL) :
        // c'est le "à régulariser" affiché par livreur pour la clôture de tournée.
        db.raw(
          "SUM(CASE WHEN status = 'delivered' AND settlement_id IS NULL THEN 1 ELSE 0 END) as unsettled"
        ),
        db.raw(
          "SUM(CASE WHEN status = 'delivered' AND settlement_id IS NULL THEN cod_amount ELSE 0 END) as unsettled_cod"
        )
      )
      .groupBy('driver_user_id', 'driver_name')
      .orderBy('cod', 'desc')
    return rows.map((r: any) => ({
      driverUserId: r.driver_user_id,
      driverName: r.driver_name,
      total: Number(r.total ?? 0),
      delivered: Number(r.delivered ?? 0),
      cod: Number(r.cod ?? 0),
      unsettledCount: Number(r.unsettled ?? 0),
      unsettledCod: Number(r.unsettled_cod ?? 0),
    }))
  }

  /** List settlements. */
  async settlements(ctx: HttpContext) {
    const status = ctx.request.input('status') as string | undefined
    let q = DriverSettlement.forContext(ctx).orderBy('createdAt', 'desc').limit(100)
    if (status) q = q.where('status', status)
    const settlements = await q
    return settlements.map((s) => this.mapSettlement(s))
  }

  async settlementCreate(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(createSettlementValidator)
    try {
      const result = await DeliveryService.createSettlement(ctx, {
        driverUserId: data.driverUserId ?? null,
        actualCash: data.actualCash ?? null,
        actualMobile: data.actualMobile ?? null,
        notes: data.notes ?? null,
      })
      return ctx.response.created(result)
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  async settlementValidate(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(validateSettlementValidator)
    try {
      return await DeliveryService.validateSettlement(ctx, Number(ctx.params.id), {
        actualCash: data.actualCash ?? null,
        actualMobile: data.actualMobile ?? null,
        notes: data.notes ?? null,
      })
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  private mapDelivery(d: Delivery) {
    return {
      id: d.id,
      invoiceId: d.invoiceId,
      clientId: d.clientId,
      clientName: d.clientName,
      driverUserId: d.driverUserId,
      driverName: d.driverName,
      status: d.status,
      address: d.deliveryAddress,
      latitude: d.deliveryLatitude,
      longitude: d.deliveryLongitude,
      city: d.deliveryCity,
      scheduledAt: d.scheduledAt,
      assignedAt: d.assignedAt,
      pickedUpAt: d.pickedUpAt,
      deliveredAt: d.deliveredAt,
      codAmount: Number(d.codAmount ?? 0),
      codPaymentMethod: d.codPaymentMethod,
      codCollected: d.codCollected,
      // qrToken is deliberately OMITTED from the API response: the driver must
      // scan the buyer's QR to confirm delivery. Exposing the token here would
      // let them forge confirmation without ever meeting the customer. The
      // token stays server-side (delivery.qr_token) for the complete() check.
      failureReason: d.failureReason,
      createdAt: d.createdAt,
    }
  }

  private mapSettlement(s: DriverSettlement) {
    return {
      id: s.id,
      driverUserId: s.driverUserId,
      driverName: s.driverName,
      status: s.status,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      deliveriesCount: s.deliveriesCount,
      expectedCod: Number(s.expectedCod ?? 0),
      actualCash: Number(s.actualCash ?? 0),
      actualMobile: Number(s.actualMobile ?? 0),
      difference: Number(s.difference ?? 0),
      validatedAt: s.validatedAt,
      notes: s.notes,
      createdAt: s.createdAt,
    }
  }
}

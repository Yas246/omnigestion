import StoreAccount from '#models/store_account'
import DeliveryAddress from '#models/delivery_address'
import { Secret } from '@adonisjs/core/helpers'
import { addressValidator } from '#validators/delivery'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

/**
 * Buyer (storefront) account — orders + delivery status, QR code, and the
 * global address book. Authenticated by the buyer's Bearer access token
 * (`sat_…`), exactly like PublicCommerceController.verifyBuyer. No ERP auth /
 * tenancy middleware — these routes are public, scoped to the StoreAccount.
 */
export default class PublicDeliveryController {
  /** Resolve the buyer from the Authorization header, or null. */
  private async verifyBuyer(ctx: HttpContext): Promise<StoreAccount | null> {
    const header = ctx.request.header('authorization')
    if (!header?.startsWith('Bearer ')) return null
    const tokenValue = header.slice(7)
    try {
      const token = await StoreAccount.accessTokens.verify(new Secret(tokenValue))
      if (!token) return null
      return await StoreAccount.find(token.tokenableId)
    } catch {
      return null
    }
  }

  private async requireBuyer(ctx: HttpContext): Promise<StoreAccount | null> {
    const buyer = await this.verifyBuyer(ctx)
    if (!buyer) {
      ctx.response.unauthorized({ message: 'Connectez-vous pour accéder à votre compte' })
      return null
    }
    return buyer
  }

  /** Buyer profile. */
  async account(ctx: HttpContext) {
    const buyer = await this.requireBuyer(ctx)
    if (!buyer) return
    return { id: buyer.id, email: buyer.email, fullName: buyer.fullName, phone: buyer.phone }
  }

  /** Buyer's storefront orders (all merchants) + their delivery status. */
  async orders(ctx: HttpContext) {
    const buyer = await this.requireBuyer(ctx)
    if (!buyer) return
    // invoices tied to this buyer via clients.store_account_id, channel='store'.
    const invoices = await db
      .from('invoices')
      .join('clients', 'clients.id', 'invoices.client_id')
      .where('clients.store_account_id', buyer.id)
      .where('invoices.channel', 'store')
      .where('invoices.status', '!=', 'cancelled')
      .orderBy('invoices.sale_date', 'desc')
      .limit(100)
      .select(
        'invoices.id',
        'invoices.invoice_number',
        'invoices.company_id',
        'invoices.total',
        'invoices.status',
        'invoices.sale_date',
        'invoices.client_name'
      )

    const invoiceIds = invoices.map((r: any) => r.id)
    const deliveries = invoiceIds.length
      ? await db
          .from('deliveries')
          .whereIn('invoice_id', invoiceIds)
          .whereNotIn('status', ['cancelled'])
      : []
    const deliveryByInvoice = new Map<number, any>()
    for (const d of deliveries) deliveryByInvoice.set(d.invoice_id, d)

    return invoices.map((r: any) => {
      const d = deliveryByInvoice.get(r.id)
      return {
        id: r.id,
        invoiceNumber: r.invoice_number,
        companyId: r.company_id,
        clientName: r.client_name,
        total: Number(r.total ?? 0),
        status: r.status,
        date: r.sale_date,
        delivery: d
          ? {
              id: d.id,
              status: d.status,
              driverName: d.driver_name,
              address: d.delivery_address,
              deliveredAt: d.delivered_at,
              hasQr: !!d.qr_token,
            }
          : null,
      }
    })
  }

  /** QR confirmation token for an order's delivery (buyer displays the QR). */
  async orderQr(ctx: HttpContext) {
    const buyer = await this.requireBuyer(ctx)
    if (!buyer) return
    const orderId = Number(ctx.params.orderId)
    // Ownership check: the invoice must belong to a client of this buyer.
    const owned = await db
      .from('invoices')
      .join('clients', 'clients.id', 'invoices.client_id')
      .where('invoices.id', orderId)
      .where('clients.store_account_id', buyer.id)
      .first()
    if (!owned) return ctx.response.notFound({ message: 'Commande introuvable' })

    const delivery = await db
      .from('deliveries')
      .where('invoice_id', orderId)
      .whereNotIn('status', ['cancelled'])
      .first()
    if (!delivery) return ctx.response.notFound({ message: 'Aucune livraison pour cette commande' })
    if (!delivery.qr_token) {
      return {
        deliveryId: delivery.id,
        qrToken: null,
        status: delivery.status,
        message: 'Livraison non encore attribuée',
      }
    }
    return { deliveryId: delivery.id, qrToken: delivery.qr_token, status: delivery.status }
  }

  /** List the buyer's saved addresses. */
  async addresses(ctx: HttpContext) {
    const buyer = await this.requireBuyer(ctx)
    if (!buyer) return
    const addresses = await DeliveryAddress.query()
      .where('storeAccountId', buyer.id)
      .orderBy('isDefault', 'desc')
      .orderBy('createdAt', 'desc')
    return addresses.map((a) => this.mapAddress(a))
  }

  async createAddress(ctx: HttpContext) {
    const buyer = await this.requireBuyer(ctx)
    if (!buyer) return
    const data = await ctx.request.validateUsing(addressValidator)
    return db.transaction(async (trx) => {
      if (data.isDefault) {
        await trx
          .from('delivery_addresses')
          .where('store_account_id', buyer.id)
          .update({ is_default: false })
      }
      const [row] = await trx
        .table('delivery_addresses')
        .insert({
          store_account_id: buyer.id,
          label: data.label,
          recipient_name: data.recipientName ?? null,
          address: data.address,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          city: data.city ?? null,
          is_default: data.isDefault ?? false,
          notes: data.notes ?? null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id')
      // Mirror the address onto the buyer's ERP client records (one per company
      // they've bought from) so the dispatcher/driver sees it in Clientèle.
      // ONLY the default address is mirrored — a non-default address must never
      // overwrite the client's main address.
      if (data.isDefault) {
        const clientAddress = [data.address, data.city].filter(Boolean).join(', ') || data.address
        await trx
          .from('clients')
          .where('store_account_id', buyer.id)
          .update({ address: clientAddress, updated_at: new Date() })
      }
      // Build the response from the validated data directly — do NOT re-fetch
      // via DeliveryAddress.find(): that runs outside this uncommitted
      // transaction and would not see the new row (returns null -> 500).
      return {
        id: Number((row as any).id),
        label: data.label,
        recipientName: data.recipientName ?? null,
        address: data.address,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        city: data.city ?? null,
        isDefault: data.isDefault ?? false,
        notes: data.notes ?? null,
      }
    })
  }

  async updateAddress(ctx: HttpContext) {
    const buyer = await this.requireBuyer(ctx)
    if (!buyer) return
    const data = await ctx.request.validateUsing(addressValidator)
    const address = await DeliveryAddress.query()
      .where('storeAccountId', buyer.id)
      .where('id', ctx.params.id)
      .first()
    if (!address) return ctx.response.notFound({ message: 'Adresse introuvable' })
    return db.transaction(async (trx) => {
      if (data.isDefault) {
        await trx
          .from('delivery_addresses')
          .where('store_account_id', buyer.id)
          .whereNot('id', address.id)
          .update({ is_default: false })
      }
      address.useTransaction(trx).merge({
        label: data.label,
        recipientName: data.recipientName ?? null,
        address: data.address,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        city: data.city ?? null,
        isDefault: data.isDefault ?? false,
        notes: data.notes ?? null,
      })
      await address.save()
      // Keep the client record in sync when this becomes the default address.
      if (data.isDefault) {
        const clientAddress = [data.address, data.city].filter(Boolean).join(', ') || data.address
        await trx
          .from('clients')
          .where('store_account_id', buyer.id)
          .update({ address: clientAddress, updated_at: new Date() })
      }
      return this.mapAddress(address)
    })
  }

  async deleteAddress(ctx: HttpContext) {
    const buyer = await this.requireBuyer(ctx)
    if (!buyer) return
    const address = await DeliveryAddress.query()
      .where('storeAccountId', buyer.id)
      .where('id', ctx.params.id)
      .first()
    if (!address) return ctx.response.notFound({ message: 'Adresse introuvable' })
    const wasDefault = address.isDefault
    return db.transaction(async (trx) => {
      address.useTransaction(trx).delete()
      // If we removed the default, promote the most recent remaining address
      // and keep the client record in sync with the new default.
      if (wasDefault) {
        const next = await DeliveryAddress.query({ client: trx })
          .where('storeAccountId', buyer.id)
          .orderBy('createdAt', 'desc')
          .first()
        if (next) {
          next.isDefault = true
          await next.save()
          const clientAddress = [next.address, next.city].filter(Boolean).join(', ') || next.address
          await trx
            .from('clients')
            .where('store_account_id', buyer.id)
            .update({ address: clientAddress, updated_at: new Date() })
        } else {
          // No address left — clear the mirrored address on the client record.
          await trx
            .from('clients')
            .where('store_account_id', buyer.id)
            .update({ address: null, updated_at: new Date() })
        }
      }
      return ctx.response.noContent()
    })
  }

  private mapAddress(a: DeliveryAddress) {
    return {
      id: a.id,
      label: a.label,
      recipientName: a.recipientName,
      address: a.address,
      latitude: a.latitude,
      longitude: a.longitude,
      city: a.city,
      isDefault: a.isDefault,
      notes: a.notes,
    }
  }
}

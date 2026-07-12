import Company from '#models/company'
import Product from '#models/product'
import Client from '#models/client'
import StoreAccount from '#models/store_account'
import ProductReview from '#models/product_review'
import { InvoiceService } from '#services/invoice_service'
import { Secret } from '@adonisjs/core/helpers'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * PUBLIC commerce endpoints (buyer auth + checkout + reviews).
 * No ERP auth middleware — buyer tokens verified manually.
 */
export default class PublicCommerceController {
  /** Verify the buyer's Bearer token → StoreAccount | null */
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

  /** POST /public/store/:slug/checkout — create invoice via InvoiceService. */
  async checkout(ctx: HttpContext) {
    const slug = ctx.params.slug as string
    const company = await Company.query()
      .where('store_slug', slug)
      .where('store_enabled', true)
      .first()
    if (!company) return ctx.response.notFound({ message: 'Boutique introuvable' })

    const buyer = await this.verifyBuyer(ctx)
    if (!buyer) return ctx.response.unauthorized({ message: 'Connectez-vous pour commander' })

    const body = ctx.request.body()
    const items: Array<{ productId: number; quantity: number }> = body.items ?? []
    if (items.length === 0) return ctx.response.badRequest({ message: 'Panier vide' })

    // Set the company context manually (no tenancy middleware on public routes)
    ctx.tenantId = company.tenantId
    ctx.companyId = company.id

    // Find-or-create the buyer as a client in this company
    const phone = buyer.phone ?? buyer.email
    let client = await Client.query()
      .where('tenant_id', company.tenantId)
      .where('company_id', company.id)
      .where('phone', phone)
      .first()
    if (!client) {
      client = await Client.create({
        tenantId: company.tenantId,
        companyId: company.id,
        name: buyer.fullName ?? buyer.email,
        phone,
        storeAccountId: buyer.id,
      })
    }

    // Build invoice items (look up products for price + validation)
    const productIds = items.map((i) => i.productId)
    const products = await Product.query()
      .where('tenant_id', company.tenantId)
      .where('company_id', company.id)
      .whereIn('id', productIds)
      .where('published', true)
      .whereNull('deleted_at')
    const productById = new Map(products.map((p) => [p.id, p]))

    const invoiceItems = items.map((item) => {
      const p = productById.get(item.productId)
      if (!p) throw new Error(`Produit ${item.productId} introuvable ou non publié`)
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(p.retailPrice),
      }
    })

    // Create the sale via InvoiceService (atomic: stock + cash + client stats)
    try {
      const result = await InvoiceService.create(ctx, {
        clientId: client.id,
        clientName: client.name,
        items: invoiceItems,
        paymentMethod: 'credit', // unpaid — the merchant confirms payment
        channel: 'store',
      })
      return ctx.response.created({
        invoice: result,
        message: 'Commande passée avec succès',
      })
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  /** GET /public/store/:slug/product/:productId/reviews */
  async reviews(ctx: HttpContext) {
    const productId = Number(ctx.params.productId)
    const reviews = await ProductReview.query()
      .where('product_id', productId)
      .orderBy('created_at', 'desc')

    // Enrich with buyer name
    const accountIds = [...new Set(reviews.map((r) => r.storeAccountId))]
    const accounts = accountIds.length
      ? await StoreAccount.query().whereIn('id', accountIds)
      : []
    const nameById = new Map(accounts.map((a) => [a.id, a.fullName ?? a.email]))

    const avg = reviews.length
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0

    return {
      avg: Math.round(avg * 10) / 10,
      count: reviews.length,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        author: nameById.get(r.storeAccountId) ?? 'Anonyme',
        createdAt: r.createdAt,
      })),
    }
  }

  /** POST /public/store/:slug/product/:productId/reviews — buyer must be authenticated */
  async addReview(ctx: HttpContext) {
    const buyer = await this.verifyBuyer(ctx)
    if (!buyer) return ctx.response.unauthorized({ message: 'Connectez-vous pour laisser un avis' })

    const company = await Company.query()
      .where('store_slug', ctx.params.slug)
      .where('store_enabled', true)
      .first()
    if (!company) return ctx.response.notFound({ message: 'Boutique introuvable' })

    const body = ctx.request.body()
    const rating = Number(body.rating)
    if (!rating || rating < 1 || rating > 5) {
      return ctx.response.badRequest({ message: 'Note invalide (1-5)' })
    }

    // Check for existing review (one per buyer per product)
    const existing = await ProductReview.query()
      .where('product_id', Number(ctx.params.productId))
      .where('store_account_id', buyer.id)
      .first()
    if (existing) {
      return ctx.response.conflict({ message: 'Vous avez déjà laissé un avis sur ce produit' })
    }

    ctx.tenantId = company.tenantId
    ctx.companyId = company.id

    const review = await ProductReview.create({
      tenantId: company.tenantId,
      companyId: company.id,
      productId: Number(ctx.params.productId),
      storeAccountId: buyer.id,
      rating,
      comment: body.comment ?? null,
    })

    return ctx.response.created({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      author: buyer.fullName ?? buyer.email,
    })
  }
}

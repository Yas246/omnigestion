import Company from '#models/company'
import Product from '#models/product'
import ProductImage from '#models/product_image'
import Storefront from '#models/storefront'
import { StorefrontService } from '#services/storefront_service'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * PUBLIC storefront (no auth). Resolved by `store_slug`. Serves the published
 * config + the company's published products (with their image gallery).
 * 404 if the slug doesn't exist or the store is disabled.
 */
export default class PublicStoreController {
  async show(ctx: HttpContext) {
    const slug = ctx.params.slug as string
    const company = await Company.query()
      .where('store_slug', slug)
      .where('store_enabled', true)
      .first()
    if (!company) return ctx.response.notFound({ message: 'Boutique introuvable ou désactivée' })

    const sf = await Storefront.query().where('company_id', company.id).first()
    const config = StorefrontService.withDefaults(sf?.publishedConfig ?? null)

    const products = await Product.query()
      .where('tenant_id', company.tenantId)
      .where('company_id', company.id)
      .where('published', true)
      .whereNull('deleted_at')
      .orderBy('name', 'asc')

    const productIds = products.map((p) => p.id)
    const imagesByProduct = new Map<number, any[]>()
    if (productIds.length > 0) {
      const imgs = await ProductImage.query()
        .where('tenant_id', company.tenantId)
        .where('company_id', company.id)
        .whereIn('productId', productIds)
        .orderBy('position', 'asc')
      for (const im of imgs) {
        if (!imagesByProduct.has(im.productId)) imagesByProduct.set(im.productId, [])
        imagesByProduct.get(im.productId)!.push({ id: im.id, url: im.url, alt: im.alt, position: im.position })
      }
    }

    const productsJson = products.map((p) => {
      const j = p.toJSON()
      j.images = imagesByProduct.get(p.id) ?? []
      return j
    })

    return {
      company: {
        id: company.id,
        name: company.name,
        logoUrl: company.logoUrl,
        bannerUrl: company.bannerUrl,
        phone: company.phone,
        email: company.email,
        address: company.address,
        currency: company.currency,
        storeSlug: company.storeSlug,
      },
      config,
      products: productsJson,
    }
  }
}

import Product from '#models/product'
import ProductStockLocation from '#models/product_stock_location'
import { createProductValidator, updateProductValidator } from '#validators/product'
import { AuditService } from '#services/audit_service'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

export default class ProductsController {
  async index(ctx: HttpContext) {
    const page = Math.max(1, Number(ctx.request.input('page', 1)) || 1)
    const limit = Math.min(200, Math.max(1, Number(ctx.request.input('limit', 50)) || 50))
    const search = ctx.request.input('search') as string | undefined

    let query = Product.forContext(ctx).whereNull('deleted_at')
    if (search && search.trim().length >= 2) {
      const term = `%${search.trim().toLowerCase()}%`
      query = query.where((b) => {
        b.whereRaw('LOWER(name) LIKE ?', [term]).orWhereRaw('LOWER(code) LIKE ?', [term])
      })
    }

    const results = await query.orderBy('name', 'asc').paginate(page, limit)
    const productRows = results.all()
    const productIds = productRows.map((p) => p.id)

    // Fetch per-warehouse stock for all products on this page + warehouse names.
    let stockByProduct = new Map<number, any[]>()
    if (productIds.length > 0) {
      const locations = await db
        .from('product_stock_locations')
        .where('tenant_id', ctx.tenantId)
        .where('company_id', ctx.companyId ?? 0)
        .whereIn('product_id', productIds)

      const warehouseIds = [...new Set(locations.map((l: any) => l.warehouse_id))]
      const warehouses =
        warehouseIds.length > 0
          ? await db
              .from('warehouses')
              .where('tenant_id', ctx.tenantId)
              .where('company_id', ctx.companyId ?? 0)
              .whereIn('id', warehouseIds)
          : []
      const whNameById = new Map(warehouses.map((w: any) => [w.id, w.name]))

      for (const loc of locations) {
        const pid = loc.product_id
        if (!stockByProduct.has(pid)) stockByProduct.set(pid, [])
        stockByProduct.get(pid)!.push({
          warehouseId: String(loc.warehouse_id),
          warehouseName: whNameById.get(loc.warehouse_id) ?? '',
          quantity: Number(loc.quantity),
        })
      }
    }

    // Attach warehouseQuantities + displayQuantity to each product.
    const data = productRows.map((p) => {
      const json = p.toJSON()
      json.warehouseQuantities = stockByProduct.get(p.id) ?? []
      json.displayQuantity = Number(p.currentStock)
      return json
    })

    return { meta: results.toJSON().meta, data }
  }

  async show(ctx: HttpContext) {
    const product = await Product.forContext(ctx)
      .where('id', ctx.params.id)
      .whereNull('deleted_at')
      .firstOrFail()
    return product.toJSON()
  }

  async store(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(createProductValidator)
    const product = await Product.create(data)
    await AuditService.log(ctx, {
      action: 'create',
      entity: 'product',
      entityId: product.id,
      after: product.toJSON(),
    })
    return ctx.response.created(product.toJSON())
  }

  async update(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(updateProductValidator)
    const product = await Product.forContext(ctx)
      .where('id', ctx.params.id)
      .whereNull('deleted_at')
      .firstOrFail()
    const before = product.toJSON()
    product.merge(data)
    await product.save()
    await AuditService.log(ctx, {
      action: 'update',
      entity: 'product',
      entityId: product.id,
      before,
      after: product.toJSON(),
    })
    return product.toJSON()
  }

  async destroy(ctx: HttpContext) {
    const product = await Product.forContext(ctx)
      .where('id', ctx.params.id)
      .whereNull('deleted_at')
      .firstOrFail()
    const before = product.toJSON()
    product.deletedAt = DateTime.now()
    product.isActive = false
    await product.save()
    await AuditService.log(ctx, { action: 'delete', entity: 'product', entityId: product.id, before })
    return ctx.response.noContent()
  }

  /** Per-warehouse stock breakdown for a product. */
  async stock(ctx: HttpContext) {
    await Product.forContext(ctx).where('id', ctx.params.id).whereNull('deleted_at').firstOrFail()
    const locations = await ProductStockLocation.forContext(ctx)
      .where('productId', ctx.params.id)
      .orderBy('updatedAt', 'desc')
    return locations.map((l) => l.toJSON())
  }
}

import Supplier from '#models/supplier'
import { createSupplierValidator, updateSupplierValidator } from '#validators/supplier'
import { AuditService } from '#services/audit_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class SuppliersController {
  async index(ctx: HttpContext) {
    const page = Math.max(1, Number(ctx.request.input('page', 1)) || 1)
    const limit = Math.min(200, Math.max(1, Number(ctx.request.input('limit', 50)) || 50))
    const search = ctx.request.input('search') as string | undefined
    let query = Supplier.forContext(ctx)
    if (search && search.trim().length >= 2) {
      const term = `%${search.trim().toLowerCase()}%`
      query = query.where((b) => b.whereRaw('LOWER(name) LIKE ?', [term]).orWhereRaw('LOWER(code) LIKE ?', [term]))
    }
    const results = await query.orderBy('created_at', 'desc').paginate(page, limit)
    return results.toJSON()
  }

  async show(ctx: HttpContext) {
    const supplier = await Supplier.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    return supplier.toJSON()
  }

  async store(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(createSupplierValidator)
    const supplier = await Supplier.create(data)
    await AuditService.log(ctx, { action: 'create', entity: 'supplier', entityId: supplier.id, after: supplier.toJSON() })
    return ctx.response.created(supplier.toJSON())
  }

  async update(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(updateSupplierValidator)
    const supplier = await Supplier.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    const before = supplier.toJSON()
    supplier.merge(data)
    await supplier.save()
    await AuditService.log(ctx, { action: 'update', entity: 'supplier', entityId: supplier.id, before, after: supplier.toJSON() })
    return supplier.toJSON()
  }

  async destroy(ctx: HttpContext) {
    const supplier = await Supplier.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    const before = supplier.toJSON()
    await supplier.delete()
    await AuditService.log(ctx, { action: 'delete', entity: 'supplier', entityId: supplier.id, before })
    return ctx.response.noContent()
  }
}

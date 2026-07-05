import Client from '#models/client'
import { createClientValidator, updateClientValidator } from '#validators/client'
import { AuditService } from '#services/audit_service'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * CRUD for the Clients module — company-scoped business module #1.
 * Reads go through `Client.forContext(ctx)` (auto tenant+company filtered).
 * Writes rely on the base model's before:create hook for tenant+company.
 * Every mutation is recorded in the audit log.
 */
export default class ClientsController {
  async index(ctx: HttpContext) {
    const page = Math.max(1, Number(ctx.request.input('page', 1)) || 1)
    const limit = Math.min(200, Math.max(1, Number(ctx.request.input('limit', 50)) || 50))
    const search = ctx.request.input('search') as string | undefined

    let query = Client.forContext(ctx)
    if (search && search.trim().length >= 2) {
      const term = `%${search.trim().toLowerCase()}%`
      query = query.where((builder) => {
        builder.whereRaw('LOWER(name) LIKE ?', [term]).orWhereRaw('LOWER(code) LIKE ?', [term])
      })
    }

    const results = await query.orderBy('created_at', 'desc').paginate(page, limit)
    return results.toJSON()
  }

  async show(ctx: HttpContext) {
    const client = await Client.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    return client.toJSON()
  }

  async store(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(createClientValidator)
    const client = await Client.create(data)
    await AuditService.log(ctx, {
      action: 'create',
      entity: 'client',
      entityId: client.id,
      after: client.toJSON(),
    })
    return ctx.response.created(client.toJSON())
  }

  async update(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(updateClientValidator)
    const client = await Client.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    const before = client.toJSON()
    client.merge(data)
    await client.save()
    await AuditService.log(ctx, {
      action: 'update',
      entity: 'client',
      entityId: client.id,
      before,
      after: client.toJSON(),
    })
    return client.toJSON()
  }

  async destroy(ctx: HttpContext) {
    const client = await Client.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    const before = client.toJSON()
    await client.delete()
    await AuditService.log(ctx, {
      action: 'delete',
      entity: 'client',
      entityId: client.id,
      before,
    })
    return ctx.response.noContent()
  }
}

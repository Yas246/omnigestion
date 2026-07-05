import Purchase from '#models/purchase'
import PurchaseItem from '#models/purchase_item'
import { PurchaseService } from '#services/purchase_service'
import { createPurchaseValidator } from '#validators/purchase'
import type { HttpContext } from '@adonisjs/core/http'

export default class PurchasesController {
  async index(ctx: HttpContext) {
    const page = Math.max(1, Number(ctx.request.input('page', 1)) || 1)
    const limit = Math.min(200, Math.max(1, Number(ctx.request.input('limit', 50)) || 50))
    const status = ctx.request.input('status') as string | undefined
    let query = Purchase.forContext(ctx)
    if (status) query = query.where('status', status)
    const results = await query.orderBy('purchase_date', 'desc').paginate(page, limit)
    return results.toJSON()
  }

  async show(ctx: HttpContext) {
    const purchase = await Purchase.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    const items = await PurchaseItem.forContext(ctx).where('purchaseId', purchase.id).orderBy('position', 'asc')
    return { ...purchase.toJSON(), items: items.map((i) => i.toJSON()) }
  }

  async store(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(createPurchaseValidator)
    try {
      const result = await PurchaseService.create(ctx, data)
      return ctx.response.created(result)
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }
}

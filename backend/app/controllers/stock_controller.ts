import { StockService } from '#services/stock_service'
import { restockValidator, transferValidator } from '#validators/stock'
import StockMovement from '#models/stock_movement'
import { AuditService } from '#services/audit_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class StockController {
  async restock(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(restockValidator)
    try {
      const result = await StockService.restock(ctx, data)
      await AuditService.log(ctx, {
        action: 'create',
        entity: 'stock_movement',
        after: { operation: 'restock', ...data, ...result },
      })
      return result
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  async loss(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(restockValidator)
    try {
      const result = await StockService.loss(ctx, data)
      await AuditService.log(ctx, {
        action: 'create',
        entity: 'stock_movement',
        after: { operation: 'loss', ...data, ...result },
      })
      return result
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  async transfer(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(transferValidator)
    try {
      const result = await StockService.transfer(ctx, data)
      await AuditService.log(ctx, {
        action: 'create',
        entity: 'stock_movement',
        after: { operation: 'transfer', ...data, ...result },
      })
      return result
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  async movements(ctx: HttpContext) {
    const page = Math.max(1, Number(ctx.request.input('page', 1)) || 1)
    const limit = Math.min(200, Math.max(1, Number(ctx.request.input('limit', 50)) || 50))
    const productId = ctx.request.input('productId')

    let query = StockMovement.forContext(ctx)
    if (productId) query = query.where('productId', Number(productId))
    const results = await query.orderBy('created_at', 'desc').paginate(page, limit)
    return results.toJSON()
  }
}

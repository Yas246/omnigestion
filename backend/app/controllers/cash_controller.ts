import CashMovement from '#models/cash_movement'
import { CashService } from '#services/cash_service'
import { cashTransferValidator, cashMovementValidator } from '#validators/cash'
import { AuditService } from '#services/audit_service'
import type { HttpContext } from '@adonisjs/core/http'

/** Cash movements listing + transfers + manual in/out. */
export default class CashController {
  async movements(ctx: HttpContext) {
    const page = Math.max(1, Number(ctx.request.input('page', 1)) || 1)
    const limit = Math.min(200, Math.max(1, Number(ctx.request.input('limit', 50)) || 50))
    const registerId = ctx.request.input('registerId')

    let query = CashMovement.forContext(ctx)
    if (registerId) query = query.where('cashRegisterId', Number(registerId))
    const results = await query.orderBy('created_at', 'desc').paginate(page, limit)
    return results.toJSON()
  }

  async transfer(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(cashTransferValidator)
    try {
      const result = await CashService.transfer(ctx, data)
      await AuditService.log(ctx, { action: 'create', entity: 'cash_movement', after: { operation: 'transfer', ...data, ...result } })
      return result
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  async storeMovement(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(cashMovementValidator)
    try {
      const result = await CashService.recordMovement(ctx, data)
      await AuditService.log(ctx, { action: 'create', entity: 'cash_movement', after: { operation: 'manual', ...data, ...result } })
      return ctx.response.created(result)
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }
}

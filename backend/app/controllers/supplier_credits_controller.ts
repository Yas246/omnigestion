import SupplierCredit from '#models/supplier_credit'
import SupplierCreditPayment from '#models/supplier_credit_payment'
import { CreditService } from '#services/credit_service'
import { addPaymentValidator } from '#validators/credit'
import type { HttpContext } from '@adonisjs/core/http'

/** Supplier credits + their payments (cash goes OUT when paying a supplier). */
export default class SupplierCreditsController {
  async index(ctx: HttpContext) {
    const status = ctx.request.input('status') as string | undefined
    let query = SupplierCredit.forContext(ctx)
    if (status) query = query.where('status', status)
    const credits = await query.orderBy('createdAt', 'desc').limit(500)
    return credits.map((c) => c.toJSON())
  }

  async show(ctx: HttpContext) {
    const credit = await SupplierCredit.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    const payments = await SupplierCreditPayment.forContext(ctx).where('supplierCreditId', credit.id).orderBy('createdAt', 'desc')
    return { ...credit.toJSON(), payments: payments.map((p) => p.toJSON()) }
  }

  async addPayment(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(addPaymentValidator)
    try {
      const result = await CreditService.addSupplierPayment(ctx, Number(ctx.params.id), data)
      return ctx.response.created(result)
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }
}

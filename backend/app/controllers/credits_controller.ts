import ClientCredit from '#models/client_credit'
import ClientCreditPayment from '#models/client_credit_payment'
import { CreditService } from '#services/credit_service'
import { addPaymentValidator } from '#validators/credit'
import type { HttpContext } from '@adonisjs/core/http'

/** Client credits + their payments. */
export default class CreditsController {
  async index(ctx: HttpContext) {
    const status = ctx.request.input('status') as string | undefined
    let query = ClientCredit.forContext(ctx)
    if (status) query = query.where('status', status)
    const credits = await query.orderBy('createdAt', 'desc').limit(500)
    return credits.map((c) => c.toJSON())
  }

  async show(ctx: HttpContext) {
    const credit = await ClientCredit.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    const payments = await ClientCreditPayment.forContext(ctx)
      .where('clientCreditId', credit.id)
      .orderBy('createdAt', 'desc')
    return { ...credit.toJSON(), payments: payments.map((p) => p.toJSON()) }
  }

  /** Flat list of all credit payments for the current company. */
  async payments(ctx: HttpContext) {
    const payments = await ClientCreditPayment.forContext(ctx).orderBy('createdAt', 'desc')
    return payments.map((p) => p.toJSON())
  }

  /** Create a manual client credit (opening balance, adjustment) — delegated to
   *  CreditService.createManualCredit (atomic: credit + client balance + audit). */
  async store(ctx: HttpContext) {
    const data = ctx.request.body()
    try {
      const result = await CreditService.createManualCredit(ctx, {
        clientId: data.clientId ? Number(data.clientId) : null,
        clientName: data.clientName ?? null,
        amount: Number(data.amount) || 0,
        date: data.date ?? null,
        dueDate: data.dueDate ?? null,
        notes: data.notes ?? null,
      })
      return ctx.response.created(result)
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  async addPayment(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(addPaymentValidator)
    try {
      const result = await CreditService.addClientPayment(ctx, Number(ctx.params.id), data)
      return ctx.response.created(result)
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }
}

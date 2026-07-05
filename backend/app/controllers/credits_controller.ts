import ClientCredit from '#models/client_credit'
import ClientCreditPayment from '#models/client_credit_payment'
import { CreditService } from '#services/credit_service'
import { AuditService } from '#services/audit_service'
import { addPaymentValidator } from '#validators/credit'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

/** Client credits + their payments. */
export default class CreditsController {
  async index(ctx: HttpContext) {
    const status = ctx.request.input('status') as string | undefined
    let query = ClientCredit.forContext(ctx)
    if (status) query = query.where('status', status)
    const credits = await query.orderBy('createdAt', 'desc')
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

  /** Create a manual client credit (opening balance, adjustment). */
  async store(ctx: HttpContext) {
    const data = ctx.request.body()
    const amount = Number(data.amount) || 0
    const credit = await ClientCredit.create({
      clientId: data.clientId ? Number(data.clientId) : null,
      clientName: data.clientName ?? '',
      invoiceId: null,
      invoiceNumber: null,
      amount,
      amountPaid: 0,
      remainingAmount: amount,
      status: 'active',
      date: data.date ? DateTime.fromJSDate(new Date(data.date)) : DateTime.now(),
      dueDate: data.dueDate ? DateTime.fromJSDate(new Date(data.dueDate)) : null,
      notes: data.notes ?? null,
    })

    // Update the client's denormalized currentCredit.
    if (data.clientId) {
      await db
        .from('clients')
        .where('id', Number(data.clientId))
        .where('tenant_id', ctx.tenantId)
        .where('company_id', ctx.companyId ?? 0)
        .update({ current_credit: db.raw('current_credit + ?', [amount]), updated_at: new Date() })
    }

    await AuditService.log(ctx, { action: 'create', entity: 'client_credit', entityId: credit.id, after: credit.toJSON() })
    return ctx.response.created(credit.toJSON())
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

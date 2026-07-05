import Invoice from '#models/invoice'
import InvoiceItem from '#models/invoice_item'
import { InvoiceService } from '#services/invoice_service'
import { createInvoiceValidator, updateInvoiceValidator } from '#validators/invoice'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Sales invoices. create/cancel delegate to InvoiceService (the atomic
 * transactional core). Service-level errors (anti-perte, insufficient stock,
 * already cancelled) surface as 422.
 */
export default class InvoicesController {
  async index(ctx: HttpContext) {
    const page = Math.max(1, Number(ctx.request.input('page', 1)) || 1)
    const limit = Math.min(200, Math.max(1, Number(ctx.request.input('limit', 50)) || 50))
    const status = ctx.request.input('status') as string | undefined

    let query = Invoice.forContext(ctx)
    if (status) query = query.where('status', status)
    const results = await query.orderBy('sale_date', 'desc').paginate(page, limit)
    return results.toJSON()
  }

  async show(ctx: HttpContext) {
    const invoice = await Invoice.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    const items = await InvoiceItem.forContext(ctx)
      .where('invoiceId', invoice.id)
      .orderBy('position', 'asc')
    return { ...invoice.toJSON(), items: items.map((i) => i.toJSON()) }
  }

  async store(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(createInvoiceValidator)
    try {
      const result = await InvoiceService.create(ctx, data)
      return ctx.response.created(result)
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  async cancel(ctx: HttpContext) {
    try {
      const result = await InvoiceService.cancel(ctx, Number(ctx.params.id))
      return result
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }

  /** Full edit (items + metadata): delegates to InvoiceService.update (atomic reverse-old + apply-new). */
  async update(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(updateInvoiceValidator)
    try {
      const result = await InvoiceService.update(ctx, Number(ctx.params.id), data)
      return result
    } catch (error) {
      return ctx.response.unprocessableEntity({ message: (error as Error).message })
    }
  }
}

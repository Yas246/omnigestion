import AiReport from '#models/ai_report'
import { createAiReportValidator } from '#validators/ai_report'
import { AuditService } from '#services/audit_service'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * CRUD for saved AI reports ( Analyse IA ). Company-scoped via forContext +
 * CompanyScopedModel's before:create hook. The AI call itself happens
 * client-side (key never reaches the backend); only the generated text is
 * persisted here.
 */
export default class AiReportsController {
  async index(ctx: HttpContext) {
    const reports = await AiReport.forContext(ctx).orderBy('createdAt', 'desc').limit(100)
    return reports.map((r) => this.serialize(r))
  }

  async show(ctx: HttpContext) {
    const report = await AiReport.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    return this.serialize(report)
  }

  async store(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(createAiReportValidator)
    const report = await AiReport.create({
      title: data.title,
      periodLabel: data.periodLabel,
      periodStart: data.periodStart ?? null,
      periodEnd: data.periodEnd ?? null,
      content: data.content,
      model: data.model ?? 'deepseek-v4-flash',
    })
    await AuditService.log(ctx, {
      action: 'create',
      entity: 'ai_report',
      entityId: report.id,
      after: this.serialize(report),
    })
    return ctx.response.created(this.serialize(report))
  }

  async destroy(ctx: HttpContext) {
    const report = await AiReport.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    const before = this.serialize(report)
    await report.delete()
    await AuditService.log(ctx, { action: 'delete', entity: 'ai_report', entityId: report.id, before })
    return ctx.response.noContent()
  }

  private serialize(r: AiReport) {
    return {
      id: r.id,
      title: r.title,
      periodLabel: r.periodLabel,
      periodStart: r.periodStart ?? null,
      periodEnd: r.periodEnd ?? null,
      content: r.content,
      model: r.model,
      createdAt: r.createdAt?.toISO() ?? null,
    }
  }
}

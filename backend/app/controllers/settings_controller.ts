import CompanySetting from '#models/company_setting'
import type { HttpContext } from '@adonisjs/core/http'

const DEFAULTS = {
  invoice: { prefix: 'FAC', showTax: true, showUnitPrice: true, defaultTaxRate: 0, template: 'standard' },
  stock: { defaultAlertThreshold: 5 },
  backup: { autoBackupEnabled: false },
  system: { theme: 'system', language: 'fr' },
}

/** Company settings — GET (find or create defaults) + PUT (merge sections). */
export default class SettingsController {
  async index(ctx: HttpContext) {
    const companyId = ctx.companyId
    if (!companyId) return ctx.response.badRequest({ message: 'No company selected' })

    const row = await CompanySetting.query().where('companyId', companyId).first()
    if (!row) {
      const created = await CompanySetting.create({ companyId, ...DEFAULTS })
      return this.format(created)
    }
    return this.format(row)
  }

  async update(ctx: HttpContext) {
    const companyId = ctx.companyId
    if (!companyId) return ctx.response.badRequest({ message: 'No company selected' })

    const data = ctx.request.body()
    let row = await CompanySetting.query().where('companyId', companyId).first()
    if (!row) {
      row = await CompanySetting.create({ companyId, ...DEFAULTS })
    }
    // Merge each section if provided.
    if (data.invoice) row.invoice = { ...row.invoice, ...data.invoice }
    if (data.stock) row.stock = { ...row.stock, ...data.stock }
    if (data.backup) row.backup = { ...row.backup, ...data.backup }
    if (data.system) row.system = { ...row.system, ...data.system }
    await row.save()
    return this.format(row)
  }

  private format(row: CompanySetting) {
    return {
      companyId: row.companyId,
      invoice: { ...DEFAULTS.invoice, ...row.invoice },
      stock: { ...DEFAULTS.stock, ...row.stock },
      backup: { ...DEFAULTS.backup, ...row.backup },
      system: { ...DEFAULTS.system, ...row.system },
      updatedAt: row.updatedAt,
    }
  }
}

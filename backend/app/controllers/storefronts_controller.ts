import Storefront from '#models/storefront'
import Company from '#models/company'
import { StorefrontService } from '#services/storefront_service'
import { AuditService } from '#services/audit_service'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

/**
 * Storefront config (site vitrine) for the current company.
 * Draft `config` is edited; `POST /publish` copies draft → `published_config`.
 */
export default class StorefrontsController {
  /** GET /storefront — find-or-create (seed default config) + company store fields. */
  async show(ctx: HttpContext) {
    const companyId = ctx.companyId
    if (!companyId) return ctx.response.badRequest({ message: 'No company selected' })

    let sf = await Storefront.query().where('company_id', companyId).first()
    if (!sf) {
      sf = await Storefront.create({
        tenantId: ctx.tenantId,
        companyId,
        template: StorefrontService.DEFAULT_CONFIG.template,
        config: StorefrontService.DEFAULT_CONFIG,
      })
    }
    const company = await Company.find(companyId)
    return {
      ...sf.toJSON(),
      slug: company?.storeSlug ?? null,
      enabled: company?.storeEnabled ?? false,
      companyName: company?.name ?? null,
      slogan: company?.slogan ?? null,
      description: company?.description ?? null,
      logoUrl: company?.logoUrl ?? null,
      bannerUrl: company?.bannerUrl ?? null,
    }
  }

  /** PUT /storefront — update the draft config (+ template). */
  async update(ctx: HttpContext) {
    const companyId = ctx.companyId
    if (!companyId) return ctx.response.badRequest({ message: 'No company selected' })
    const data = ctx.request.body()

    let sf = await Storefront.query().where('company_id', companyId).first()
    if (!sf) {
      sf = await Storefront.create({
        tenantId: ctx.tenantId,
        companyId,
        template: data.template ?? StorefrontService.DEFAULT_CONFIG.template,
        config: data.config ?? data,
      })
    } else {
      if (data.template !== undefined) sf.template = data.template
      if (data.config !== undefined) sf.config = data.config
      await sf.save()
    }
    return sf.toJSON()
  }

  /** POST /storefront/publish — copy draft → published. */
  async publish(ctx: HttpContext) {
    const companyId = ctx.companyId
    if (!companyId) return ctx.response.badRequest({ message: 'No company selected' })
    const sf = await Storefront.query().where('company_id', companyId).firstOrFail()
    sf.publishedConfig = sf.config
    sf.publishedAt = DateTime.now()
    await sf.save()
    await AuditService.log(ctx, { action: 'update', entity: 'storefront', entityId: sf.id, after: { published: true } })
    return { published: true, publishedAt: sf.publishedAt }
  }

  /** PATCH /storefront/slug — edit the public slug (unique). */
  async updateSlug(ctx: HttpContext) {
    const companyId = ctx.companyId
    if (!companyId) return ctx.response.badRequest({ message: 'No company selected' })
    const slug: string = (ctx.request.body().slug ?? '').toString().trim().toLowerCase()
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      return ctx.response.badRequest({ message: 'Slug invalide (a-z, 0-9, -)' })
    }
    const taken = await Company.query().where('store_slug', slug).whereNot('id', companyId).first()
    if (taken) return ctx.response.conflict({ message: 'Ce slug est déjà pris' })
    const company = await Company.findOrFail(companyId)
    company.storeSlug = slug
    await company.save()
    return { slug: company.storeSlug }
  }

  /** PATCH /storefront/enabled — toggle the public store on/off. */
  async updateEnabled(ctx: HttpContext) {
    const companyId = ctx.companyId
    if (!companyId) return ctx.response.badRequest({ message: 'No company selected' })
    const enabled = !!ctx.request.body().enabled
    const company = await Company.findOrFail(companyId)
    company.storeEnabled = enabled
    await company.save()
    return { enabled: company.storeEnabled }
  }
}

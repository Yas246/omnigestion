import Company from '#models/company'
import CompanyMembership from '#models/company_membership'
import { createCompanyValidator } from '#validators/company'
import { AuditService } from '#services/audit_service'
import { CompanyBootstrapService } from '#services/company_bootstrap_service'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

/**
 * Tenant-level company management. These are NOT company-scoped (no X-Company-Id
 * needed): an owner sees every company in their tenant; an employee sees the
 * companies they have a membership in. Creating a company is owner-only.
 */
export default class CompaniesController {
  async index(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    let companies: Company[]
    if (user.isOwner) {
      companies = await Company.query().where('tenant_id', user.tenantId).orderBy('createdAt', 'asc')
    } else {
      const memberships = await CompanyMembership.query().where('userId', user.id).where('tenant_id', user.tenantId)
      const ids = memberships.map((m) => m.companyId)
      companies = ids.length
        ? await Company.query().whereIn('id', ids).orderBy('createdAt', 'asc')
        : []
    }
    return companies.map((c) => c.toJSON())
  }

  async show(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const company = await Company.query().where('id', ctx.params.id).where('tenant_id', user.tenantId).first()
    if (!company) {
      return ctx.response.notFound({ message: 'Company not found' })
    }
    // Employees must have a membership in this company
    if (!user.isOwner) {
      const m = await CompanyMembership.query()
        .where('userId', user.id)
        .where('companyId', company.id)
        .where('tenant_id', user.tenantId)
        .first()
      if (!m) return ctx.response.forbidden({ message: 'No access to this company' })
    }
    return company.toJSON()
  }

  async store(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    if (!user.isOwner) {
      return ctx.response.forbidden({ message: 'Only the owner can create companies' })
    }
    const data = await ctx.request.validateUsing(createCompanyValidator)

    // Create the company AND its quality defaults (dépôt/caisse/compteur/
    // settings) atomically — same seeding as signup, so every company starts
    // operational regardless of how it was created.
    const company = await db.transaction(async (trx) => {
      const created = await Company.create(
        {
          tenantId: user.tenantId,
          name: data.name,
          businessSector: data.businessSector ?? null,
          currency: data.currency ?? 'FCFA',
          taxId: data.taxId ?? null,
          ifu: data.ifu ?? null,
          rccm: data.rccm ?? null,
          phone: data.phone ?? null,
          email: data.email ?? null,
          address: data.address ?? null,
        },
        { client: trx }
      )
      await CompanyBootstrapService.seedDefaults(user.tenantId, created.id, trx)
      return created
    })

    await AuditService.log(ctx, { action: 'create', entity: 'company', entityId: company.id, after: company.toJSON() })
    return ctx.response.created(company.toJSON())
  }

  async update(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    if (!user.isOwner) {
      return ctx.response.forbidden({ message: 'Only the owner can modify companies' })
    }
    const company = await Company.query().where('id', ctx.params.id).where('tenant_id', user.tenantId).first()
    if (!company) return ctx.response.notFound({ message: 'Company not found' })

    const data = ctx.request.body()
    const allowed = ['name', 'slogan', 'description', 'businessSector', 'currency', 'taxId', 'businessRegister', 'ifu', 'rccm', 'phone', 'email', 'address', 'website', 'logoUrl', 'invoiceFooter']
    const before = company.toJSON()
    for (const key of allowed) {
      if (data[key] !== undefined) (company as any)[key] = data[key]
    }
    await company.save()
    await AuditService.log(ctx, { action: 'update', entity: 'company', entityId: company.id, before, after: company.toJSON() })
    return company.toJSON()
  }
}

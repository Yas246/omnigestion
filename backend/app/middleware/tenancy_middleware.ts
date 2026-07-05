import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import Company from '#models/company'
import CompanyMembership from '#models/company_membership'
import User from '#models/user'

/**
 * Resolves the tenant, the company, and the effective permissions for the
 * authenticated user, storing them on ctx. Runs AFTER auth.
 *
 *  - tenantId always from the user.
 *  - companyId from the `X-Company-Id` header (default = first accessible).
 *  - isOwner + userPermissions resolved for the permission middleware.
 *  - Owner: any company in their tenant. Employee: only companies they have a
 *    membership in.
 */
export default class TenancyMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.getUserOrFail()
    ctx.tenantId = user.tenantId
    ctx.isOwner = user.isOwner

    const raw = ctx.request.header('x-company-id')
    let companyId: number | null = raw != null && raw !== '' ? Number(raw) : null
    if (raw != null && raw !== '' && Number.isNaN(companyId)) {
      return ctx.response.badRequest({ message: 'Invalid X-Company-Id header' })
    }

    let membership: CompanyMembership | null = null

    if (companyId == null) {
      // default to the first accessible company
      if (user.isOwner) {
        const company = await Company.query().where('tenant_id', user.tenantId).orderBy('id', 'asc').first()
        companyId = company?.id ?? null
      } else {
        membership = await CompanyMembership.query()
          .where('user_id', user.id)
          .where('tenant_id', user.tenantId)
          .orderBy('id', 'asc')
          .first()
        companyId = membership?.companyId ?? null
      }
    } else if (!(await this.canAccessCompany(user, companyId, (m) => (membership = m)))) {
      return ctx.response.forbidden({ message: 'No access to this company' })
    }

    ctx.companyId = companyId
    ctx.userPermissions = user.isOwner ? null : membership?.permissions ?? []
    return next()
  }

  private async canAccessCompany(
    user: User,
    companyId: number,
    setMembership: (m: CompanyMembership | null) => void
  ): Promise<boolean> {
    if (user.isOwner) {
      const company = await Company.query().where('id', companyId).where('tenant_id', user.tenantId).first()
      return !!company
    }
    const membership = await CompanyMembership.query()
      .where('user_id', user.id)
      .where('company_id', companyId)
      .where('tenant_id', user.tenantId)
      .first()
    setMembership(membership)
    return !!membership
  }
}

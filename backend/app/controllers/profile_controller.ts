import type { HttpContext } from '@adonisjs/core/http'
import CompanyMembership from '#models/company_membership'

/**
 * Current user profile. Returns a plain object (Tuyau `serialize` is bypassed).
 *
 * Beyond identity, it resolves the user's `role` + `permissions` for the
 * currently selected company (from the `X-Company-Id` header) so the frontend's
 * `usePermissions` / `PermissionGate` can enforce granular access client-side.
 * The route sits under `middleware.auth()` only (not tenancy), so we read the
 * header directly instead of relying on `ctx.companyId`.
 */
export default class ProfileController {
  async show({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const base = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      position: user.position,
      phone: user.phone,
      tenantId: user.tenantId,
      isOwner: user.isOwner,
      role: (user.isOwner ? 'admin' : 'employee') as 'admin' | 'employee',
    }

    // Owners get all permissions implicitly (frontend treats role 'admin' as
    // isAdmin → full access); no membership row exists for them.
    if (user.isOwner) return { ...base, permissions: [] }

    const raw = request.header('x-company-id')
    const companyId = raw != null && raw !== '' ? Number(raw) : null
    if (!companyId || Number.isNaN(companyId)) return { ...base, permissions: [] }

    const membership = await CompanyMembership.query()
      .where('tenant_id', user.tenantId)
      .where('user_id', user.id)
      .where('company_id', companyId)
      .first()

    return { ...base, permissions: membership?.permissions ?? [] }
  }
}

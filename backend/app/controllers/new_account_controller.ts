import User from '#models/user'
import Tenant from '#models/tenant'
import Company from '#models/company'
import { signupValidator } from '#validators/user'
import { CompanyBootstrapService } from '#services/company_bootstrap_service'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

/**
 * Self-signup creates a whole tenant atomically: tenant + first company + owner
 * user, plus the company's quality defaults (dépôt/caisse/compteur/settings —
 * see CompanyBootstrapService). All in a single transaction so a failure rolls
 * the tenant back entirely (no orphan accounts, no half-seeded company).
 */
export default class NewAccountController {
  async store({ request }: HttpContext) {
    const { fullName, email, password, companyName } = await request.validateUsing(signupValidator)

    const { user, company } = await db.transaction(async (trx) => {
      const tenant = await Tenant.create(
        { name: companyName, plan: 'free', seatsLimit: 5, seatsUsed: 1 },
        { client: trx },
      )
      const createdCompany = await Company.create(
        { tenantId: tenant.id, name: companyName, currency: 'FCFA' },
        { client: trx },
      )
      const owner = await User.create(
        { tenantId: tenant.id, fullName, email, password, isOwner: true },
        { client: trx },
      )
      await CompanyBootstrapService.seedDefaults(tenant.id, createdCompany.id, trx)
      return { user: owner, company: createdCompany }
    })

    const token = await User.accessTokens.create(user)

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        tenantId: user.tenantId,
        isOwner: user.isOwner,
      },
      company: { id: company.id, name: company.name, tenantId: company.tenantId },
      token: token.value!.release(),
    }
  }
}

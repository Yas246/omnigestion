import StoreAccount from '#models/store_account'
import vine from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * PUBLIC buyer auth (marketplace shoppers). Separate from ERP `User`.
 * Signup/login issue an opaque access token stored in auth_access_tokens.
 */
export default class StoreAuthController {
  async signup({ request, response }: HttpContext) {
    const data = await request.validateUsing(
      vine.create({
        email: vine.string().trim().email().maxLength(254).unique({ table: 'store_accounts', column: 'email' }),
        password: vine.string().minLength(8).maxLength(32),
        fullName: vine.string().trim().maxLength(150).optional(),
        phone: vine.string().trim().maxLength(40).optional(),
      })
    )
    const account = await StoreAccount.create({
      email: data.email,
      password: data.password,
      fullName: data.fullName ?? null,
      phone: data.phone ?? null,
    })
    const token = await StoreAccount.accessTokens.create(account)
    return response.created({
      account: { id: account.id, email: account.email, fullName: account.fullName, phone: account.phone },
      token: token.value!.release(),
    })
  }

  async login({ request, response }: HttpContext) {
    const data = await request.validateUsing(
      vine.create({
        email: vine.string().trim().email(),
        password: vine.string(),
      })
    )
    const account = await StoreAccount.verifyCredentials(data.email, data.password)
    if (!account) return response.unauthorized({ message: 'Email ou mot de passe incorrect' })
    const token = await StoreAccount.accessTokens.create(account)
    return {
      account: { id: account.id, email: account.email, fullName: account.fullName, phone: account.phone },
      token: token.value!.release(),
    }
  }
}

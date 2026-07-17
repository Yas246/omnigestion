import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
 *
 * Token expiry: access tokens are issued with a 30-day `expiresAt` (see
 * AccessTokensController / NewAccountController). The DbAccessTokensProvider's
 * verify path already rejects expired tokens (`accessToken.isExpired()` → null
 * → auth fails) inside `authenticateUsing`, so expired tokens are denied here
 * without any extra check. The `auth_access_tokens.expires_at` column backs it.
 */
export default class AuthMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {}
  ) {
    await ctx.auth.authenticateUsing(options.guards)
    return next()
  }
}

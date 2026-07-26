import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Surface the `omnigestion_token` HttpOnly cookie as a Bearer Authorization
 * header when none is present, so the access-token guard authenticates requests
 * that rely on the cookie. The frontend stores no token client-side (cookie-only
 * auth) — this is the bridge that lets the guard read it.
 */
const COOKIE_NAME = 'omnigestion_token'

export default class CookieTokenMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const req = (ctx.request as any).request
    if (req && !req.headers.authorization) {
      const token = ctx.request.cookie(COOKIE_NAME)
      if (token) req.headers.authorization = `Bearer ${token}`
    }
    return next()
  }
}

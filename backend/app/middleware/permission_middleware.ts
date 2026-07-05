import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Per-route permission gate. Usage:
 *   .use(middleware.permission({ module: 'sales', action: 'create' }))
 *
 * Owners bypass the matrix (full access). Employees are checked against the
 * permissions of their membership in the current company (resolved by
 * tenancy_middleware into ctx.userPermissions).
 */
export default class PermissionMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { module: string; action: string }) {
    const user = ctx.auth.getUserOrFail()
    if (user.isOwner) {
      return next()
    }

    const perms = ctx.userPermissions ?? []
    const allowed = perms.some(
      (p: any) => p?.module === options.module && Array.isArray(p?.actions) && p.actions.includes(options.action)
    )

    if (!allowed) {
      return ctx.response.forbidden({
        message: `Forbidden: requires ${options.module}.${options.action}`,
      })
    }
    return next()
  }
}

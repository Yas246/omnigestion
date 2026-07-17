import AuditLog from '#models/audit_log'
import type { HttpContext } from '@adonisjs/core/http'

export interface AuditPayload {
  action: string // create | update | delete | login | export | ...
  entity: string // invoice | client | product | ...
  entityId?: number | null
  before?: Record<string, any> | null
  after?: Record<string, any> | null
}

export interface AuditOptions {
  /**
   * Pass the request's transaction client to write the audit row INSIDE the same
   * transaction as the business mutation (recommended for money-bearing entities
   * — invoice/credit/cash — so the audit never diverges from the data).
   */
  client?: any
}

/**
 * Central audit writer. Never throws — a logging failure must not break the
 * business operation (caller still gets its response).
 *
 * Blocking policy:
 *   - When called with `{ client: trx }` (money-bearing entities: invoice,
 *     credit, cash, etc.), the audit row is written INSIDE the caller's
 *     transaction and awaited — so the audit never diverges from the data. This
 *     path MUST stay blocking.
 *   - When called WITHOUT a `client` (independent audit events: login, export,
 *     simple reads, etc.), the write is fire-and-forget: it is scheduled via
 *     `setImmediate` and detached from the response. This trims per-request
 *     latency for non-critical audit events. Failures are swallowed silently
 *     (already logged to stderr) so the caller's response is never affected.
 *
 * The API is unchanged — callers still `await AuditService.log(...)`. The
 * returned promise resolves immediately on the no-client path.
 */
export const AuditService = {
  async log(ctx: HttpContext | null, payload: AuditPayload, options: AuditOptions = {}): Promise<void> {
    // Blocking path: audit participates in the caller's transaction.
    if (options.client) {
      try {
        const user = ctx?.auth?.user
        await AuditLog.create(
          {
            tenantId: ctx?.tenantId ?? 0,
            companyId: ctx?.companyId ?? null,
            userId: user?.id ?? null,
            userName: user?.fullName ?? null,
            ipAddress: ctx?.request?.ip() ?? null,
            userAgent: ctx?.request?.header('user-agent') ?? null,
            action: payload.action,
            entity: payload.entity,
            entityId: payload.entityId ?? null,
            before: payload.before ?? null,
            after: payload.after ?? null,
          },
          { client: options.client },
        )
      } catch (error) {
        console.error('[audit] failed to write audit log:', error)
      }
      return
    }

    // Non-blocking path: schedule the write off the request's critical path.
    const user = ctx?.auth?.user
    const tenantId = ctx?.tenantId ?? 0
    const companyId = ctx?.companyId ?? null
    const userId = user?.id ?? null
    const userName = user?.fullName ?? null
    const ipAddress = ctx?.request?.ip() ?? null
    const userAgent = ctx?.request?.header('user-agent') ?? null

    setImmediate(() => {
      AuditLog.create({
        tenantId,
        companyId,
        userId,
        userName,
        ipAddress,
        userAgent,
        action: payload.action,
        entity: payload.entity,
        entityId: payload.entityId ?? null,
        before: payload.before ?? null,
        after: payload.after ?? null,
      }).catch((error: unknown) => {
        console.error('[audit] failed to write audit log:', error)
      })
    })
  },
}

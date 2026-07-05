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
 * business operation (caller still gets its response). For money-bearing
 * entities, call with `{ client: trx }` inside the mutation transaction.
 */
export const AuditService = {
  async log(ctx: HttpContext | null, payload: AuditPayload, options: AuditOptions = {}): Promise<void> {
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
        options.client ? { client: options.client } : undefined,
      )
    } catch (error) {
      // Audit must never break the business operation.
      console.error('[audit] failed to write audit log:', error)
    }
  },
}

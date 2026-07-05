import { BaseModel } from '@adonisjs/lucid/orm'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import { HttpContext } from '@adonisjs/core/http'

/**
 * Base class for every company-scoped business table.
 *
 * CONVENTION (enforced at the schema level):
 *  - Every business model extends this base AND declares
 *      @column declare tenantId: number
 *      @column declare companyId: number
 *  - Every business migration uses `addCompanyScoping(table, tableName)` from
 *    `database/migrations/helpers.ts`, which adds tenant_id + company_id
 *    (NOT NULL, FK, composite index). So the columns cannot be missing from a
 *    table. If a model forgets the matching @column, inserts fail loudly
 *    (NOT NULL violation).
 *
 * Multi-tenancy is enforced at the application layer:
 *  - Writes: a `before:create` hook auto-fills tenant_id + company_id from the
 *    request context.
 *  - Reads: `Model.forContext(ctx)` returns a query builder pre-filtered by
 *    tenant + company. Use it for ALL business reads.
 *
 * DB-level Row-Level Security is a deferred hardening backstop (requires a
 * per-request transaction + GUC plumbing that is invasive with Lucid); the
 * application-layer scoping here is the current guarantee.
 */
export default class CompanyScopedModel extends BaseModel {
  /**
   * Query builder pre-scoped to the current tenant + company.
   * `companyId ?? 0` makes a missing company resolve to "no rows" (safe default).
   */
  static forContext<M extends LucidModel>(this: M, ctx: HttpContext) {
    return this.query().where('tenant_id', ctx.tenantId).where('company_id', ctx.companyId ?? 0)
  }

  static boot() {
    if (this.booted) return
    super.boot()

    this.before('create', (model: any) => {
      const ctx = HttpContext.get()
      if (ctx && ctx.tenantId != null) model.tenantId = ctx.tenantId
      if (ctx && ctx.companyId != null) model.companyId = ctx.companyId
      // Hard guarantee (point A): a company-scoped row can NEVER be created
      // without tenant + company. Throws loudly instead of silently leaking.
      if (model.tenantId == null) {
        throw new Error('CompanyScopedModel: tenant_id is required (no tenant context)')
      }
      if (model.companyId == null) {
        throw new Error('CompanyScopedModel: company_id is required (no company context)')
      }
    })
  }
}

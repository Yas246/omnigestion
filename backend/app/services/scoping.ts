import type { HttpContext } from '@adonisjs/core/http'

/**
 * Multi-tenant scoping helper.
 *
 * Returns a Lucid query builder pre-filtered by the request's tenant + company.
 * Use this for every read/write against tenant-scoped tables so a missed
 * `where('tenant_id')` / `where('company_id')` can never leak data across
 * tenants or companies.
 *
 * Usage:
 *   const rows = await scoped(trx, ctx, 'products').where('is_active', true)
 *   await scoped(trx, ctx, 'invoices').where('id', id).update({ ... })
 *
 * MIGRATION NOTE: all manual `trx.from(table).where('tenant_id', ...).where('company_id', ...)`
 * chains across the codebase should eventually be replaced with `scoped(trx, ctx, table)`.
 * This file only makes the helper available — existing call sites are not migrated here.
 *
 * `trx` accepts either a transaction client or the default `db` service (both
 * expose the same query-builder surface). `ctx.companyId` may be 0/null for
 * tenant-only endpoints (e.g. tenant management) — the company filter is then
 * `0`, which matches nothing for company-scoped tables and is a safe no-op.
 */
export function scoped(trx: any, ctx: HttpContext, table: string) {
  return trx
    .from(table)
    .where('tenant_id', ctx.tenantId)
    .where('company_id', ctx.companyId ?? 0)
}

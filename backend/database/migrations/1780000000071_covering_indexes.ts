import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

/**
 * Sprint 1 — covering indexes (from the optimization audit):
 *  - invoices(tenant_id, company_id, status, sale_date): the dashboard lists
 *    filter by status and sort by sale_date; the existing (tenant,company,date)
 *    and (tenant,company,status) indexes each force a re-sort/re-filter for the
 *    other half of that query. This 4-column index covers both predicates in
 *    the order they're applied.
 *  - clients name trigram (pg_trgm / GIN): fast ILIKE '%term%' search, which
 *    the B-tree on name can't serve. The extension is created idempotently
 *    first; if the DB role lacks CREATE privilege the index step is skipped
 *    (the LIKE search still works, just slower) rather than failing the
 *    migration.
 */
const INVOICES_INDEX = 'invoices_status_date_index'
const CLIENTS_TRGM_INDEX = 'clients_name_trgm'

export default class extends BaseSchema {
  async up() {
    // invoices — combined status filter + sale_date sort.
    this.schema.alterTable('invoices', (table) => {
      table.index(['tenant_id', 'company_id', 'status', 'sale_date'], INVOICES_INDEX)
    })

    // clients — trigram GIN for fast LIKE on name.
    try {
      await db.rawQuery('CREATE EXTENSION IF NOT EXISTS pg_trgm')
      await db.rawQuery(
        `CREATE INDEX IF NOT EXISTS "${CLIENTS_TRGM_INDEX}" ON clients USING GIN (LOWER(name) gin_trgm_ops)`
      )
    } catch {
      // Privileged-only on some managed PG setups; not fatal — LIKE still works.
    }
  }

  async down() {
    try {
      await db.rawQuery(`DROP INDEX IF EXISTS "${CLIENTS_TRGM_INDEX}"`)
    } catch {
      // ignore
    }
    this.schema.alterTable('invoices', (table) => {
      table.dropIndex(['tenant_id', 'company_id', 'status', 'sale_date'], INVOICES_INDEX)
    })
  }
}

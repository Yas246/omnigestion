import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

/**
 * Audit v2 — indexes + integrity CHECK (from the optimization audit v2):
 *  - client_credit_payments (tenant_id, company_id, created_at) INCLUDE (amount):
 *    the dashboard "CA encaissé" sums credit payments by period; without this it
 *    seq-scans the 2nd largest movement table.
 *  - cash_registers.current_balance >= 0 : last-defense accounting invariant
 *    (mirrors product_stock_locations.quantity >= 0). Added NOT VALID so the
 *    migration succeeds even if legacy rows violate it; future writes are guarded.
 *  - suppliers.name trigram GIN : fast ILIKE search (symmetry with clients.name).
 */
const CCP_INDEX = 'client_credit_payments_dashboard_idx'
const CASH_BALANCE_CHECK = 'cash_registers_balance_nonneg'
const SUPPLIERS_TRGM = 'suppliers_name_trgm'

export default class extends BaseSchema {
  async up() {
    await db.rawQuery(
      `CREATE INDEX IF NOT EXISTS "${CCP_INDEX}" ON client_credit_payments (tenant_id, company_id, created_at) INCLUDE (amount)`
    )

    try {
      await db.rawQuery(
        `ALTER TABLE cash_registers ADD CONSTRAINT "${CASH_BALANCE_CHECK}" CHECK (current_balance >= 0) NOT VALID`
      )
    } catch {
      // Constraint may already exist on re-runs; not fatal.
    }

    try {
      await db.rawQuery('CREATE EXTENSION IF NOT EXISTS pg_trgm')
      await db.rawQuery(
        `CREATE INDEX IF NOT EXISTS "${SUPPLIERS_TRGM}" ON suppliers USING GIN (LOWER(name) gin_trgm_ops)`
      )
    } catch {
      // Privileged-only on some managed PG setups; LIKE still works, just slower.
    }
  }

  async down() {
    try {
      await db.rawQuery(`DROP INDEX IF EXISTS "${SUPPLIERS_TRGM}"`)
    } catch {}
    try {
      await db.rawQuery(`ALTER TABLE cash_registers DROP CONSTRAINT IF EXISTS "${CASH_BALANCE_CHECK}"`)
    } catch {}
    try {
      await db.rawQuery(`DROP INDEX IF EXISTS "${CCP_INDEX}"`)
    } catch {}
  }
}

import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

/**
 * Sprint 1 — DB hardening (from the optimization audit):
 *  - CHECK quantity >= 0 on product_stock_locations (business invariant at the
 *    DB level, currently only enforced in services via FOR UPDATE).
 *  - Covering indexes on invoice_items (highest-growth table): Top produits +
 *    per-invoice joins were seq scans.
 *  - Company-scoped reference index on cash_movements (invoice cancel / credit
 *    settlement lookups).
 *  - supplier_credits(supplier_id) — symmetry with client_credits(client_id).
 *  - Drop two redundant indexes (covered by the left-prefix of another index).
 *
 * The CHECK is added via raw SQL (knex 3 table.check() in alter emits an
 * un-named constraint, awkward to drop); existing negative quantities are
 * clamped to 0 first so the constraint cannot fail on historical rows.
 */
const QTY_CHECK = 'product_stock_locations_quantity_check'

export default class extends BaseSchema {
  async up() {
    // Clamp any historical negative quantity before adding the invariant.
    await db.rawQuery('UPDATE "product_stock_locations" SET quantity = 0 WHERE quantity < 0')
    await db.rawQuery(
      `ALTER TABLE "product_stock_locations" ADD CONSTRAINT "${QTY_CHECK}" CHECK (quantity >= 0)`
    )

    // invoice_items — dashboard Top produits + per-invoice joins.
    this.schema.alterTable('invoice_items', (table) => {
      table.index(['tenant_id', 'company_id', 'product_id'], 'invoice_items_tcp_index')
      table.index(['tenant_id', 'company_id', 'invoice_id'], 'invoice_items_tci_index')
    })

    // cash_movements — company-scoped reference lookups (invoice cancel etc.).
    this.schema.alterTable('cash_movements', (table) => {
      table.index(
        ['tenant_id', 'company_id', 'reference_type', 'reference_id'],
        'cash_movements_ref_index'
      )
    })

    // supplier_credits — symmetry with client_credits(client_id).
    this.schema.alterTable('supplier_credits', (table) => {
      table.index(['tenant_id', 'company_id', 'supplier_id'], 'supplier_credits_supplier_index')
    })

    // Redundant indexes (left-prefix-covered): drop them.
    this.schema.alterTable('product_reviews', (table) => {
      table.dropIndex(['product_id'], 'product_reviews_product_id_index')
    })
    this.schema.alterTable('ai_reports', (table) => {
      table.dropIndex(['tenant_id', 'company_id'], 'ai_reports_tenant_company_index')
    })
  }

  async down() {
    await db.rawQuery(`ALTER TABLE "product_stock_locations" DROP CONSTRAINT IF EXISTS "${QTY_CHECK}"`)
    this.schema.alterTable('invoice_items', (table) => {
      table.dropIndex(['tenant_id', 'company_id', 'product_id'], 'invoice_items_tcp_index')
      table.dropIndex(['tenant_id', 'company_id', 'invoice_id'], 'invoice_items_tci_index')
    })
    this.schema.alterTable('cash_movements', (table) => {
      table.dropIndex(
        ['tenant_id', 'company_id', 'reference_type', 'reference_id'],
        'cash_movements_ref_index'
      )
    })
    this.schema.alterTable('supplier_credits', (table) => {
      table.dropIndex(['tenant_id', 'company_id', 'supplier_id'], 'supplier_credits_supplier_index')
    })
    this.schema.alterTable('product_reviews', (table) => {
      table.index(['product_id'])
    })
    this.schema.alterTable('ai_reports', (table) => {
      table.index(['tenant_id', 'company_id'], 'ai_reports_tenant_company_index')
    })
  }
}

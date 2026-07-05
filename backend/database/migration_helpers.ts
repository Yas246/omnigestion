import type { Knex } from 'knex'

/**
 * Shared migration helpers. Lives OUTSIDE `database/migrations/` so the Lucid
 * migration runner does not try to load it as a migration.
 *
 * Import from a migration file as:  import { addCompanyScoping } from '../migration_helpers.js'
 */

/**
 * Adds tenant_id + company_id to a business table — the multi-tenant guarantee
 * at the schema level. Every company-scoped migration MUST call this so the two
 * columns (NOT NULL, FK CASCADE, composite index) can never be forgotten.
 *
 * Call it FIRST inside `createTable`, before other columns:
 *
 *   this.schema.createTable('products', (table) => {
 *     table.increments('id').notNullable()
 *     addCompanyScoping(table, 'products')
 *     // ...business columns...
 *     addTimestamps(table)
 *     table.index(['tenant_id','company_id','code'], 'products_code_index') // access pattern
 *   })
 */
export function addCompanyScoping(table: Knex.TableBuilder, tableName: string) {
  table
    .integer('tenant_id')
    .unsigned()
    .notNullable()
    .references('id')
    .inTable('tenants')
    .onDelete('CASCADE')
  table
    .integer('company_id')
    .unsigned()
    .notNullable()
    .references('id')
    .inTable('companies')
    .onDelete('CASCADE')

  // Primary scoping index — every business query filters by tenant + company.
  table.index(['tenant_id', 'company_id'], `${tableName}_tenant_company_index`)
}

/**
 * Standard created_at / updated_at timestamps (NOT NULL created_at, nullable
 * updated_at) matching the rest of the schema.
 */
export function addTimestamps(table: Knex.TableBuilder) {
  table.timestamp('created_at').notNullable()
  table.timestamp('updated_at').nullable()
}

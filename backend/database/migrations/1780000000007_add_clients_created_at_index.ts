import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Indexing strategy (applied retrospectively to `clients`; baked into the
 * `addCompanyScoping` helper for future tables):
 *   - (tenant_id, company_id)            — base scoping (already present)
 *   - (tenant_id, company_id, created_at)— date-ordered list queries (controller)
 *   - (tenant_id, company_id, code)      — code lookups (already present)
 * Add (tenant_id, company_id, <status>) on tables that have a status column.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('clients', (table) => {
      table.index(['tenant_id', 'company_id', 'created_at'], 'clients_tenant_company_created_index')
    })
  }

  async down() {
    this.schema.alterTable('clients', (table) => {
      table.dropIndex(['tenant_id', 'company_id', 'created_at'], 'clients_tenant_company_created_index')
    })
  }
}

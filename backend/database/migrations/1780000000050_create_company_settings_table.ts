import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Per-company settings (one row per company). JSONB sections for each domain
 * (invoice numbering/display, stock defaults, backup, system). The invoice
 * counter (nextNumber) lives in invoice_counters (atomic FOR UPDATE); only
 * display config (prefix template, showTax, etc.) lives here.
 */
export default class extends BaseSchema {
  protected tableName = 'company_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('company_id').unsigned().notNullable().references('id').inTable('companies').onDelete('CASCADE').unique()
      table.jsonb('invoice').notNullable().defaultTo('{}')
      table.jsonb('stock').notNullable().defaultTo('{}')
      table.jsonb('backup').notNullable().defaultTo('{}')
      table.jsonb('system').notNullable().defaultTo('{}')
      table.timestamp('updated_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

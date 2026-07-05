import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping } from '../migration_helpers.js'

/**
 * Per-company invoice numbering counter. Locked FOR UPDATE inside the create
 * transaction to assign sequential numbers without races.
 */
export default class extends BaseSchema {
  protected tableName = 'invoice_counters'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table.string('prefix').notNullable().defaultTo('FAC')
      table.integer('next_number').notNullable().defaultTo(1)
      table.unique(['tenant_id', 'company_id'], 'invoice_counters_company_unique')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

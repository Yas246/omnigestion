import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping } from '../migration_helpers.js'

export default class extends BaseSchema {
  protected tableName = 'purchase_counters'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table.string('prefix').notNullable().defaultTo('ACH')
      table.integer('next_number').notNullable().defaultTo(1)
      table.unique(['tenant_id', 'company_id'], 'purchase_counters_company_unique')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

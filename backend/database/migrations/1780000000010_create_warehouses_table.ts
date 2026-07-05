import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping, addTimestamps } from '../migration_helpers.js'

export default class extends BaseSchema {
  protected tableName = 'warehouses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table.string('name').notNullable()
      table.string('code').nullable()
      table.string('address').nullable()
      table.boolean('is_main').notNullable().defaultTo(false)
      table.boolean('is_active').notNullable().defaultTo(true)
      addTimestamps(table)
      table.index(['tenant_id', 'company_id', 'is_main'], 'warehouses_main_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

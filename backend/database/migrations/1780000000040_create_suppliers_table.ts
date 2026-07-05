import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping, addTimestamps } from '../migration_helpers.js'

export default class extends BaseSchema {
  protected tableName = 'suppliers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table.string('name').notNullable()
      table.string('code').nullable()
      table.string('phone').nullable()
      table.string('email').nullable()
      table.string('address').nullable()
      table.bigInteger('total_purchases').notNullable().defaultTo(0)
      table.bigInteger('total_amount').notNullable().defaultTo(0)
      table.bigInteger('current_debt').notNullable().defaultTo(0)
      table.boolean('is_active').notNullable().defaultTo(true)
      addTimestamps(table)
      table.index(['tenant_id', 'company_id', 'code'], 'suppliers_code_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

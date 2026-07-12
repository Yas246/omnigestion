import { BaseSchema } from '@adonisjs/lucid/schema'

/** Buyer accounts (global marketplace shoppers, NOT company-scoped). */
export default class extends BaseSchema {
  protected tableName = 'store_accounts'
  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('email', 254).notNullable().unique()
      table.string('password').notNullable()
      table.string('full_name', 150).nullable()
      table.string('phone', 40).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
    })
  }
  async down() { this.schema.dropTable(this.tableName) }
}

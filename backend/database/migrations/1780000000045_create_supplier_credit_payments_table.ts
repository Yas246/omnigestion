import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping } from '../migration_helpers.js'

export default class extends BaseSchema {
  protected tableName = 'supplier_credit_payments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table.integer('supplier_credit_id').unsigned().notNullable().references('id').inTable('supplier_credits').onDelete('CASCADE')
      table.bigInteger('amount').notNullable()
      table.string('payment_mode').nullable()
      table.string('notes').nullable()
      table.integer('user_id').unsigned().nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['tenant_id', 'company_id', 'supplier_credit_id'], 'supplier_credit_payments_credit_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

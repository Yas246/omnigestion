import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping } from '../migration_helpers.js'

/** Payments against a client credit. Append-only. */
export default class extends BaseSchema {
  protected tableName = 'client_credit_payments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table.integer('client_credit_id').unsigned().notNullable().references('id').inTable('client_credits').onDelete('CASCADE')
      table.bigInteger('amount').notNullable() // FCFA
      table.string('payment_mode').nullable() // cash | bank | mobile
      table.string('notes').nullable()
      table.integer('user_id').unsigned().nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['tenant_id', 'company_id', 'client_credit_id'], 'client_credit_payments_credit_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

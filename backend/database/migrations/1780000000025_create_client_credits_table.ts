import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping, addTimestamps } from '../migration_helpers.js'

/**
 * Outstanding client credit created when an invoice is left partially/fully
 * unpaid (remaining_amount > 0). Linked back to its invoice for cancellation
 * reversal. Payments are tracked by the (future) client_credit_payments table.
 */
export default class extends BaseSchema {
  protected tableName = 'client_credits'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table.integer('client_id').unsigned().nullable().references('id').inTable('clients').onDelete('SET NULL')
      table.string('client_name').notNullable()
      table.integer('invoice_id').unsigned().nullable().references('id').inTable('invoices').onDelete('SET NULL')
      table.string('invoice_number').nullable()
      table.bigInteger('amount').notNullable()
      table.bigInteger('amount_paid').notNullable().defaultTo(0)
      table.bigInteger('remaining_amount').notNullable()
      table.string('status').notNullable().defaultTo('active') // active | partial | paid | cancelled
      table.timestamp('date', { useTz: true }).notNullable()
      table.timestamp('due_date', { useTz: true }).nullable()
      table.string('notes').nullable()
      addTimestamps(table)
      table.index(['tenant_id', 'company_id', 'status'], 'client_credits_status_index')
      table.index(['invoice_id'], 'client_credits_invoice_index')
      table.index(['client_id'], 'client_credits_client_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

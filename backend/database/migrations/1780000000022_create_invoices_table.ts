import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping, addTimestamps } from '../migration_helpers.js'

/**
 * Sales invoices. Money columns are BIGINT (FCFA). invoice_number is unique per
 * company; assigned atomically from invoice_counters inside the create transaction.
 */
export default class extends BaseSchema {
  protected tableName = 'invoices'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table.string('invoice_number').notNullable()
      table.integer('client_id').unsigned().nullable().references('id').inTable('clients').onDelete('SET NULL')
      table.string('client_name').nullable()
      table.timestamp('sale_date', { useTz: true }).notNullable()
      table.timestamp('due_date', { useTz: true }).nullable()

      table.bigInteger('subtotal').notNullable().defaultTo(0)
      table.integer('tax_rate').notNullable().defaultTo(0) // integer percentage (e.g. 18)
      table.bigInteger('tax_amount').notNullable().defaultTo(0)
      table.bigInteger('discount').notNullable().defaultTo(0)
      table.bigInteger('total').notNullable().defaultTo(0)

      table.string('status').notNullable().defaultTo('draft') // draft | validated | paid | cancelled
      table.string('payment_method').nullable() // cash | bank | mobile | credit
      table.bigInteger('paid_amount').notNullable().defaultTo(0)
      table.bigInteger('remaining_amount').notNullable().defaultTo(0)

      table.integer('user_id').unsigned().nullable()
      table.string('user_name').nullable()
      table.timestamp('paid_at', { useTz: true }).nullable()
      table.timestamp('cancelled_at', { useTz: true }).nullable()
      table.string('notes').nullable()

      addTimestamps(table)
      table.unique(['tenant_id', 'company_id', 'invoice_number'], 'invoices_number_unique')
      table.index(['tenant_id', 'company_id', 'sale_date'], 'invoices_date_index')
      table.index(['tenant_id', 'company_id', 'status'], 'invoices_status_index')
      table.index(['client_id'], 'invoices_client_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

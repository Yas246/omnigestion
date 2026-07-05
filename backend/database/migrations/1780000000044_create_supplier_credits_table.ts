import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping, addTimestamps } from '../migration_helpers.js'

/** Outstanding supplier debt (unpaid purchase). Mirror of client_credits. */
export default class extends BaseSchema {
  protected tableName = 'supplier_credits'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table.integer('supplier_id').unsigned().nullable().references('id').inTable('suppliers').onDelete('SET NULL')
      table.string('supplier_name').notNullable()
      table.integer('purchase_id').unsigned().nullable().references('id').inTable('purchases').onDelete('SET NULL')
      table.string('purchase_number').nullable()
      table.bigInteger('amount').notNullable()
      table.bigInteger('amount_paid').notNullable().defaultTo(0)
      table.bigInteger('remaining_amount').notNullable()
      table.string('status').notNullable().defaultTo('active') // active | partial | paid | cancelled
      table.timestamp('date', { useTz: true }).notNullable()
      table.timestamp('due_date', { useTz: true }).nullable()
      table.string('notes').nullable()
      addTimestamps(table)
      table.index(['tenant_id', 'company_id', 'status'], 'supplier_credits_status_index')
      table.index(['purchase_id'], 'supplier_credits_purchase_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

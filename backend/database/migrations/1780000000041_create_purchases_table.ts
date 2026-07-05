import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping, addTimestamps } from '../migration_helpers.js'

export default class extends BaseSchema {
  protected tableName = 'purchases'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table.string('purchase_number').notNullable()
      table.integer('supplier_id').unsigned().nullable().references('id').inTable('suppliers').onDelete('SET NULL')
      table.string('supplier_name').nullable()
      table.timestamp('purchase_date', { useTz: true }).notNullable()
      table.bigInteger('subtotal').notNullable().defaultTo(0)
      table.integer('tax_rate').notNullable().defaultTo(0)
      table.bigInteger('tax_amount').notNullable().defaultTo(0)
      table.bigInteger('discount').notNullable().defaultTo(0)
      table.bigInteger('total').notNullable().defaultTo(0)
      table.string('status').notNullable().defaultTo('active') // paid | active | partial | cancelled
      table.string('payment_method').nullable()
      table.bigInteger('paid_amount').notNullable().defaultTo(0)
      table.bigInteger('remaining_amount').notNullable().defaultTo(0)
      table.integer('user_id').unsigned().nullable()
      table.string('user_name').nullable()
      table.timestamp('cancelled_at', { useTz: true }).nullable()
      table.string('notes').nullable()
      addTimestamps(table)
      table.unique(['tenant_id', 'company_id', 'purchase_number'], 'purchases_number_unique')
      table.index(['tenant_id', 'company_id', 'status'], 'purchases_status_index')
      table.index(['supplier_id'], 'purchases_supplier_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

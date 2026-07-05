import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping } from '../migration_helpers.js'

/**
 * Append-only stock movement ledger. quantity is SIGNED (negative for
 * out / loss / transfer-out). warehouse_id + user_id are NOT FK-constrained so
 * the history survives warehouse/user changes (only product_id cascades).
 */
export default class extends BaseSchema {
  protected tableName = 'stock_movements'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table.integer('warehouse_id').unsigned().notNullable() // historical, no FK
      table.string('type').notNullable() // in | out | transfer | loss
      table.integer('quantity').notNullable() // signed
      table.string('reason').nullable()
      table.string('reference_type').nullable() // invoice | restock | adjustment | transfer | invoice_cancellation
      table.integer('reference_id').nullable()
      table.integer('user_id').unsigned().nullable() // historical, no FK
      table.string('user_name').nullable()
      table.integer('quantity_before').nullable()
      table.integer('quantity_after').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['tenant_id', 'company_id', 'created_at'], 'stock_movements_created_index')
      table.index(['tenant_id', 'company_id', 'product_id'], 'stock_movements_product_index')
      table.index(['reference_type', 'reference_id'], 'stock_movements_reference_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping } from '../migration_helpers.js'

/**
 * Per-warehouse stock (normalized). Replaces the Firestore
 * warehouse_quantities doc. Mutations happen inside a transaction with
 * SELECT ... FOR UPDATE to avoid lost updates on concurrent sales.
 */
export default class extends BaseSchema {
  protected tableName = 'product_stock_locations'

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
      table
        .integer('warehouse_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('warehouses')
        .onDelete('CASCADE')
      table.integer('quantity').notNullable().defaultTo(0) // >= 0 enforced in services (FOR UPDATE)
      table.integer('alert_threshold').notNullable().defaultTo(0)
      table.timestamp('updated_at', { useTz: true }).nullable()
      table.unique(
        ['tenant_id', 'company_id', 'product_id', 'warehouse_id'],
        'psl_product_warehouse_unique'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

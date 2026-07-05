import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping, addTimestamps } from '../migration_helpers.js'

/**
 * Products (catalog). Prices are BIGINT (FCFA, no decimals).
 * current_stock + status are DENORMALIZED caches recomputed inside the same
 * transaction as stock mutations (source of truth = product_stock_locations).
 */
export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table.string('name').notNullable()
      table.string('code').nullable() // barcode / SKU
      table.string('category').nullable()
      table.string('description').nullable()

      // Prices (FCFA, whole amounts)
      table.bigInteger('purchase_price').notNullable().defaultTo(0)
      table.bigInteger('retail_price').notNullable().defaultTo(0)
      table.bigInteger('wholesale_price').notNullable().defaultTo(0)
      table.integer('wholesale_threshold').notNullable().defaultTo(0)

      // Stock cache (maintained by stock services)
      table.integer('current_stock').notNullable().defaultTo(0)
      table.integer('alert_threshold').notNullable().defaultTo(0)
      table.string('status').notNullable().defaultTo('out') // ok | low | out

      // Default depot + unit
      table
        .integer('warehouse_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('warehouses')
        .onDelete('SET NULL')
      table.string('unit').nullable()

      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('deleted_at', { useTz: true }).nullable() // soft delete

      addTimestamps(table)
      table.index(['tenant_id', 'company_id', 'code'], 'products_code_index')
      table.index(['tenant_id', 'company_id', 'status'], 'products_status_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

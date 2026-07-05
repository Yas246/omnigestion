import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping } from '../migration_helpers.js'

/**
 * Normalized invoice lines (NOT JSONB). product_name / unit_price / purchase_price
 * are snapshotted so historical invoices never change when a product is later
 * renamed or repriced. No FK to products (snapshot survives product deletion).
 */
export default class extends BaseSchema {
  protected tableName = 'invoice_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table.integer('invoice_id').unsigned().notNullable().references('id').inTable('invoices').onDelete('CASCADE')
      table.integer('product_id').unsigned().nullable() // snapshot, no FK
      table.string('product_name').notNullable()
      table.string('product_code').nullable()
      table.integer('quantity').notNullable()
      table.string('unit').nullable()
      table.bigInteger('unit_price').notNullable()
      table.bigInteger('purchase_price').nullable() // snapshot for profit validation
      table.bigInteger('total').notNullable()
      table.boolean('is_wholesale').notNullable().defaultTo(false)
      table.integer('position').nullable()
      table.index(['invoice_id'], 'invoice_items_invoice_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

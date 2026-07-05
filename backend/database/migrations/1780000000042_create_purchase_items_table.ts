import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping } from '../migration_helpers.js'

export default class extends BaseSchema {
  protected tableName = 'purchase_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table.integer('purchase_id').unsigned().notNullable().references('id').inTable('purchases').onDelete('CASCADE')
      table.integer('product_id').unsigned().nullable()
      table.string('product_name').notNullable()
      table.integer('quantity').notNullable()
      table.string('unit').nullable()
      table.bigInteger('unit_price').notNullable()
      table.bigInteger('total').notNullable()
      table.integer('position').nullable()
      table.index(['purchase_id'], 'purchase_items_purchase_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

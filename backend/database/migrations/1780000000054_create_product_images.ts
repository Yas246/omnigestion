import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping, addTimestamps } from '../migration_helpers.js'

/** Product image gallery (multiple images per product, ordered by position). */
export default class extends BaseSchema {
  protected tableName = 'product_images'

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
      table.string('url').notNullable()
      table.string('alt').nullable()
      table.integer('position').notNullable().defaultTo(0)
      addTimestamps(table)
      table.index(['product_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

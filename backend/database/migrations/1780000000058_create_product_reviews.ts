import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping } from '../migration_helpers.js'

/** Product reviews by buyers (one per product per buyer). */
export default class extends BaseSchema {
  protected tableName = 'product_reviews'
  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table.integer('product_id').unsigned().notNullable().references('id').inTable('products').onDelete('CASCADE')
      table.integer('store_account_id').unsigned().notNullable().references('id').inTable('store_accounts').onDelete('CASCADE')
      table.smallint('rating').notNullable()
      table.text('comment').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.unique(['product_id', 'store_account_id'])
      table.index(['product_id'])
    })
  }
  async down() { this.schema.dropTable(this.tableName) }
}

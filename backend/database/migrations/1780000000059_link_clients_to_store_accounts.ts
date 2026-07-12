import { BaseSchema } from '@adonisjs/lucid/schema'

/** Link ERP clients to buyer accounts (nullable — walk-in clients have no link). */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('clients', (table) => {
      table.integer('store_account_id').unsigned().nullable().references('id').inTable('store_accounts').onDelete('SET NULL')
    })
  }
  async down() {
    this.schema.alterTable('clients', (table) => table.dropColumn('store_account_id'))
  }
}

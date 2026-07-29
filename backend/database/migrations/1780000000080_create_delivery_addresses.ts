import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Buyer address book — GLOBAL (linked to a StoreAccount, NOT scoped to a
 * tenant/company, exactly like `store_accounts` itself). A buyer enters their
 * addresses once and reuses them across every merchant they buy from
 * (Amazon-like). When a delivery is created for a given company, the chosen
 * address is SNAPSHOTTED into the scoped `deliveries` table, so the ERP only
 * ever sees the snapshot (no cross-tenant leak).
 */
export default class extends BaseSchema {
  protected tableName = 'delivery_addresses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('store_account_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('store_accounts')
        .onDelete('CASCADE')
      table.string('label', 60).notNullable().defaultTo('domicile')
      table.string('recipient_name', 150).nullable()
      table.text('address').notNullable()
      table.decimal('latitude', 9, 6).nullable()
      table.decimal('longitude', 9, 6).nullable()
      table.string('city', 120).nullable()
      table.boolean('is_default').notNullable().defaultTo(false)
      table.text('notes').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      table.index(['store_account_id'], 'delivery_addresses_account_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping, addTimestamps } from '../migration_helpers.js'

/**
 * A delivery — fulfils a storefront order (invoice channel='store'). Scoped to a
 * tenant+company. The buyer's chosen address is SNAPSHOTTED here (address +
 * lat/lng) so the ERP never needs to read the global `delivery_addresses` rows
 * of other tenants. Money is BIGINT (FCFA, zero decimals) to match invoices.
 *
 * Status flow: pending → assigned → picked_up → in_transit → delivered | failed | cancelled.
 */
export default class extends BaseSchema {
  protected tableName = 'deliveries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)

      table
        .integer('invoice_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('invoices')
        .onDelete('SET NULL')
      table
        .integer('client_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('clients')
        .onDelete('SET NULL')
      table.string('client_name', 200).nullable()
      table
        .integer('store_account_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('store_accounts')
        .onDelete('SET NULL')
      table
        .integer('driver_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.string('driver_name', 200).nullable()

      table.string('status', 20).notNullable().defaultTo('pending')
      table
        .integer('delivery_address_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('delivery_addresses')
        .onDelete('SET NULL')
      // Snapshot of the chosen address at creation time (cross-tenant safe).
      table.text('delivery_address').nullable()
      table.decimal('delivery_latitude', 9, 6).nullable()
      table.decimal('delivery_longitude', 9, 6).nullable()
      table.string('delivery_city', 120).nullable()

      table.timestamp('scheduled_at', { useTz: true }).nullable()
      table.timestamp('assigned_at', { useTz: true }).nullable()
      table.timestamp('picked_up_at', { useTz: true }).nullable()
      table.timestamp('delivered_at', { useTz: true }).nullable()

      // Cash-on-delivery (BIGINT FCFA). Collected at delivery; the cash_movement
      // is created later, when the driver's settlement is validated (see §8b).
      table.bigInteger('cod_amount').notNullable().defaultTo(0)
      table.string('cod_payment_method', 20).nullable()
      table.boolean('cod_collected').notNullable().defaultTo(false)
      // Soft link to driver_settlements once the COD has been reconciled.
      table.integer('settlement_id').unsigned().nullable()

      // QR confirmation token (32-char hex). Generated at assignment; the buyer
      // displays it, the driver scans it, complete() verifies the match.
      table.string('qr_token', 64).nullable()

      table.string('failure_reason', 300).nullable()
      table.integer('created_by_user_id').unsigned().nullable()
      addTimestamps(table)

      // Status machine guard.
      table.check(
        "status in ('pending','assigned','picked_up','in_transit','delivered','failed','cancelled')"
      )

      table.index(['tenant_id', 'company_id', 'status'], 'deliveries_status_index')
      table.index(
        ['tenant_id', 'company_id', 'driver_user_id', 'status'],
        'deliveries_driver_status_index'
      )
      table.index(['tenant_id', 'company_id', 'invoice_id'], 'deliveries_invoice_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

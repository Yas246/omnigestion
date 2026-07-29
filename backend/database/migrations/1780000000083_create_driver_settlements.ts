import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping, addTimestamps } from '../migration_helpers.js'

/**
 * Driver settlement (tournee account) — reconciles the cash-on-delivery a
 * driver collected during a period. The COD is a TWO-STEP flow (plan §8b):
 *   1. On `complete()`, the invoice is settled (paid) but NO cash_movement is
 *      created — the cash is still in the driver's "float".
 *   2. The driver submits a settlement (actual_cash + actual_mobile); an admin
 *      validates it. Only THEN does a cash_movement 'in' (category
 *      'delivery_cod') enter the main register, and the covered deliveries are
 *      marked settled (deliveries.settlement_id).
 *
 * `difference` = expected_cod - actual_cash - actual_mobile. Zero = clean;
 * non-zero = 'discrepancy' for investigation.
 */
export default class extends BaseSchema {
  protected tableName = 'driver_settlements'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)

      table
        .integer('driver_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.string('driver_name', 200).nullable()
      table.string('status', 20).notNullable().defaultTo('open')
      table.timestamp('period_start', { useTz: true }).nullable()
      table.timestamp('period_end', { useTz: true }).nullable()
      table.integer('deliveries_count').notNullable().defaultTo(0)
      table.bigInteger('expected_cod').notNullable().defaultTo(0)
      table.bigInteger('actual_cash').notNullable().defaultTo(0)
      table.bigInteger('actual_mobile').notNullable().defaultTo(0)
      table.bigInteger('difference').notNullable().defaultTo(0)
      table.integer('validated_by_user_id').unsigned().nullable()
      table.timestamp('validated_at', { useTz: true }).nullable()
      table.text('notes').nullable()
      addTimestamps(table)

      table.check("status in ('open','submitted','validated','discrepancy')")

      table.index(
        ['tenant_id', 'company_id', 'driver_user_id', 'status'],
        'driver_settlements_driver_status_index'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

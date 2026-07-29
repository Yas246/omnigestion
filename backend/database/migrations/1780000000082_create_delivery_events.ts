import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping } from '../migration_helpers.js'

/**
 * Delivery timeline + live driver positions, in ONE table discriminated by
 * `type`: 'status_change' rows carry a status + optional note; 'location' rows
 * carry latitude/longitude (lat/lng null for status changes). Used for the
 * dispatch map (live positions) and the per-delivery history. Positions older
 * than 7 days are pruned by a later job (not in this migration).
 */
export default class extends BaseSchema {
  protected tableName = 'delivery_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)

      table
        .integer('delivery_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('deliveries')
        .onDelete('CASCADE')
      table.integer('driver_user_id').unsigned().nullable()
      table.string('type', 20).notNullable()
      table.decimal('latitude', 9, 6).nullable()
      table.decimal('longitude', 9, 6).nullable()
      table.string('status', 20).nullable()
      table.string('note', 300).nullable()
      table.timestamp('recorded_at', { useTz: true }).notNullable()

      table.check("type in ('status_change','location')")

      table.index(['delivery_id', 'recorded_at'], 'delivery_events_delivery_recorded_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Tenants = SaaS customer accounts (the top of the two-level hierarchy).
 * A tenant owns multiple companies. Billing is per-tenant (plan / seats).
 */
export default class extends BaseSchema {
  protected tableName = 'tenants'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('name').notNullable()
      table.string('plan').notNullable().defaultTo('free')
      table.integer('seats_limit').notNullable().defaultTo(5)
      table.integer('seats_used').notNullable().defaultTo(0)
      table.string('status').notNullable().defaultTo('active') // active | suspended
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

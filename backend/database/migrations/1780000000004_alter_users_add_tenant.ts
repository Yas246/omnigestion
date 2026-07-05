import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adds the tenant scoping to the (kit-provided) users table.
 * Every user belongs to exactly one tenant. `is_owner` marks the tenant creator
 * (pays, manages companies + users, implicit access to all companies).
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table.boolean('is_owner').notNullable().defaultTo(false)
      table.index(['tenant_id'], 'users_tenant_id_index')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['tenant_id'], 'users_tenant_id_index')
      table.dropColumn('is_owner')
      table.dropColumn('tenant_id')
    })
  }
}

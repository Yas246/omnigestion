import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Company memberships: links (non-owner) users to the companies they can operate
 * in, with granular per-module permissions. The tenant owner has IMPLICIT access
 * to every company and therefore has NO membership row.
 *
 * permissions: JSONB array of { module: string, actions: string[] }.
 */
export default class extends BaseSchema {
  protected tableName = 'company_memberships'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.integer('company_id').unsigned().notNullable().references('id').inTable('companies').onDelete('CASCADE')
      table.jsonb('permissions').notNullable().defaultTo('[]')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['user_id', 'company_id'], 'company_memberships_user_company_unique')
      table.index(['tenant_id', 'company_id'], 'company_memberships_tenant_company_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

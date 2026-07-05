import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Append-only audit log. Every mutating business action records who/what/when
 * + a before/after snapshot, scoped by tenant (+ optional company — null for
 * tenant-level events). company_id is nullable and user_id is SET NULL on user
 * deletion so the audit trail survives.
 *
 * This is the "someone deleted my invoice" insurance — every serious ERP has it.
 */
export default class extends BaseSchema {
  protected tableName = 'audit_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table.integer('company_id').unsigned().nullable().references('id').inTable('companies').onDelete('CASCADE')
      table.integer('user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.string('user_name', 150).nullable()

      table.string('action', 50).notNullable() // create | update | delete | login | export | ...
      table.string('entity', 80).notNullable() // invoice | client | product | ...
      table.integer('entity_id').nullable()

      table.jsonb('before').nullable()
      table.jsonb('after').nullable()

      table.string('ip_address', 45).nullable()
      table.string('user_agent', 500).nullable()

      table.timestamp('created_at').notNullable()

      table.index(['tenant_id', 'company_id'], 'audit_logs_tenant_company_index')
      table.index(['tenant_id', 'company_id', 'entity'], 'audit_logs_tenant_company_entity_index')
      table.index(['tenant_id', 'company_id', 'created_at'], 'audit_logs_tenant_company_created_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

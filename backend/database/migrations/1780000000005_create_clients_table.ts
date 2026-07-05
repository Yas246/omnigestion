import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Clients = first business module. Every business table carries
 * tenant_id + company_id + a composite index for cheap tenant/company scoping.
 *
 * Money columns are BIGINT (FCFA has no decimals). Denormalized stats
 * (total_purchases, total_amount, current_credit) are running totals maintained
 * atomically by the sales/credits services.
 */
export default class extends BaseSchema {
  protected tableName = 'clients'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table.integer('company_id').unsigned().notNullable().references('id').inTable('companies').onDelete('CASCADE')

      table.string('name').notNullable()
      table.string('code').nullable()
      table.string('phone').nullable()
      table.string('email').nullable()
      table.string('address').nullable()

      // Denormalized stats (FCFA, whole amounts)
      table.bigInteger('total_purchases').notNullable().defaultTo(0)
      table.bigInteger('total_amount').notNullable().defaultTo(0)
      table.bigInteger('current_credit').notNullable().defaultTo(0)
      table.timestamp('last_purchase_date', { useTz: true }).nullable()

      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['tenant_id', 'company_id'], 'clients_tenant_company_index')
      table.index(['tenant_id', 'company_id', 'code'], 'clients_tenant_company_code_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

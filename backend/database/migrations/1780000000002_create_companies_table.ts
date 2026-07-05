import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Companies = business entities owned by a tenant (a tenant has many).
 * All business data (clients, products, invoices, ...) is scoped by company_id.
 */
export default class extends BaseSchema {
  protected tableName = 'companies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants').onDelete('CASCADE')

      table.string('name').notNullable()
      table.string('business_sector').nullable() // commerce | commerce_and_services
      table.string('currency').notNullable().defaultTo('FCFA')

      // West-African fiscal identity
      table.string('tax_id').nullable()
      table.string('ifu').nullable()
      table.string('rccm').nullable()

      // Contact
      table.string('phone').nullable()
      table.string('email').nullable()
      table.string('address').nullable()
      table.string('website').nullable()

      // Branding / invoicing
      table.string('logo_url').nullable()
      table.string('invoice_footer').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['tenant_id'], 'companies_tenant_id_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

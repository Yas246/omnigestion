import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Backs the slogan + description fields CompanyTab already collects (and the
 * controller already allows) but that had no DB columns → values were silently
 * lost on save. Also gives the storefront "À propos" a real data source.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('companies', (table) => {
      table.string('slogan', 200).nullable()
      table.text('description').nullable()
    })
  }

  async down() {
    this.schema.alterTable('companies', (table) => table.dropColumns('slogan', 'description'))
  }
}

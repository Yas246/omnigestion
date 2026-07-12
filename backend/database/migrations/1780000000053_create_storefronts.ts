import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping, addTimestamps } from '../migration_helpers.js'

/**
 * Storefront config (site vitrine) — one row per company. Holds the merchant's
 * template choice + customization (draft `config` + published `published_config`).
 */
export default class extends BaseSchema {
  protected tableName = 'storefronts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table.string('template').notNullable().defaultTo('minimal')
      table.jsonb('config').notNullable().defaultTo('{}')
      table.jsonb('published_config').nullable()
      table.timestamp('published_at', { useTz: true }).nullable()
      addTimestamps(table)
      table.unique(['company_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

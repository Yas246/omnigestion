import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Storefront fields on companies (slug + enabled toggle + banner) + publish
 * flag + main image on products.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('companies', (table) => {
      table.string('store_slug').nullable().unique()
      table.boolean('store_enabled').notNullable().defaultTo(false)
      table.string('banner_url').nullable()
    })
    this.schema.alterTable('products', (table) => {
      table.boolean('published').notNullable().defaultTo(false)
      table.string('main_image_url').nullable()
    })
  }

  async down() {
    this.schema.alterTable('companies', (table) =>
      table.dropColumns('store_slug', 'store_enabled', 'banner_url')
    )
    this.schema.alterTable('products', (table) =>
      table.dropColumns('published', 'main_image_url')
    )
  }
}

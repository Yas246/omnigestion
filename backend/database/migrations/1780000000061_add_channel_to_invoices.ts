import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('invoices', (table) => {
      table.string('channel', 20).notNullable().defaultTo('pos')
    })
  }
  async down() {
    this.schema.alterTable('invoices', (table) => table.dropColumn('channel'))
  }
}

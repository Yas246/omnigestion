import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adds the optional profile fields the UsersTab collects for an employee
 * (job position + phone). Keeps the existing UI fully functional after the
 * Firebase→API rewire.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('position', 150).nullable()
      table.string('phone', 40).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumns('position', 'phone')
    })
  }
}

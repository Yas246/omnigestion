import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping, addTimestamps } from '../migration_helpers.js'

/**
 * Stores AI-generated management reports ( Analyse IA ). The report text comes
 * back from DeepSeek client-side; the user can save it here so it persists.
 * period_start/period_end are stored as plain date strings (yyyy-MM-dd) for
 * display — they are not used in any date arithmetic.
 */
export default class extends BaseSchema {
  protected tableName = 'ai_reports'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table.string('title').notNullable()
      table.string('period_label').notNullable()
      table.string('period_start', 20).nullable()
      table.string('period_end', 20).nullable()
      table.text('content').notNullable()
      table.string('model', 60).notNullable().defaultTo('deepseek-v4-flash')
      addTimestamps(table)
      table.index(['tenant_id', 'company_id', 'created_at'], 'ai_reports_recent_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

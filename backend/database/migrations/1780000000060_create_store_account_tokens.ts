import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Separate token table for StoreAccount (buyer auth). Cannot reuse
 * auth_access_tokens because its FK points to users(id). Same schema as
 * auth_access_tokens but FK → store_accounts. Used by DbAccessTokensProvider
 * configured with { table: 'store_account_tokens', type: 'store_token' }.
 */
export default class extends BaseSchema {
  protected tableName = 'store_account_tokens'
  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('tokenable_id').unsigned().notNullable().references('id').inTable('store_accounts').onDelete('CASCADE')
      table.string('type').notNullable()
      table.string('name').nullable()
      table.string('hash').notNullable()
      table.text('abilities').notNullable()
      table.timestamp('created_at', { useTz: true }).nullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
      table.timestamp('last_used_at', { useTz: true }).nullable()
      table.timestamp('expires_at', { useTz: true }).nullable()
      table.index(['tokenable_id', 'type'])
    })
  }
  async down() { this.schema.dropTable(this.tableName) }
}

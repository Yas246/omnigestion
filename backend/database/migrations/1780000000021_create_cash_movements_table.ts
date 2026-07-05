import { BaseSchema } from '@adonisjs/lucid/schema'
import { addCompanyScoping } from '../migration_helpers.js'

/** Append-only cash ledger. amount is always positive (sign carried by `type`). */
export default class extends BaseSchema {
  protected tableName = 'cash_movements'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      addCompanyScoping(table, this.tableName)
      table.integer('cash_register_id').unsigned().notNullable().references('id').inTable('cash_registers').onDelete('CASCADE')
      table.string('type').notNullable() // in | out | transfer
      table.bigInteger('amount').notNullable() // FCFA, positive
      table.string('category').nullable() // sale | expense | supplier | transfer | adjustment | cancellation
      table.string('description').nullable()
      table.string('reference_type').nullable() // invoice | credit_payment | ...
      table.integer('reference_id').nullable()
      table.integer('target_cash_register_id').unsigned().nullable() // for transfers
      table.integer('user_id').unsigned().nullable()
      table.string('user_name').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['tenant_id', 'company_id', 'created_at'], 'cash_movements_created_index')
      table.index(['cash_register_id'], 'cash_movements_register_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

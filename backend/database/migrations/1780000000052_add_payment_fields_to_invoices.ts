import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Mobile Money / bank payment details on the invoice (for receipts). West
 * Africa POS commonly settles via Mobile Money — the InvoiceDialog already
 * collects these; this persists them.
 */
export default class extends BaseSchema {
  protected tableName = 'invoices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('mobile_number', 40).nullable()
      table.string('bank_name', 100).nullable()
      table.string('account_number', 60).nullable()
      table.string('transaction_number', 100).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumns('mobile_number', 'bank_name', 'account_number', 'transaction_number')
    })
  }
}

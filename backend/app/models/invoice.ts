import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import CompanyScopedModel from '#models/base/company_scoped_model'

export default class Invoice extends CompanyScopedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenantId: number
  @column()
  declare companyId: number

  @column()
  declare invoiceNumber: string
  @column()
  declare clientId: number | null
  @column()
  declare clientName: string | null
  @column.dateTime()
  declare saleDate: DateTime
  @column.dateTime()
  declare dueDate: DateTime | null

  @column()
  declare subtotal: number
  @column()
  declare taxRate: number
  @column()
  declare taxAmount: number
  @column()
  declare discount: number
  @column()
  declare total: number

  @column()
  declare status: string // draft | validated | paid | cancelled
  @column()
  declare paymentMethod: string | null
  @column()
  declare paidAmount: number
  @column()
  declare remainingAmount: number

  @column()
  declare userId: number | null
  @column()
  declare userName: string | null
  @column.dateTime()
  declare paidAt: DateTime | null
  @column.dateTime()
  declare cancelledAt: DateTime | null
  @column()
  declare notes: string | null

  // Mobile Money / bank payment details (receipts)
  @column()
  declare mobileNumber: string | null
  @column()
  declare bankName: string | null
  @column()
  declare accountNumber: string | null
  @column()
  declare transactionNumber: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

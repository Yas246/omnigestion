import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import CompanyScopedModel from '#models/base/company_scoped_model'

export default class SupplierCreditPayment extends CompanyScopedModel {
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare tenantId: number
  @column()
  declare companyId: number

  @column()
  declare supplierCreditId: number
  @column()
  declare amount: number
  @column()
  declare paymentMode: string | null
  @column()
  declare notes: string | null
  @column()
  declare userId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}

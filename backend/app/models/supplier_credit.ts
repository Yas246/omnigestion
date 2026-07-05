import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import CompanyScopedModel from '#models/base/company_scoped_model'

export default class SupplierCredit extends CompanyScopedModel {
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare tenantId: number
  @column()
  declare companyId: number

  @column()
  declare supplierId: number | null
  @column()
  declare supplierName: string
  @column()
  declare purchaseId: number | null
  @column()
  declare purchaseNumber: string | null

  @column()
  declare amount: number
  @column()
  declare amountPaid: number
  @column()
  declare remainingAmount: number
  @column()
  declare status: string // active | partial | paid | cancelled

  @column.dateTime()
  declare date: DateTime
  @column.dateTime()
  declare dueDate: DateTime | null
  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

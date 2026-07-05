import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import CompanyScopedModel from '#models/base/company_scoped_model'

export default class Purchase extends CompanyScopedModel {
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare tenantId: number
  @column()
  declare companyId: number

  @column()
  declare purchaseNumber: string
  @column()
  declare supplierId: number | null
  @column()
  declare supplierName: string | null
  @column.dateTime()
  declare purchaseDate: DateTime

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
  declare status: string // paid | active | partial | cancelled
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
  declare cancelledAt: DateTime | null
  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

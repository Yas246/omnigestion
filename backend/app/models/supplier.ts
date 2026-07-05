import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import CompanyScopedModel from '#models/base/company_scoped_model'

export default class Supplier extends CompanyScopedModel {
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare tenantId: number
  @column()
  declare companyId: number

  @column()
  declare name: string
  @column()
  declare code: string | null
  @column()
  declare phone: string | null
  @column()
  declare email: string | null
  @column()
  declare address: string | null

  @column()
  declare totalPurchases: number
  @column()
  declare totalAmount: number
  @column()
  declare currentDebt: number

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

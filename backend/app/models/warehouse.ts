import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import CompanyScopedModel from '#models/base/company_scoped_model'

export default class Warehouse extends CompanyScopedModel {
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
  declare address: string | null

  @column()
  declare isMain: boolean

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import CompanyScopedModel from '#models/base/company_scoped_model'

/** A saved AI-generated management report ( Analyse IA ). */
export default class AiReport extends CompanyScopedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenantId: number

  @column()
  declare companyId: number

  @column()
  declare title: string

  @column()
  declare periodLabel: string

  @column()
  declare periodStart: string | null

  @column()
  declare periodEnd: string | null

  @column()
  declare content: string

  @column()
  declare model: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

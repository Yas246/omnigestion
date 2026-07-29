import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import CompanyScopedModel from '#models/base/company_scoped_model'

/** Driver settlement (tournee account) — reconciles collected COD. Scoped. */
export default class DriverSettlement extends CompanyScopedModel {
  @column({ isPrimary: true }) declare id: number
  @column() declare tenantId: number
  @column() declare companyId: number
  @column() declare driverUserId: number | null
  @column() declare driverName: string | null
  @column() declare status: string // open|submitted|validated|discrepancy
  @column.dateTime() declare periodStart: DateTime | null
  @column.dateTime() declare periodEnd: DateTime | null
  @column() declare deliveriesCount: number
  @column() declare expectedCod: number
  @column() declare actualCash: number
  @column() declare actualMobile: number
  @column() declare difference: number
  @column() declare validatedByUserId: number | null
  @column.dateTime() declare validatedAt: DateTime | null
  @column() declare notes: string | null
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime
}

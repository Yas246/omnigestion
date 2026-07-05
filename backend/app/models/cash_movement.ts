import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import CompanyScopedModel from '#models/base/company_scoped_model'

/** Append-only cash ledger. amount is positive (sign carried by `type`). */
export default class CashMovement extends CompanyScopedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenantId: number
  @column()
  declare companyId: number

  @column()
  declare cashRegisterId: number
  @column()
  declare type: string // in | out | transfer
  @column()
  declare amount: number
  @column()
  declare category: string | null
  @column()
  declare description: string | null
  @column()
  declare referenceType: string | null
  @column()
  declare referenceId: number | null
  @column()
  declare targetCashRegisterId: number | null
  @column()
  declare userId: number | null
  @column()
  declare userName: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}

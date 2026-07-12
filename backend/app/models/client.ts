import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import CompanyScopedModel from '#models/base/company_scoped_model'

/**
 * First business module — company-scoped client registry.
 * tenant_id + company_id are required by CompanyScopedModel (boot asserts them);
 * money columns (FCFA) are BIGINT; denormalized stats are running totals
 * maintained atomically by the sales/credits services.
 */
export default class Client extends CompanyScopedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenantId: number

  @column()
  declare companyId: number

  @column()
  declare name: string

  @column()
  declare storeAccountId: number | null

  @column()
  declare code: string | null

  @column()
  declare phone: string | null

  @column()
  declare email: string | null

  @column()
  declare address: string | null

  // Denormalized stats (FCFA, whole amounts)
  @column()
  declare totalPurchases: number
  @column()
  declare totalAmount: number
  @column()
  declare currentCredit: number

  @column.dateTime()
  declare lastPurchaseDate: DateTime | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

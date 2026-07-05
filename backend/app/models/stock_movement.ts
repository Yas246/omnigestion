import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import CompanyScopedModel from '#models/base/company_scoped_model'

/**
 * Append-only stock ledger. `quantity` is signed (negative for out / loss /
 * transfer-out). Written via raw query builder inside the mutation transaction.
 */
export default class StockMovement extends CompanyScopedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenantId: number

  @column()
  declare companyId: number

  @column()
  declare productId: number

  @column()
  declare warehouseId: number

  @column()
  declare type: string // in | out | transfer | loss

  @column()
  declare quantity: number

  @column()
  declare reason: string | null

  @column()
  declare referenceType: string | null

  @column()
  declare referenceId: number | null

  @column()
  declare userId: number | null

  @column()
  declare userName: string | null

  @column()
  declare quantityBefore: number | null

  @column()
  declare quantityAfter: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}

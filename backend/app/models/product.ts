import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import CompanyScopedModel from '#models/base/company_scoped_model'

/**
 * Catalog product. Prices are BIGINT (FCFA, whole amounts; mapped to JS number
 * since amounts stay well below 2^53). `currentStock` + `status` are denormalized
 * caches recomputed inside the same transaction as stock mutations.
 */
export default class Product extends CompanyScopedModel {
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
  declare category: string | null

  @column()
  declare description: string | null

  // Prices (FCFA)
  @column()
  declare purchasePrice: number
  @column()
  declare retailPrice: number
  @column()
  declare wholesalePrice: number
  @column()
  declare wholesaleThreshold: number

  // Stock cache
  @column()
  declare currentStock: number
  @column()
  declare alertThreshold: number
  @column()
  declare status: string // ok | low | out

  @column()
  declare warehouseId: number | null

  @column()
  declare unit: string | null

  @column()
  declare isActive: boolean

  @column.dateTime()
  declare deletedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

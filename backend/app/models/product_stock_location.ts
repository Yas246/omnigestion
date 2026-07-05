import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import CompanyScopedModel from '#models/base/company_scoped_model'

/**
 * Per-warehouse stock (source of truth). Mutated inside a transaction with
 * FOR UPDATE by the stock / invoice services.
 */
export default class ProductStockLocation extends CompanyScopedModel {
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
  declare quantity: number

  @column()
  declare alertThreshold: number

  @column.dateTime()
  declare updatedAt: DateTime | null
}

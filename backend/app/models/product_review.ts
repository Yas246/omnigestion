import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import CompanyScopedModel from '#models/base/company_scoped_model'

/** Product review by a buyer. One per product per buyer (unique constraint). */
export default class ProductReview extends CompanyScopedModel {
  @column({ isPrimary: true }) declare id: number
  @column() declare tenantId: number
  @column() declare companyId: number
  @column() declare productId: number
  @column() declare storeAccountId: number
  @column() declare rating: number
  @column() declare comment: string | null
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
}

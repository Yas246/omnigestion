import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import CompanyScopedModel from '#models/base/company_scoped_model'

/** Product gallery image. Ordered by `position` (0 = main). */
export default class ProductImage extends CompanyScopedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenantId: number

  @column()
  declare companyId: number

  @column()
  declare productId: number

  @column()
  declare url: string

  @column()
  declare alt: string | null

  @column()
  declare position: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}

import { column } from '@adonisjs/lucid/orm'
import CompanyScopedModel from '#models/base/company_scoped_model'

export default class PurchaseItem extends CompanyScopedModel {
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare tenantId: number
  @column()
  declare companyId: number

  @column()
  declare purchaseId: number
  @column()
  declare productId: number | null
  @column()
  declare productName: string
  @column()
  declare quantity: number
  @column()
  declare unit: string | null
  @column()
  declare unitPrice: number
  @column()
  declare total: number
  @column()
  declare position: number | null
}

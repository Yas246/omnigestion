import { column } from '@adonisjs/lucid/orm'
import CompanyScopedModel from '#models/base/company_scoped_model'

export default class PurchaseCounter extends CompanyScopedModel {
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare tenantId: number
  @column()
  declare companyId: number
  @column()
  declare prefix: string
  @column()
  declare nextNumber: number
}

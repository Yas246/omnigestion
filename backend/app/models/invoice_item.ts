import { column } from '@adonisjs/lucid/orm'
import CompanyScopedModel from '#models/base/company_scoped_model'

/** Snapshotted invoice line (product_name/unit_price/purchase_price are inert). */
export default class InvoiceItem extends CompanyScopedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenantId: number
  @column()
  declare companyId: number

  @column()
  declare invoiceId: number
  @column()
  declare productId: number | null
  @column()
  declare productName: string
  @column()
  declare productCode: string | null
  @column()
  declare quantity: number
  @column()
  declare unit: string | null
  @column()
  declare unitPrice: number
  @column()
  declare purchasePrice: number | null
  @column()
  declare total: number
  @column()
  declare isWholesale: boolean
  @column()
  declare position: number | null
}

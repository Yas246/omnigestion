import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/**
 * A business entity owned by a tenant. All business data is scoped by company_id.
 */
export default class Company extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenantId: number

  @column()
  declare name: string

  @column()
  declare businessSector: string | null

  @column()
  declare currency: string

  // West-African fiscal identity
  @column()
  declare taxId: string | null
  @column()
  declare ifu: string | null
  @column()
  declare rccm: string | null

  @column()
  declare phone: string | null
  @column()
  declare email: string | null
  @column()
  declare address: string | null
  @column()
  declare website: string | null

  @column()
  declare logoUrl: string | null
  @column()
  declare invoiceFooter: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

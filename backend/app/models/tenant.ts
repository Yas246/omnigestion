import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/**
 * A SaaS customer account. Owns multiple companies. Billing is per-tenant.
 */
export default class Tenant extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare plan: string // free | pro | ...

  @column()
  declare seatsLimit: number

  @column()
  declare seatsUsed: number

  @column()
  declare status: string // active | suspended

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

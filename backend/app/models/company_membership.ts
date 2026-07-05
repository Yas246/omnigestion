import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/**
 * Links a (non-owner) user to a company they can operate in, with granular
 * per-module permissions. The tenant owner has IMPLICIT access to every company
 * and therefore has NO membership row.
 *
 * `permissions` is a JSONB array of { module: string, actions: string[] }.
 */
export default class CompanyMembership extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenantId: number

  @column()
  declare userId: number

  @column()
  declare companyId: number

  @column({
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value ?? []),
    prepare: (value: any) => JSON.stringify(value ?? []),
  })
  declare permissions: Array<{ module: string; actions: string[] }>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

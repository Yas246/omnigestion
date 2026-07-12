import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/**
 * Storefront config for a company (site vitrine). One row per company.
 * `config` is the draft being edited; `publishedConfig` is the live version
 * served by the public storefront route. JSONB columns.
 */
const parseJson = (v: any) => {
  if (v == null) return null
  if (typeof v === 'string') return JSON.parse(v)
  return v
}

export default class Storefront extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenantId: number

  @column()
  declare companyId: number

  @column()
  declare template: string

  @column({ consume: (v: any) => parseJson(v) ?? {}, prepare: (v: any) => JSON.stringify(v ?? {}) })
  declare config: Record<string, any>

  @column({
    consume: (v: any) => parseJson(v),
    prepare: (v: any) => (v == null ? null : JSON.stringify(v)),
  })
  declare publishedConfig: Record<string, any> | null

  @column.dateTime()
  declare publishedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

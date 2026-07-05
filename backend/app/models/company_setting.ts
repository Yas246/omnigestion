import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/** Per-company settings (one row per company). JSONB sections. */
export default class CompanySetting extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare companyId: number

  @column({
    consume: (v: any) => (typeof v === 'string' ? JSON.parse(v) : v ?? {}),
    prepare: (v: any) => JSON.stringify(v ?? {}),
  })
  declare invoice: Record<string, any>

  @column({
    consume: (v: any) => (typeof v === 'string' ? JSON.parse(v) : v ?? {}),
    prepare: (v: any) => JSON.stringify(v ?? {}),
  })
  declare stock: Record<string, any>

  @column({
    consume: (v: any) => (typeof v === 'string' ? JSON.parse(v) : v ?? {}),
    prepare: (v: any) => JSON.stringify(v ?? {}),
  })
  declare backup: Record<string, any>

  @column({
    consume: (v: any) => (typeof v === 'string' ? JSON.parse(v) : v ?? {}),
    prepare: (v: any) => JSON.stringify(v ?? {}),
  })
  declare system: Record<string, any>

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}

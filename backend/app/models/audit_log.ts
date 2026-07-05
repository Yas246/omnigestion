import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/** JSONB column serializer (Postgres returns parsed; we stringify on write). */
const jsonb = {
  consume: (value: any) => (value == null ? null : typeof value === 'string' ? JSON.parse(value) : value),
  prepare: (value: any) => (value == null ? null : JSON.stringify(value)),
}

/**
 * Append-only audit trail. Plain BaseModel (NOT CompanyScopedModel): company_id
 * is nullable (tenant-level events) and rows are never updated — only inserted.
 */
export default class AuditLog extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenantId: number

  @column()
  declare companyId: number | null

  @column()
  declare userId: number | null

  @column()
  declare userName: string | null

  @column()
  declare action: string

  @column()
  declare entity: string

  @column()
  declare entityId: number | null

  @column(jsonb)
  declare before: Record<string, any> | null

  @column(jsonb)
  declare after: Record<string, any> | null

  @column()
  declare ipAddress: string | null

  @column()
  declare userAgent: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}

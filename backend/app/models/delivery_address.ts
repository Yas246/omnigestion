import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/**
 * Buyer address book entry — GLOBAL (linked to a StoreAccount, not scoped to a
 * tenant/company, like `store_accounts` itself). One buyer, many merchants.
 */
export default class DeliveryAddress extends BaseModel {
  @column({ isPrimary: true }) declare id: number
  @column() declare storeAccountId: number
  @column() declare label: string
  @column() declare recipientName: string | null
  @column() declare address: string
  @column() declare latitude: number | null
  @column() declare longitude: number | null
  @column() declare city: string | null
  @column() declare isDefault: boolean
  @column() declare notes: string | null
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime
}

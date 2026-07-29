import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import CompanyScopedModel from '#models/base/company_scoped_model'

/**
 * A delivery — fulfils a storefront order (invoice channel='store'). Scoped.
 * Address snapshot + COD + QR token. Status machine handled by DeliveryService.
 */
export default class Delivery extends CompanyScopedModel {
  @column({ isPrimary: true }) declare id: number
  @column() declare tenantId: number
  @column() declare companyId: number

  @column() declare invoiceId: number | null
  @column() declare clientId: number | null
  @column() declare clientName: string | null
  @column() declare storeAccountId: number | null
  @column() declare driverUserId: number | null
  @column() declare driverName: string | null
  @column() declare status: string // pending|assigned|picked_up|in_transit|delivered|failed|cancelled

  @column() declare deliveryAddressId: number | null
  @column() declare deliveryAddress: string | null
  @column() declare deliveryLatitude: number | null
  @column() declare deliveryLongitude: number | null
  @column() declare deliveryCity: string | null

  @column.dateTime() declare scheduledAt: DateTime | null
  @column.dateTime() declare assignedAt: DateTime | null
  @column.dateTime() declare pickedUpAt: DateTime | null
  @column.dateTime() declare deliveredAt: DateTime | null

  @column() declare codAmount: number
  @column() declare codPaymentMethod: string | null
  @column() declare codCollected: boolean
  @column() declare settlementId: number | null
  @column() declare qrToken: string | null
  @column() declare failureReason: string | null
  @column() declare createdByUserId: number | null

  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime
}

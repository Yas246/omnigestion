import { column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import CompanyScopedModel from '#models/base/company_scoped_model'

/** Delivery timeline + live driver positions, discriminated by `type`. */
export default class DeliveryEvent extends CompanyScopedModel {
  @column({ isPrimary: true }) declare id: number
  @column() declare tenantId: number
  @column() declare companyId: number
  @column() declare deliveryId: number
  @column() declare driverUserId: number | null
  @column() declare type: string // status_change | location
  @column() declare latitude: number | null
  @column() declare longitude: number | null
  @column() declare status: string | null
  @column() declare note: string | null
  @column.dateTime() declare recordedAt: DateTime
}

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
  declare slogan: string | null

  @column()
  declare description: string | null

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

  // Storefront (site vitrine)
  @column()
  declare storeSlug: string | null
  @column()
  declare storeEnabled: boolean
  @column()
  declare bannerUrl: string | null

  /**
   * Auto-generate a unique store_slug at creation (slugified name + short
   * suffix). Editable later in the "Ma vitrine" tab.
   */
  static boot() {
    if (this.booted) return
    super.boot()
    this.before('create', (company: Company) => {
      if (!company.storeSlug && company.name) {
        const base =
          company.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'store'
        company.storeSlug = `${base}-${Math.random().toString(36).slice(2, 6)}`
      }
    })
  }

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

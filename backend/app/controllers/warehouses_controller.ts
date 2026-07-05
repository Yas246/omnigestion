import Warehouse from '#models/warehouse'
import { createWarehouseValidator, updateWarehouseValidator } from '#validators/warehouse'
import { AuditService } from '#services/audit_service'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class WarehousesController {
  async index(ctx: HttpContext) {
    const warehouses = await Warehouse.forContext(ctx)
      .where('isActive', true)
      .orderBy('isMain', 'desc')
      .orderBy('createdAt', 'asc')
    return warehouses.map((w) => w.toJSON())
  }

  async show(ctx: HttpContext) {
    const warehouse = await Warehouse.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    return warehouse.toJSON()
  }

  async store(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(createWarehouseValidator)
    // A company has at most one main warehouse: demote any existing main first.
    // The main warehouse IS the default depot (single concept), so we also keep
    // company_settings.stock.defaultWarehouseId in sync — that's the value the
    // "Dépôt par défaut" select in Settings reflects and InvoiceService reads.
    if (data.isMain) {
      await Warehouse.query()
        .where('tenant_id', ctx.tenantId)
        .where('company_id', ctx.companyId ?? 0)
        .where('is_main', true)
        .update({ isMain: false })
    }
    const warehouse = await Warehouse.create(data)
    if (warehouse.isMain) {
      await this.syncDefaultWarehouse(ctx.companyId ?? 0, warehouse.id)
    }
    await AuditService.log(ctx, {
      action: 'create',
      entity: 'warehouse',
      entityId: warehouse.id,
      after: warehouse.toJSON(),
    })
    return ctx.response.created(warehouse.toJSON())
  }

  async update(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(updateWarehouseValidator)
    const warehouse = await Warehouse.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    const before = warehouse.toJSON()
    warehouse.merge(data)
    if (data.isMain) {
      await Warehouse.query()
        .where('tenant_id', ctx.tenantId)
        .where('company_id', ctx.companyId ?? 0)
        .where('is_main', true)
        .whereNot('id', warehouse.id)
        .update({ isMain: false })
    }
    await warehouse.save()
    if (warehouse.isMain) {
      await this.syncDefaultWarehouse(ctx.companyId ?? 0, warehouse.id)
    }
    await AuditService.log(ctx, {
      action: 'update',
      entity: 'warehouse',
      entityId: warehouse.id,
      before,
      after: warehouse.toJSON(),
    })
    return warehouse.toJSON()
  }

  /**
   * Keep `company_settings.stock.defaultWarehouseId` pointing at the main
   * warehouse (main = default invariant). Upserts the settings row.
   */
  private async syncDefaultWarehouse(companyId: number, warehouseId: number) {
    if (!companyId) return
    const row = await db.from('company_settings').where('company_id', companyId).first()
    const now = new Date()
    if (row) {
      const stock = typeof row.stock === 'string' ? JSON.parse(row.stock) : (row.stock ?? {})
      stock.defaultWarehouseId = warehouseId
      await db.from('company_settings').where('company_id', companyId).update({
        stock: JSON.stringify(stock),
        updated_at: now,
      })
    } else {
      await db.table('company_settings').insert({
        company_id: companyId,
        invoice: '{}',
        stock: JSON.stringify({ defaultWarehouseId: warehouseId }),
        backup: '{}',
        system: '{}',
        updated_at: now,
      })
    }
  }

  async destroy(ctx: HttpContext) {
    const warehouse = await Warehouse.forContext(ctx).where('id', ctx.params.id).firstOrFail()
    // Guard: never silently drop a warehouse that still holds stock.
    const row = await db
      .from('product_stock_locations')
      .where('tenant_id', ctx.tenantId)
      .where('company_id', ctx.companyId ?? 0)
      .where('warehouse_id', warehouse.id)
      .where('quantity', '>', 0)
      .count('* as c')
      .first()
    if (Number((row as any)?.c ?? 0) > 0) {
      return ctx.response.conflict({ message: 'Cannot delete a warehouse that still holds stock' })
    }
    const before = warehouse.toJSON()
    await warehouse.delete()
    await AuditService.log(ctx, { action: 'delete', entity: 'warehouse', entityId: warehouse.id, before })
    return ctx.response.noContent()
  }
}

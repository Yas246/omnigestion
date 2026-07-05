import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Atomic stock operations. Every method runs inside a single `db.transaction`
 * and uses raw query builder ON the transaction client (unambiguous atomicity —
 * no reliance on model→trx binding) with `FOR UPDATE` row locks.
 *
 * `product.current_stock` + `product.status` are recomputed from the source of
 * truth (`product_stock_locations`) inside the same transaction.
 */
const now = () => new Date()

export interface RestockInput {
  productId: number
  warehouseId: number
  quantity: number
  reason?: string | null
}

export interface TransferInput {
  productId: number
  fromWarehouseId: number
  toWarehouseId: number
  quantity: number
  reason?: string | null
}

function userOf(ctx: HttpContext) {
  return { userId: ctx.auth.user?.id ?? null, userName: ctx.auth.user?.fullName ?? null }
}

export const StockService = {
  /** Add stock to a warehouse (type 'in'). Creates the stock location if missing. */
  async restock(ctx: HttpContext, input: RestockInput) {
    if (input.quantity <= 0) throw new Error('Quantity must be positive')
    const { tenantId, companyId } = { tenantId: ctx.tenantId, companyId: ctx.companyId as number }

    return db.transaction(async (trx) => {
      const loc = await this.lockOrCreate(trx, tenantId, companyId, input.productId, input.warehouseId)
      const before = Number(loc.quantity)
      const after = before + input.quantity
      await trx.from('product_stock_locations').where('id', loc.id).update({ quantity: after, updated_at: now() })
      await this.recordMovement(trx, ctx, {
        productId: input.productId,
        warehouseId: input.warehouseId,
        type: 'in',
        quantity: input.quantity,
        reason: input.reason ?? null,
        referenceType: 'restock',
        before,
        after,
      })
      await this.recomputeProduct(trx, tenantId, companyId, input.productId)
      return { before, after }
    })
  },

  /** Remove stock (loss / shrinkage). Signed negative movement. */
  async loss(ctx: HttpContext, input: RestockInput) {
    if (input.quantity <= 0) throw new Error('Quantity must be positive')
    const { tenantId, companyId } = { tenantId: ctx.tenantId, companyId: ctx.companyId as number }

    return db.transaction(async (trx) => {
      const loc = await trx
        .from('product_stock_locations')
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .where('product_id', input.productId)
        .where('warehouse_id', input.warehouseId)
        .forUpdate()
        .first()
      if (!loc) throw new Error('Stock location not found for this product/warehouse')
      const before = Number(loc.quantity)
      if (before < input.quantity) throw new Error('Insufficient stock')
      const after = before - input.quantity
      await trx.from('product_stock_locations').where('id', loc.id).update({ quantity: after, updated_at: now() })
      await this.recordMovement(trx, ctx, {
        productId: input.productId,
        warehouseId: input.warehouseId,
        type: 'loss',
        quantity: -input.quantity,
        reason: input.reason ?? null,
        referenceType: 'adjustment',
        before,
        after,
      })
      await this.recomputeProduct(trx, tenantId, companyId, input.productId)
      return { before, after }
    })
  },

  /** Move stock between two warehouses (two signed movements, source locked first). */
  async transfer(ctx: HttpContext, input: TransferInput) {
    if (input.quantity <= 0) throw new Error('Quantity must be positive')
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new Error('Source and target warehouses must differ')
    }
    const { tenantId, companyId } = { tenantId: ctx.tenantId, companyId: ctx.companyId as number }

    return db.transaction(async (trx) => {
      const from = await trx
        .from('product_stock_locations')
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .where('product_id', input.productId)
        .where('warehouse_id', input.fromWarehouseId)
        .forUpdate()
        .first()
      if (!from) throw new Error('Source stock location not found')
      const fromBefore = Number(from.quantity)
      if (fromBefore < input.quantity) throw new Error('Insufficient stock in source warehouse')

      const to = await trx
        .from('product_stock_locations')
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .where('product_id', input.productId)
        .where('warehouse_id', input.toWarehouseId)
        .forUpdate()
        .first()
      const toBefore = to ? Number(to.quantity) : 0

      await trx.from('product_stock_locations').where('id', from.id).update({
        quantity: fromBefore - input.quantity,
        updated_at: now(),
      })
      if (to) {
        await trx.from('product_stock_locations').where('id', to.id).update({
          quantity: toBefore + input.quantity,
          updated_at: now(),
        })
      } else {
        await trx.table('product_stock_locations').insert({
          tenant_id: tenantId,
          company_id: companyId,
          product_id: input.productId,
          warehouse_id: input.toWarehouseId,
          quantity: toBefore + input.quantity,
          alert_threshold: 0,
          updated_at: now(),
        })
      }

      const { userId, userName } = userOf(ctx)
      await trx.table('stock_movements').insert({
        tenant_id: tenantId,
        company_id: companyId,
        product_id: input.productId,
        warehouse_id: input.fromWarehouseId,
        type: 'transfer',
        quantity: -input.quantity,
        reason: input.reason ?? null,
        reference_type: 'transfer',
        reference_id: null,
        user_id: userId,
        user_name: userName,
        quantity_before: fromBefore,
        quantity_after: fromBefore - input.quantity,
        created_at: now(),
      })
      await trx.table('stock_movements').insert({
        tenant_id: tenantId,
        company_id: companyId,
        product_id: input.productId,
        warehouse_id: input.toWarehouseId,
        type: 'transfer',
        quantity: input.quantity,
        reason: input.reason ?? null,
        reference_type: 'transfer',
        reference_id: null,
        user_id: userId,
        user_name: userName,
        quantity_before: toBefore,
        quantity_after: toBefore + input.quantity,
        created_at: now(),
      })

      await this.recomputeProduct(trx, tenantId, companyId, input.productId)
      return {
        from: { before: fromBefore, after: fromBefore - input.quantity },
        to: { before: toBefore, after: toBefore + input.quantity },
      }
    })
  },

  /** Locks a stock location row (creating it at 0 if missing) for in-transaction update. */
  async lockOrCreate(trx: any, tenantId: number, companyId: number, productId: number, warehouseId: number) {
    let loc = await trx
      .from('product_stock_locations')
      .where('tenant_id', tenantId)
      .where('company_id', companyId)
      .where('product_id', productId)
      .where('warehouse_id', warehouseId)
      .forUpdate()
      .first()
    if (!loc) {
      await trx.table('product_stock_locations').insert({
        tenant_id: tenantId,
        company_id: companyId,
        product_id: productId,
        warehouse_id: warehouseId,
        quantity: 0,
        alert_threshold: 0,
        updated_at: now(),
      })
      loc = await trx
        .from('product_stock_locations')
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .where('product_id', productId)
        .where('warehouse_id', warehouseId)
        .first()
    }
    return loc
  },

  async recordMovement(
    trx: any,
    ctx: HttpContext,
    payload: {
      productId: number
      warehouseId: number
      type: string
      quantity: number
      reason: string | null
      referenceType: string
      referenceId?: number | null
      before: number
      after: number
    }
  ) {
    const { userId, userName } = userOf(ctx)
    await trx.table('stock_movements').insert({
      tenant_id: ctx.tenantId,
      company_id: ctx.companyId,
      product_id: payload.productId,
      warehouse_id: payload.warehouseId,
      type: payload.type,
      quantity: payload.quantity,
      reason: payload.reason,
      reference_type: payload.referenceType,
      reference_id: payload.referenceId ?? null,
      user_id: userId,
      user_name: userName,
      quantity_before: payload.before,
      quantity_after: payload.after,
      created_at: now(),
    })
  },

  /** Recompute product.current_stock + status from product_stock_locations. */
  async recomputeProduct(trx: any, tenantId: number, companyId: number, productId: number) {
    const sumRow = await trx
      .from('product_stock_locations')
      .where('tenant_id', tenantId)
      .where('company_id', companyId)
      .where('product_id', productId)
      .sum('quantity as total')
      .first()
    const total = Number((sumRow as any)?.total ?? 0)
    const product = await trx
      .from('products')
      .where('tenant_id', tenantId)
      .where('company_id', companyId)
      .where('id', productId)
      .first()
    const threshold = Number((product as any)?.alert_threshold ?? 0)
    const status = total <= 0 ? 'out' : threshold > 0 && total <= threshold ? 'low' : 'ok'
    await trx.from('products').where('id', productId).update({
      current_stock: total,
      status,
      updated_at: now(),
    })
  },
}

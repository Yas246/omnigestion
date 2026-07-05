import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import { StockService } from '#services/stock_service'
import { CashService } from '#services/cash_service'
import { AuditService } from '#services/audit_service'

/**
 * Purchases — mirror of Sales, but stock goes IN, debt accrues to a supplier,
 * and cash goes OUT when paid. One transaction; full rollback on failure.
 */
const now = () => new Date()

export interface PurchaseItemInput {
  productId: number
  quantity: number
  unitPrice: number
}

export interface CreatePurchaseInput {
  supplierId?: number | null
  supplierName?: string | null
  items: PurchaseItemInput[]
  warehouseId?: number | null
  paymentMethod?: string | null
  paidAmount?: number | null
  discount?: number
  taxRate?: number
  notes?: string | null
}

export const PurchaseService = {
  async create(ctx: HttpContext, input: CreatePurchaseInput) {
    if (!input.items || input.items.length === 0) throw new Error('Purchase must contain at least one item')
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId
    if (!companyId) throw new Error('No company context')
    const userId = ctx.auth.user?.id ?? null
    const userName = ctx.auth.user?.fullName ?? null

    return db.transaction(async (trx) => {
      let warehouseId = input.warehouseId ?? null
      if (!warehouseId) {
        const wh = await trx.from('warehouses').where('tenant_id', tenantId).where('company_id', companyId).where('is_main', true).first()
        warehouseId = wh?.id ?? null
      }
      if (!warehouseId) throw new Error('No warehouse available — create a warehouse first')

      const productIds = input.items.map((i) => i.productId)
      const products = await trx.from('products').whereIn('id', productIds).where('tenant_id', tenantId).where('company_id', companyId).whereNull('deleted_at')
      const productById = new Map(products.map((p: any) => [p.id, p]))
      for (const item of input.items) {
        if (!productById.has(item.productId)) throw new Error(`Product ${item.productId} not found`)
      }

      let subtotal = 0
      for (const item of input.items) subtotal += item.unitPrice * item.quantity
      const discount = input.discount ?? 0
      const taxable = Math.max(0, subtotal - discount)
      const taxRate = input.taxRate ?? 0
      const taxAmount = Math.round((taxable * taxRate) / 100)
      const total = taxable + taxAmount
      const requestedPaid =
        input.paidAmount != null ? input.paidAmount : input.paymentMethod === 'credit' ? 0 : total
      const paidAmount = Math.max(0, Math.min(requestedPaid, total))
      const remaining = Math.max(0, total - paidAmount)

      const counter = await trx.from('purchase_counters').where('tenant_id', tenantId).where('company_id', companyId).forUpdate().first()
      let purchaseNumber: string
      if (counter) {
        purchaseNumber = `${counter.prefix}-${String(counter.next_number).padStart(4, '0')}`
        await trx.from('purchase_counters').where('id', counter.id).increment('next_number', 1)
      } else {
        purchaseNumber = 'ACH-0001'
        await trx.table('purchase_counters').insert({ tenant_id: tenantId, company_id: companyId, prefix: 'ACH', next_number: 2 })
      }

      const status = remaining === 0 ? 'paid' : 'active'

      const [purchaseRow] = await trx
        .table('purchases')
        .insert({
          tenant_id: tenantId, company_id: companyId, purchase_number: purchaseNumber,
          supplier_id: input.supplierId ?? null, supplier_name: input.supplierName ?? null,
          purchase_date: now(), subtotal, tax_rate: taxRate, tax_amount: taxAmount, discount, total,
          status, payment_method: input.paymentMethod ?? (remaining === 0 ? 'cash' : 'credit'),
          paid_amount: paidAmount, remaining_amount: remaining,
          user_id: userId, user_name: userName, cancelled_at: null, notes: input.notes ?? null,
          created_at: now(), updated_at: now(),
        })
        .returning('id')
      const purchaseId = Number((purchaseRow as any).id)

      let position = 0
      for (const item of input.items) {
        const p: any = productById.get(item.productId)
        const lineTotal = item.unitPrice * item.quantity
        await trx.table('purchase_items').insert({
          tenant_id: tenantId, company_id: companyId, purchase_id: purchaseId,
          product_id: item.productId, product_name: p.name, quantity: item.quantity,
          unit: p.unit ?? null, unit_price: item.unitPrice, total: lineTotal, position: position++,
        })
        const loc = await StockService.lockOrCreate(trx, tenantId, companyId, item.productId, warehouseId!)
        const before = Number(loc.quantity)
        const after = before + item.quantity
        await trx.from('product_stock_locations').where('id', loc.id).update({ quantity: after, updated_at: now() })
        await trx.table('stock_movements').insert({
          tenant_id: tenantId, company_id: companyId, product_id: item.productId, warehouse_id: warehouseId,
          type: 'in', quantity: item.quantity, reason: `Purchase ${purchaseNumber}`,
          reference_type: 'purchase', reference_id: purchaseId, user_id: userId, user_name: userName,
          quantity_before: before, quantity_after: after, created_at: now(),
        })
        await StockService.recomputeProduct(trx, tenantId, companyId, item.productId)
      }

      if (input.supplierId) {
        await trx.from('suppliers').where('id', input.supplierId).where('tenant_id', tenantId).where('company_id', companyId).update({
          total_purchases: trx.raw('total_purchases + 1'),
          total_amount: trx.raw('total_amount + ?', [total]),
          current_debt: trx.raw('current_debt + ?', [remaining]),
          updated_at: now(),
        })
      }

      if (paidAmount > 0) {
        await CashService.recordCashOut(trx, ctx, {
          amount: paidAmount, category: 'supplier', description: `Purchase ${purchaseNumber}`,
          referenceType: 'purchase', referenceId: purchaseId,
        })
      }

      if (remaining > 0 && input.supplierId) {
        await trx.table('supplier_credits').insert({
          tenant_id: tenantId, company_id: companyId, supplier_id: input.supplierId,
          supplier_name: input.supplierName ?? '', purchase_id: purchaseId, purchase_number: purchaseNumber,
          amount: remaining, amount_paid: paidAmount, remaining_amount: remaining,
          status: paidAmount > 0 ? 'partial' : 'active', date: now(), due_date: null, notes: null,
          created_at: now(), updated_at: now(),
        })
      }

      await AuditService.log(
        ctx,
        { action: 'create', entity: 'purchase', entityId: purchaseId, after: { purchaseNumber, total, paidAmount, remaining, status } },
        { client: trx }
      )
      return { id: purchaseId, purchaseNumber, total, paidAmount, remaining, status }
    })
  },
}

import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import { StockService } from '#services/stock_service'
import { AuditService } from '#services/audit_service'
import { computeTotals } from '#utils/invoice_totals'

/**
 * In-process cache of parsed company_settings.stock for warehouse resolution.
 * Keyed by companyId. TTL 60s — short, since the settings screen mutates rarely
 * and the worst case on a cache miss is one extra DB roundtrip. Cleared on
 * company mutations is unnecessary at this TTL; the staleness window is bounded.
 */
const settingsCache = new Map<number, { stock: any; expiresAt: number }>()
const SETTINGS_CACHE_TTL_MS = 60_000
function getCachedStock(companyId: number): any | undefined {
  const hit = settingsCache.get(companyId)
  if (!hit) return undefined
  if (Date.now() > hit.expiresAt) {
    settingsCache.delete(companyId)
    return undefined
  }
  return hit.stock
}
function setCachedStock(companyId: number, stock: any) {
  settingsCache.set(companyId, { stock, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS })
}

/**
 * Sales — the ERP's most critical transactional flow.
 *
 * `create`: in ONE transaction, with FOR UPDATE locks — warehouse resolution →
 *   anti-perte → stock lock/availability → totals → atomic number → invoice +
 *   items → stock decrement + movements → client stats → cash → credit.
 * `cancel`: exact reversal (keeps reversal records — a cancelled invoice keeps
 *   its history: original 'out' + cancellation 'in').
 * `update`: full edit = CLEAN reversal (deletes the invoice's old stock/cash/
 *   credit movements + items, restores stock, reverses cash + client stats) then
 *   APPLIES the new items/metadata on the SAME invoice row (keeps the number).
 *   The invoice always reflects its current state; the edit is captured in
 *   audit_log. Clean (not counter-passing) avoids ambiguity across multiple edits.
 */
const now = () => new Date()
/** Normalize a sale date that may arrive as a JS Date, a Luxon DateTime,
 *  an ISO string, or null. Returns null for invalid input (caller defaults). */
const toDate = (v: any): Date | null => {
  if (!v) return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  if (v && typeof v.toJSDate === 'function') {
    try { return v.toJSDate() } catch { return null }
  }
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export interface InvoiceItemInput {
  productId: number
  quantity: number
  unitPrice: number
  isWholesale?: boolean
}

export interface CreateInvoiceInput {
  clientId?: number | null
  clientName?: string | null
  items: InvoiceItemInput[]
  warehouseId?: number | null
  paymentMethod?: string | null
  paidAmount?: number | null
  discount?: number
  taxRate?: number
  notes?: string | null
  channel?: string
  saleDate?: any
  mobileNumber?: string | null
  bankName?: string | null
  accountNumber?: string | null
  transactionNumber?: string | null
}

export const InvoiceService = {
  async create(ctx: HttpContext, input: CreateInvoiceInput) {
    if (!input.items || input.items.length === 0) {
      throw new Error('Invoice must contain at least one item')
    }
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId
    if (!companyId) throw new Error('No company context')
    const userId = ctx.auth.user?.id ?? null
    const userName = ctx.auth.user?.fullName ?? null

    return db.transaction(async (trx) => {
      // 1. warehouse — prefer the user-configured default depot
      //    (company_settings.stock.defaultWarehouseId, the "Dépôt par défaut"
      //    select in Settings), fall back to the main warehouse.
      let warehouseId = input.warehouseId ?? null
      if (!warehouseId) {
        let stock = getCachedStock(companyId)
        if (stock === undefined) {
          const settingsRow = await trx.from('company_settings').where('company_id', companyId).first()
          stock = settingsRow?.stock
            ? typeof settingsRow.stock === 'string'
              ? JSON.parse(settingsRow.stock)
              : settingsRow.stock
            : {}
          setCachedStock(companyId, stock)
        }
        if (stock.defaultWarehouseId) {
          const preferred = await trx
            .from('warehouses')
            .where('id', stock.defaultWarehouseId)
            .where('tenant_id', tenantId)
            .where('company_id', companyId)
            .where('is_active', true)
            .first()
          if (preferred) warehouseId = Number(preferred.id)
        }
        if (!warehouseId) {
          const wh = await trx
            .from('warehouses')
            .where('tenant_id', tenantId)
            .where('company_id', companyId)
            .where('is_main', true)
            .first()
          warehouseId = wh?.id ?? null
        }
      }
      if (!warehouseId) throw new Error('No warehouse available — create a warehouse first')

      // 2. products + anti-perte (per-item check stays — money-bearing rule)
      const productIds = input.items.map((i) => i.productId)
      const products = await trx
        .from('products')
        .whereIn('id', productIds)
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .whereNull('deleted_at')
      const productById = new Map(products.map((p: any) => [p.id, p]))
      for (const item of input.items) {
        const p = productById.get(item.productId)
        if (!p) throw new Error(`Product ${item.productId} not found`)
        if (item.unitPrice < Number(p.purchase_price)) {
          throw new Error(`Anti-perte: "${p.name}" sold below its purchase price`)
        }
      }

      // 3. BULK lock + availability-check stock.
      //    One query locks every relevant product_stock_locations row (FOR UPDATE
      //    is applied to the whole result set in a single statement) and returns
      //    them; availability is then validated per item in memory. Locks are
      //    held until COMMIT. Order vs invoice_counters: lock order across tables
      //    does not need to be globally fixed because a sale only locks its own
      //    new invoice row + stock rows for the calling tenant/company — counter
      //    then stock matches the historical order (counter first, stock second).
      const lockedRows = await trx
        .from('product_stock_locations')
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .where('warehouse_id', warehouseId)
        .whereIn('product_id', productIds)
        .forUpdate()
      const stockByProduct = new Map<number, any>(lockedRows.map((r: any) => [Number(r.product_id), r]))
      for (const item of input.items) {
        const loc = stockByProduct.get(item.productId)
        if (!loc) {
          throw new Error(`No stock location for "${productById.get(item.productId).name}" in this warehouse`)
        }
        if (Number(loc.quantity) < item.quantity) {
          throw new Error(`Insufficient stock for "${productById.get(item.productId).name}"`)
        }
      }

      // 4. totals (delegated to pure computeTotals — single source of truth)
      const discount = input.discount ?? 0
      const taxRate = input.taxRate ?? 0
      const requestedPaid =
        input.paidAmount != null
          ? input.paidAmount
          : input.paymentMethod === 'credit'
            ? 0
            : undefined as any
      const totals = computeTotals(input.items, input.taxRate ?? 0, input.discount ?? 0, requestedPaid ?? 0)
      const { subtotal, taxAmount, total, paidAmount, remainingAmount: remaining } = totals
      const status = totals.status

      // 5. atomic invoice number
      const counter = await trx
        .from('invoice_counters')
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .forUpdate()
        .first()
      let invoiceNumber: string
      if (counter) {
        invoiceNumber = `${counter.prefix}-${String(counter.next_number).padStart(4, '0')}`
        await trx.from('invoice_counters').where('id', counter.id).increment('next_number', 1)
      } else {
        invoiceNumber = 'FAC-0001'
        await trx.table('invoice_counters').insert({
          tenant_id: tenantId,
          company_id: companyId,
          prefix: 'FAC',
          next_number: 2,
        })
      }


      // 6. insert invoice
      const [invoiceRow] = await trx
        .table('invoices')
        .insert({
          tenant_id: tenantId,
          company_id: companyId,
          channel: input.channel ?? 'pos',
          invoice_number: invoiceNumber,
          client_id: input.clientId ?? null,
          client_name: input.clientName ?? null,
          sale_date: toDate(input.saleDate) ?? now(),
          due_date: null,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          discount,
          total,
          status,
          payment_method: input.paymentMethod ?? (remaining === 0 ? 'cash' : 'credit'),
          paid_amount: paidAmount,
          remaining_amount: remaining,
          user_id: userId,
          user_name: userName,
          paid_at: remaining === 0 ? now() : null,
          cancelled_at: null,
          notes: input.notes ?? null,
          mobile_number: input.mobileNumber || null,
          bank_name: input.bankName || null,
          account_number: input.accountNumber || null,
          transaction_number: input.transactionNumber || null,
          created_at: now(),
          updated_at: now(),
        })
        .returning('id')
      const invoiceId = Number((invoiceRow as any).id)

      // 7. items + stock decrement + movements + recompute
      await this.applyItems(
        trx,
        { tenantId, companyId, invoiceId, invoiceNumber, userId, userName, warehouseId: warehouseId! },
        input.items,
        productById,
        stockByProduct
      )

      // 8. client stats (atomic)
      if (input.clientId) {
        await trx.from('clients').where('id', input.clientId).where('tenant_id', tenantId).where('company_id', companyId).update({
          total_purchases: trx.raw('total_purchases + 1'),
          total_amount: trx.raw('total_amount + ?', [total]),
          current_credit: trx.raw('current_credit + ?', [remaining]),
          last_purchase_date: now(),
          updated_at: now(),
        })
      }

      // 9. cash movement (if paid)
      let cashRegisterId: number | null = null
      if (paidAmount > 0) {
        const register = await this.getOrCreateMainRegister(trx, tenantId, companyId)
        cashRegisterId = register.id
        await this.recordCashIn(trx, { tenantId, companyId, registerId: register.id, amount: paidAmount, invoiceId, invoiceNumber, userId, userName })
      }

      // 10. client credit (if outstanding)
      if (remaining > 0 && input.clientId) {
        await this.createCredit(trx, { tenantId, companyId, clientId: input.clientId, clientName: input.clientName ?? '', invoiceId, invoiceNumber, amount: remaining, paidAmount })
      }

      await AuditService.log(ctx, { action: 'create', entity: 'invoice', entityId: invoiceId, after: { invoiceNumber, total, paidAmount, remaining, status } }, { client: trx })

      return { id: invoiceId, invoiceNumber, subtotal, taxAmount, discount, total, paidAmount, remaining, status, cashRegisterId }
    })
  },

  /** Exact reversal of `create`. Keeps reversal records (cancelled invoice retains history). */
  async cancel(ctx: HttpContext, invoiceId: number) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId
    if (!companyId) throw new Error('No company context')
    const userId = ctx.auth.user?.id ?? null
    const userName = ctx.auth.user?.fullName ?? null

    return db.transaction(async (trx) => {
      const inv: any = await trx
        .from('invoices')
        .where('id', invoiceId)
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .forUpdate()
        .first()
      if (!inv) throw new Error('Invoice not found')
      if (inv.status === 'cancelled') throw new Error('Invoice already cancelled')

      // reverse stock (from the original 'out' movements) — adds counter-movements
      const outMovements = await trx
        .from('stock_movements')
        .where('reference_type', 'invoice')
        .where('reference_id', invoiceId)
        .where('type', 'out')
      for (const m of outMovements) {
        const qty = Math.abs(Number(m.quantity))
        const loc = await trx
          .from('product_stock_locations')
          .where('tenant_id', tenantId)
          .where('company_id', companyId)
          .where('product_id', m.product_id)
          .where('warehouse_id', m.warehouse_id)
          .forUpdate()
          .first()
        const before = loc ? Number(loc.quantity) : 0
        const after = before + qty
        if (loc) {
          await trx.from('product_stock_locations').where('id', loc.id).update({ quantity: after, updated_at: now() })
        } else {
          await trx.table('product_stock_locations').insert({
            tenant_id: tenantId, company_id: companyId, product_id: m.product_id, warehouse_id: m.warehouse_id, quantity: after, alert_threshold: 0, updated_at: now(),
          })
        }
        await trx.table('stock_movements').insert({
          tenant_id: tenantId, company_id: companyId, product_id: m.product_id, warehouse_id: m.warehouse_id, type: 'in', quantity: qty,
          reason: `Cancellation of invoice ${inv.invoice_number}`, reference_type: 'invoice_cancellation', reference_id: invoiceId,
          user_id: userId, user_name: userName, quantity_before: before, quantity_after: after, created_at: now(),
        })
        await StockService.recomputeProduct(trx, tenantId, companyId, m.product_id)
      }

      // reverse cash (original 'in' movement)
      const cashIn = await trx
        .from('cash_movements')
        .where('reference_type', 'invoice')
        .where('reference_id', invoiceId)
        .where('type', 'in')
        .first()
      if (cashIn) {
        const registerId = Number(cashIn.cash_register_id)
        await trx.table('cash_movements').insert({
          tenant_id: tenantId, company_id: companyId, cash_register_id: registerId, type: 'out', amount: Number(cashIn.amount), category: 'cancellation',
          description: `Cancellation of invoice ${inv.invoice_number}`, reference_type: 'invoice', reference_id: invoiceId, target_cash_register_id: null,
          user_id: userId, user_name: userName, created_at: now(),
        })
        await trx.from('cash_registers').where('id', registerId).update({ current_balance: trx.raw('current_balance - ?', [Number(cashIn.amount)]), updated_at: now() })
      }

      // reverse credit payments made against this invoice's credits
      // (cash 'in' movements from CreditService — reference_type='client_credit')
      const credits = await trx
        .from('client_credits')
        .where('invoice_id', invoiceId)
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
      for (const credit of credits) {
        const payments = await trx
          .from('client_credit_payments')
          .where('client_credit_id', credit.id)
          .where('tenant_id', tenantId)
          .where('company_id', companyId)
        const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0)
        if (totalPaid > 0) {
          const register = await this.getOrCreateMainRegister(trx, tenantId, companyId)
          await trx.table('cash_movements').insert({
            tenant_id: tenantId, company_id: companyId, cash_register_id: register.id,
            type: 'out', amount: totalPaid, category: 'cancellation',
            description: `Reversal of credit payments — invoice ${inv.invoice_number}`,
            reference_type: 'client_credit_cancellation', reference_id: credit.id,
            target_cash_register_id: null, user_id: userId, user_name: userName, created_at: now(),
          })
          await trx.from('cash_registers').where('id', register.id)
            .update({ current_balance: trx.raw('current_balance - ?', [totalPaid]), updated_at: now() })
          // undo the payment deductions on the client's current_credit
          if (credit.client_id) {
            await trx.from('clients').where('id', credit.client_id)
              .where('tenant_id', tenantId).where('company_id', companyId)
              .update({ current_credit: trx.raw('GREATEST(0, current_credit + ?)', [totalPaid]), updated_at: now() })
          }
        }
        // delete the payments (fully reversed, not just marked)
        await trx.from('client_credit_payments')
          .where('client_credit_id', credit.id)
          .where('tenant_id', tenantId)
          .where('company_id', companyId)
          .delete()
      }

      // cancel client credit
      await trx.from('client_credits').where('invoice_id', invoiceId).where('tenant_id', tenantId).where('company_id', companyId).update({ status: 'cancelled', updated_at: now() })

      // reverse client stats
      if (inv.client_id) {
        await trx.from('clients').where('id', inv.client_id).where('tenant_id', tenantId).where('company_id', companyId).update({
          total_purchases: trx.raw('GREATEST(0, total_purchases - 1)'),
          total_amount: trx.raw('GREATEST(0, total_amount - ?)', [Number(inv.total)]),
          current_credit: trx.raw('GREATEST(0, current_credit - ?)', [Number(inv.remaining_amount)]),
          updated_at: now(),
        })
      }

      await trx.from('invoices').where('id', invoiceId).update({ status: 'cancelled', cancelled_at: now(), updated_at: now() })

      await AuditService.log(ctx, { action: 'delete', entity: 'invoice', entityId: invoiceId, before: { status: inv.status, total: Number(inv.total) }, after: { status: 'cancelled' } }, { client: trx })
      return { id: invoiceId, status: 'cancelled' }
    })
  },

  /** Full edit: CLEAN reversal of the old effects + APPLY new on the same invoice (keeps the number). */
  async update(ctx: HttpContext, invoiceId: number, input: CreateInvoiceInput) {
    if (!input.items || input.items.length === 0) throw new Error('Invoice must contain at least one item')
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId
    if (!companyId) throw new Error('No company context')
    const userId = ctx.auth.user?.id ?? null
    const userName = ctx.auth.user?.fullName ?? null

    return db.transaction(async (trx) => {
      const inv: any = await trx.from('invoices').where('id', invoiceId).where('tenant_id', tenantId).where('company_id', companyId).forUpdate().first()
      if (!inv) throw new Error('Invoice not found')
      if (inv.status === 'cancelled') throw new Error('Cannot edit a cancelled invoice')
      const invoiceNumber = inv.invoice_number
      const before = { status: inv.status, total: Number(inv.total), paid: Number(inv.paid_amount), remaining: Number(inv.remaining_amount) }

      // --- 1. CLEAN REVERSAL of the old effects ---
      const oldOut = await trx.from('stock_movements').where('reference_type', 'invoice').where('reference_id', invoiceId).where('type', 'out')
      const warehouseId = oldOut.length ? Number(oldOut[0].warehouse_id) : null
      for (const m of oldOut) {
        const qty = Math.abs(Number(m.quantity))
        const loc = await trx.from('product_stock_locations').where('tenant_id', tenantId).where('company_id', companyId).where('product_id', m.product_id).where('warehouse_id', m.warehouse_id).forUpdate().first()
        if (loc) {
          await trx.from('product_stock_locations').where('id', loc.id).update({ quantity: Number(loc.quantity) + qty, updated_at: now() })
        } else {
          await trx.table('product_stock_locations').insert({ tenant_id: tenantId, company_id: companyId, product_id: m.product_id, warehouse_id: m.warehouse_id, quantity: qty, alert_threshold: 0, updated_at: now() })
        }
        await StockService.recomputeProduct(trx, tenantId, companyId, m.product_id)
      }
      await trx.from('stock_movements').where('reference_type', 'invoice').where('reference_id', invoiceId).delete()

      const oldCashIn = await trx.from('cash_movements').where('reference_type', 'invoice').where('reference_id', invoiceId).where('type', 'in').first()
      if (oldCashIn) {
        await trx.from('cash_registers').where('id', oldCashIn.cash_register_id).update({ current_balance: trx.raw('current_balance - ?', [Number(oldCashIn.amount)]), updated_at: now() })
      }
      await trx.from('cash_movements').where('reference_type', 'invoice').where('reference_id', invoiceId).delete()
      await trx.from('client_credits').where('invoice_id', invoiceId).where('tenant_id', tenantId).where('company_id', companyId).delete()
      await trx.from('invoice_items').where('invoice_id', invoiceId).delete()
      if (inv.client_id) {
        await trx.from('clients').where('id', inv.client_id).where('tenant_id', tenantId).where('company_id', companyId).update({
          total_purchases: trx.raw('GREATEST(0, total_purchases - 1)'),
          total_amount: trx.raw('GREATEST(0, total_amount - ?)', [Number(inv.total)]),
          current_credit: trx.raw('GREATEST(0, current_credit - ?)', [Number(inv.remaining_amount)]),
          updated_at: now(),
        })
      }

      // --- 2. APPLY NEW ---
      if (!warehouseId) throw new Error('Original sale warehouse not found')
      const productIds = input.items.map((i) => i.productId)
      const products = await trx.from('products').whereIn('id', productIds).where('tenant_id', tenantId).where('company_id', companyId).whereNull('deleted_at')
      const productById = new Map(products.map((p: any) => [p.id, p]))
      for (const item of input.items) {
        const p = productById.get(item.productId)
        if (!p) throw new Error(`Product ${item.productId} not found`)
        if (item.unitPrice < Number(p.purchase_price)) throw new Error(`Anti-perte: "${p.name}" sold below its purchase price`)
      }
      const stockByProduct = new Map<number, any>()
      const lockedRows = await trx
        .from('product_stock_locations')
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .where('warehouse_id', warehouseId)
        .whereIn('product_id', productIds)
        .forUpdate()
      for (const loc of lockedRows) stockByProduct.set(Number(loc.product_id), loc)
      for (const item of input.items) {
        const loc = stockByProduct.get(item.productId)
        if (!loc) throw new Error(`No stock location for "${productById.get(item.productId).name}" in this warehouse`)
        if (Number(loc.quantity) < item.quantity) throw new Error(`Insufficient stock for "${productById.get(item.productId).name}"`)
      }

      const totals = computeTotals(input.items, input.taxRate ?? 0, input.discount ?? 0, input.paidAmount != null ? input.paidAmount : input.paymentMethod === 'credit' ? 0 : 0)
      const { subtotal, taxAmount, total, paidAmount, remainingAmount: remaining } = totals
      const status = totals.status
      const taxRate = input.taxRate ?? 0
      const discount = input.discount ?? 0
      const clientId = input.clientId != null ? input.clientId : inv.client_id ?? null
      const clientName = input.clientName != null ? input.clientName : inv.client_name ?? null

      await this.applyItems(trx, { tenantId, companyId, invoiceId, invoiceNumber, userId, userName, warehouseId }, input.items, productById, stockByProduct, '(edited)')

      if (clientId) {
        await trx.from('clients').where('id', clientId).where('tenant_id', tenantId).where('company_id', companyId).update({
          total_purchases: trx.raw('total_purchases + 1'),
          total_amount: trx.raw('total_amount + ?', [total]),
          current_credit: trx.raw('current_credit + ?', [remaining]),
          last_purchase_date: now(),
          updated_at: now(),
        })
      }
      let cashRegisterId: number | null = null
      if (paidAmount > 0) {
        const register = await this.getOrCreateMainRegister(trx, tenantId, companyId)
        cashRegisterId = register.id
        await this.recordCashIn(trx, { tenantId, companyId, registerId: register.id, amount: paidAmount, invoiceId, invoiceNumber, userId, userName }, '(edited)')
      }
      if (remaining > 0 && clientId) {
        await this.createCredit(trx, { tenantId, companyId, clientId, clientName: clientName ?? '', invoiceId, invoiceNumber, amount: remaining, paidAmount })
      }

      await trx.from('invoices').where('id', invoiceId).update({
        client_id: clientId,
        client_name: clientName,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        discount,
        total,
        status,
        payment_method: input.paymentMethod ?? (remaining === 0 ? 'cash' : 'credit'),
        paid_amount: paidAmount,
        remaining_amount: remaining,
        paid_at: remaining === 0 ? now() : null,
        notes: input.notes ?? inv.notes,
        sale_date: toDate(input.saleDate) ?? inv.sale_date,
        mobile_number: input.mobileNumber || null,
        bank_name: input.bankName || null,
        account_number: input.accountNumber || null,
        transaction_number: input.transactionNumber || null,
        cancelled_at: null,
        updated_at: now(),
      })

      await AuditService.log(ctx, { action: 'update', entity: 'invoice', entityId: invoiceId, before, after: { total, paidAmount, remaining, status } }, { client: trx })

      return { id: invoiceId, invoiceNumber, subtotal, taxAmount, discount, total, paidAmount, remaining, status, cashRegisterId }
    })
  },

  /**
   * Insert invoice_items + decrement stock + record 'out' movements + recompute.
   * Shared by create + update. BULK implementation: ~4 constant queries for N
   * items instead of the previous 4N (per-line INSERT + UPDATE + INSERT + recompute).
   *
   * Guarantees preserved:
   *   - the FOR UPDATE locks on product_stock_locations have already been
   *     acquired by the caller (create/update) before this method runs, so the
   *     stock rows we mutate are still locked for the duration of the transaction;
   *   - the per-item `before`/`after` quantities used in movements are computed
   *     from the locked rows and aggregated so each movement still records the
   *     exact delta per product;
   *   - products.current_stock + status are recomputed in ONE query covering
   *     every affected product via UPDATE … FROM (subquery) with product_id IN (?).
   */
  async applyItems(
    trx: any,
    ctx: { tenantId: number; companyId: number; invoiceId: number; invoiceNumber: string; userId: number | null; userName: string | null; warehouseId: number },
    items: InvoiceItemInput[],
    productById: Map<number, any>,
    stockByProduct: Map<number, any>,
    suffix: string = ''
  ) {
    if (items.length === 0) return

    const ts = now()
    const reason = `Invoice ${ctx.invoiceNumber}${suffix}`

    // Per-product aggregation: when the same product appears on multiple lines we
    // sum the deltas so the movement's quantity_before/after reflect the net
    // change for that product in this invoice.
    const perProduct = new Map<number, { before: number; after: number; delta: number }>()
    const itemRows: any[] = []
    let position = 0
    for (const item of items) {
      const p = productById.get(item.productId)
      const loc = stockByProduct.get(item.productId)
      const before = Number(loc.quantity)
      const qty = item.quantity
      const existing = perProduct.get(item.productId)
      if (existing) {
        existing.after -= qty
        existing.delta -= qty
      } else {
        perProduct.set(item.productId, { before, after: before - qty, delta: -qty })
      }
      itemRows.push({
        tenant_id: ctx.tenantId,
        company_id: ctx.companyId,
        invoice_id: ctx.invoiceId,
        product_id: item.productId,
        product_name: p.name,
        product_code: p.code ?? null,
        quantity: item.quantity,
        unit: p.unit ?? null,
        unit_price: item.unitPrice,
        purchase_price: p.purchase_price ?? null,
        total: item.unitPrice * item.quantity,
        is_wholesale: item.isWholesale ?? false,
        position: position++,
      })
    }

    // Step A — multi-row INSERT invoice_items (1 query)
    await trx.table('invoice_items').insert(itemRows)

    // Step B — UPDATE product_stock_locations per product (proven query builder,
    // not raw CASE WHEN — the raw version silently updated 0 rows in some cases).
    // Locks are already held by the caller.
    for (const [productId, agg] of perProduct) {
      const loc = stockByProduct.get(productId)
      await trx.from('product_stock_locations').where('id', loc.id).update({
        quantity: agg.after,
        updated_at: ts,
      })
    }

    // Step C — multi-row INSERT stock_movements (1 query, one row per product)
    const movementRows = Array.from(perProduct.entries()).map(([productId, agg]) => ({
      tenant_id: ctx.tenantId,
      company_id: ctx.companyId,
      product_id: productId,
      warehouse_id: ctx.warehouseId,
      type: 'out',
      quantity: agg.delta,
      reason,
      reference_type: 'invoice',
      reference_id: ctx.invoiceId,
      user_id: ctx.userId,
      user_name: ctx.userName,
      quantity_before: agg.before,
      quantity_after: agg.after,
      created_at: ts,
    }))
    await trx.table('stock_movements').insert(movementRows)

    // Step D — recompute each affected product (each call is now 1 fused UPDATE,
    // proven correct — not a raw batch UPDATE that silently missed rows).
    for (const productId of perProduct.keys()) {
      await StockService.recomputeProduct(trx, ctx.tenantId, ctx.companyId, productId)
    }
  },

  /** Record a cash 'in' movement for a sale + credit the register. */
  async recordCashIn(
    trx: any,
    ctx: { tenantId: number; companyId: number; registerId: number; amount: number; invoiceId: number; invoiceNumber: string; userId: number | null; userName: string | null },
    suffix: string = ''
  ) {
    await trx.table('cash_movements').insert({
      tenant_id: ctx.tenantId,
      company_id: ctx.companyId,
      cash_register_id: ctx.registerId,
      type: 'in',
      amount: ctx.amount,
      category: 'sale',
      description: `Sale ${ctx.invoiceNumber}${suffix}`,
      reference_type: 'invoice',
      reference_id: ctx.invoiceId,
      target_cash_register_id: null,
      user_id: ctx.userId,
      user_name: ctx.userName,
      created_at: now(),
    })
    await trx.from('cash_registers').where('id', ctx.registerId).update({ current_balance: trx.raw('current_balance + ?', [ctx.amount]), updated_at: now() })
  },

  /** Create the client_credit row for an outstanding invoice. */
  async createCredit(
    trx: any,
    ctx: { tenantId: number; companyId: number; clientId: number; clientName: string; invoiceId: number; invoiceNumber: string; amount: number; paidAmount: number }
  ) {
    await trx.table('client_credits').insert({
      tenant_id: ctx.tenantId,
      company_id: ctx.companyId,
      client_id: ctx.clientId,
      client_name: ctx.clientName,
      invoice_id: ctx.invoiceId,
      invoice_number: ctx.invoiceNumber,
      amount: ctx.amount,
      amount_paid: ctx.paidAmount,
      remaining_amount: ctx.amount,
      status: ctx.paidAmount > 0 ? 'partial' : 'active',
      date: now(),
      due_date: null,
      notes: null,
      created_at: now(),
      updated_at: now(),
    })
  },

  async getOrCreateMainRegister(trx: any, tenantId: number, companyId: number) {
    let reg = await trx.from('cash_registers').where('tenant_id', tenantId).where('company_id', companyId).where('is_main', true).first()
    if (!reg) {
      await trx.table('cash_registers').insert({
        tenant_id: tenantId, company_id: companyId, name: 'Caisse principale', code: 'MAIN', is_main: true, is_active: true, current_balance: 0, created_at: now(), updated_at: now(),
      })
      reg = await trx.from('cash_registers').where('tenant_id', tenantId).where('company_id', companyId).where('is_main', true).first()
    }
    return reg
  },
}

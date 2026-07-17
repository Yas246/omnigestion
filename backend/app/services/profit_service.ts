import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Profit recognition service — "cost recovery first" approach.
 *
 * Source of truth (ported from lib/utils/profitCalculation.ts → backend).
 * Profit is only counted once purchase costs are fully recovered:
 *   1. The invoice's paidAmount is applied to costs first.
 *   2. Then each credit payment (chronologically) is applied.
 *   3. Profit is only counted when costs are exceeded.
 */

interface ItemRow {
  unit_price: number
  purchase_price: number | null
  quantity: number
  product_id: number | null
  product_name: string
}

interface PaymentRow {
  amount: number
  created_at: Date
}

interface ProfitEntry {
  amount: number
  date: Date
}

/**
 * Core algorithm — pure function, identical to the frontend version.
 * Returns a list of {amount, date} entries representing recognized profit moments.
 */
function computeRecognizedProfits(
  items: ItemRow[],
  paidAmount: number,
  invoiceDate: Date,
  payments: PaymentRow[],
): ProfitEntry[] {
  const profits: ProfitEntry[] = []

  const totalCost = items.reduce(
    (sum, it) => sum + ((Number(it.purchase_price) || 0) * Number(it.quantity)),
    0,
  )

  // No cost → all revenue is profit immediately
  if (totalCost === 0) {
    const totalMargin = items.reduce(
      (sum, it) => sum + Number(it.unit_price) * Number(it.quantity),
      0,
    )
    if (totalMargin > 0) profits.push({ amount: totalMargin, date: invoiceDate })
    return profits
  }

  let costRecovered = paidAmount

  // Immediate profit from paidAmount (if costs exceeded at creation)
  if (costRecovered > totalCost) {
    profits.push({ amount: costRecovered - totalCost, date: invoiceDate })
  }

  // Credit payments chronologically
  const sorted = [...payments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  for (const payment of sorted) {
    if (costRecovered >= totalCost) {
      profits.push({ amount: Number(payment.amount), date: new Date(payment.created_at) })
    } else {
      const stillNeeded = totalCost - costRecovered
      const profit = Math.max(0, Number(payment.amount) - stillNeeded)
      if (profit > 0) profits.push({ amount: profit, date: new Date(payment.created_at) })
    }
    costRecovered += Number(payment.amount)
  }

  return profits
}

export interface ProfitReport {
  kpis: {
    totalRevenue: number
    totalCost: number
    totalMargin: number
    marginRate: number
  }
  byDay: Array<{ date: string; revenue: number; margin: number }>
  byProduct: Array<{
    productId: number | null
    name: string
    revenue: number
    cost: number
    margin: number
    quantity: number
  }>
}

export const ProfitService = {
  /**
   * Compute the full profit report for a period.
   * Fetches invoices + items + credit payments from the DB, applies the
   * cost-recovery algorithm, and aggregates by day + by product.
   */
  async getReport(
    ctx: HttpContext,
    start: Date,
    end: Date,
  ): Promise<ProfitReport> {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId as number

    // 1. Fetch non-cancelled invoices in the period (with items)
    const invoices: any[] = await db
      .from('invoices')
      .where('tenant_id', tenantId)
      .where('company_id', companyId)
      .where('status', '!=', 'cancelled')
      .whereBetween('sale_date', [start, end])
      .select('id', 'invoice_number', 'sale_date', 'paid_amount', 'total')

    if (invoices.length === 0) {
      return {
        kpis: { totalRevenue: 0, totalCost: 0, totalMargin: 0, marginRate: 0 },
        byDay: [],
        byProduct: [],
      }
    }

    const invoiceIds = invoices.map((inv) => inv.id)

    // 2. Fetch invoice items
    const itemRows: any[] = await db
      .from('invoice_items')
      .where('tenant_id', tenantId)
      .where('company_id', companyId)
      .whereIn('invoice_id', invoiceIds)

    const itemsByInvoice = new Map<number, any[]>()
    for (const item of itemRows) {
      const arr = itemsByInvoice.get(item.invoice_id) ?? []
      arr.push(item)
      itemsByInvoice.set(item.invoice_id, arr)
    }

    // 3. Fetch credit payments for credits linked to these invoices
    const credits: any[] = await db
      .from('client_credits')
      .where('tenant_id', tenantId)
      .where('company_id', companyId)
      .whereIn('invoice_id', invoiceIds)
      .select('id', 'invoice_id')

    const creditIds = credits.map((c) => c.id)
    const creditToInvoice = new Map<number, number>()
    for (const c of credits) {
      if (c.invoice_id) creditToInvoice.set(c.id, c.invoice_id)
    }

    let payments: any[] = []
    if (creditIds.length > 0) {
      payments = await db
        .from('client_credit_payments')
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .whereIn('client_credit_id', creditIds)
        .select('amount', 'created_at', 'client_credit_id')
    }

    const paymentsByInvoice = new Map<number, PaymentRow[]>()
    for (const p of payments) {
      const invId = creditToInvoice.get(p.client_credit_id)
      if (invId) {
        const arr = paymentsByInvoice.get(invId) ?? []
        arr.push({ amount: p.amount, created_at: p.created_at })
        paymentsByInvoice.set(invId, arr)
      }
    }

    // 4. Compute recognized profits per invoice
    const dayMap = new Map<string, { revenue: number; margin: number }>()
    const productMap = new Map<
      string,
      { productId: number | null; name: string; revenue: number; cost: number; margin: number; quantity: number }
    >()

    for (const inv of invoices) {
      const items = itemsByInvoice.get(inv.id) ?? []
      const invPayments = paymentsByInvoice.get(inv.id) ?? []
      const invDate = new Date(inv.sale_date)
      const paidAmount = Number(inv.paid_amount) || 0

      // Per-product revenue/cost (for the byProduct aggregation)
      for (const item of items) {
        const key = `${item.product_id}-${item.product_name}`
        const revenue = Number(item.unit_price) * Number(item.quantity)
        const cost = (Number(item.purchase_price) || 0) * Number(item.quantity)
        const existing = productMap.get(key)
        if (existing) {
          existing.revenue += revenue
          existing.cost += cost
          existing.margin += revenue - cost
          existing.quantity += Number(item.quantity)
        } else {
          productMap.set(key, {
            productId: item.product_id,
            name: item.product_name,
            revenue,
            cost,
            margin: revenue - cost,
            quantity: Number(item.quantity),
          })
        }
      }

      // Recognized profit entries (cost-recovery algorithm)
      const profitEntries = computeRecognizedProfits(items, paidAmount, invDate, invPayments)

      // Day key = yyyy-MM-dd
      const dayKey = invDate.toISOString().slice(0, 10)
      const dayEntry = dayMap.get(dayKey) ?? { revenue: 0, margin: 0 }

      // Revenue = recognized profit amounts on this invoice's date
      // (simplified: attribute the invoice's paidAmount as revenue on its date)
      dayEntry.revenue += paidAmount
      for (const p of invPayments) {
        const payDay = new Date(p.created_at).toISOString().slice(0, 10)
        const payEntry = dayMap.get(payDay) ?? { revenue: 0, margin: 0 }
        payEntry.revenue += Number(p.amount)
        dayMap.set(payDay, payEntry)
      }

      // Margin = recognized profit on each date
      for (const pe of profitEntries) {
        const peDay = pe.date.toISOString().slice(0, 10)
        const peEntry = dayMap.get(peDay) ?? { revenue: 0, margin: 0 }
        peEntry.margin += pe.amount
        dayMap.set(peDay, peEntry)
      }

      dayMap.set(dayKey, dayEntry)
    }

    // 5. Sort + aggregate
    const byDay = [...dayMap.entries()]
      .map(([date, v]) => ({ date, revenue: v.revenue, margin: v.margin }))
      .sort((a, b) => (a.date < b.date ? -1 : 1))

    const byProduct = [...productMap.values()]
      .map((p) => ({ ...p, margin: p.revenue - p.cost }))
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 10)

    const totalRevenue = byDay.reduce((s, d) => s + d.revenue, 0)
    const totalMargin = byDay.reduce((s, d) => s + d.margin, 0)
    const totalCost = byProduct.reduce((s, p) => s + p.cost, 0)
    const marginRate = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0

    return {
      kpis: { totalRevenue, totalCost, totalMargin, marginRate },
      byDay,
      byProduct,
    }
  },
}

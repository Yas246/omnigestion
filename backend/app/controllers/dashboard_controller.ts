import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Dashboard — read-only SQL aggregates, all scoped to the current tenant+company.
 *
 * CA RULE: revenue is ALWAYS "encaissé" (money actually received) — never the
 * invoice total. A 20 000 sale paid 10 000 counts 10 000 the sale day; the
 * remaining 10 000 counts the day the credit is settled. So every revenue figure
 * = sum(invoices.paid_amount) + sum(client_credit_payments.amount) over the scope.
 */
export default class DashboardController {
  async index(ctx: HttpContext) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId as number

    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const invScope = (q: any) =>
      q.where('tenant_id', tenantId).where('company_id', companyId).where('status', '!=', 'cancelled')
    const payScope = (q: any) => q.where('tenant_id', tenantId).where('company_id', companyId)

    // --- TODAY (encaissé) ---
    const todayInv = await invScope(db.from('invoices'))
      .whereBetween('sale_date', [startOfDay, endOfDay])
      .sum('paid_amount as total')
      .first()
    const todayCredits = await payScope(db.from('client_credit_payments'))
      .whereBetween('created_at', [startOfDay, endOfDay])
      .sum('amount as total')
      .first()
    const todayRevenue = Number(todayInv?.total ?? 0) + Number(todayCredits?.total ?? 0)

    const todayCountRow = await invScope(db.from('invoices'))
      .whereBetween('sale_date', [startOfDay, endOfDay])
      .count('* as c')
      .first()
    const todayInvoicesCount = Number(todayCountRow?.c ?? 0)

    // --- CREDITS CREATED TODAY (business date = today, non-cancelled) ---
    // The "Crédits du jour" KPI shows credits granted today — not the all-time
    // outstanding total. Filtered by the credit's business `date`, mirroring how
    // revenue uses `sale_date`. Cancelled credits are excluded (voided).
    const creditsTodayRow = await db
      .from('client_credits')
      .where('tenant_id', tenantId)
      .where('company_id', companyId)
      .where('status', '!=', 'cancelled')
      .whereBetween('date', [startOfDay, endOfDay])
      .select(db.raw('COALESCE(SUM(amount), 0) as total'), db.raw('COUNT(*) as c'))
      .first()
    const creditsCreatedToday = Number((creditsTodayRow as any)?.total ?? 0)
    const creditsCreatedTodayCount = Number((creditsTodayRow as any)?.c ?? 0)

    // --- ALL-TIME encaissé ---
    const allTimeInv = await invScope(db.from('invoices')).sum('paid_amount as total').first()
    const allTimeCredits = await payScope(db.from('client_credit_payments')).sum('amount as total').first()
    const totalRevenue = Number(allTimeInv?.total ?? 0) + Number(allTimeCredits?.total ?? 0)

    const activeCreditsRow = await db
      .from('client_credits')
      .where('tenant_id', tenantId)
      .where('company_id', companyId)
      .whereIn('status', ['active', 'partial'])
      .sum('remaining_amount as total')
      .first()

    const count = async (table: string, extra?: (q: any) => void) => {
      const q = db.from(table).where('tenant_id', tenantId).where('company_id', companyId)
      if (extra) extra(q)
      const row = await q.count('* as c').first()
      return Number(row?.c ?? 0)
    }

    const totalInvoices = await count('invoices', (q) => q.where('status', '!=', 'cancelled'))
    const totalProducts = await count('products', (q) => q.whereNull('deleted_at'))
    const totalClients = await count('clients')
    const totalSuppliers = await count('suppliers')

    // --- 7-day series (encaissé per day = invoices paid + credit payments) ---
    const invByDay = await invScope(db.from('invoices'))
      .where('sale_date', '>=', sevenDaysAgo)
      .select(db.raw('DATE(sale_date) as date'))
      .sum('paid_amount as revenue')
      .groupByRaw('DATE(sale_date)')
    const payByDay = await payScope(db.from('client_credit_payments'))
      .where('created_at', '>=', sevenDaysAgo)
      .select(db.raw('DATE(created_at) as date'))
      .sum('amount as revenue')
      .groupByRaw('DATE(created_at)')
    const dayMap = new Map<string, number>()
    for (const r of invByDay) dayMap.set(String(r.date), Number(r.revenue ?? 0))
    for (const r of payByDay) dayMap.set(String(r.date), (dayMap.get(String(r.date)) ?? 0) + Number(r.revenue ?? 0))
    const salesLast7Days = [...dayMap.entries()]
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => (a.date < b.date ? -1 : 1))

    // --- Payment distribution (encaissé by method = invoice paid by method + credit payments by mode) ---
    const invByMethod = await invScope(db.from('invoices'))
      .select('payment_method')
      .sum('paid_amount as total')
      .groupBy('payment_method')
    const payByMode = await payScope(db.from('client_credit_payments'))
      .select('payment_mode')
      .sum('amount as total')
      .groupBy('payment_mode')
    const methodMap = new Map<string, number>()
    for (const r of invByMethod) methodMap.set(String(r.payment_method ?? 'non_défini'), Number(r.total ?? 0))
    for (const r of payByMode) {
      const k = String(r.payment_mode ?? 'non_défini')
      methodMap.set(k, (methodMap.get(k) ?? 0) + Number(r.total ?? 0))
    }
    const paymentDistribution = [...methodMap.entries()].map(([method, revenue]) => ({ method, revenue }))

    // Top 5 products by quantity sold
    const topProducts = await db
      .from('invoice_items')
      .where('tenant_id', tenantId)
      .where('company_id', companyId)
      .select('product_id', 'product_name')
      .sum('quantity as total_quantity')
      .groupBy('product_id', 'product_name')
      .orderBy('total_quantity', 'desc')
      .limit(5)

    // Stock alerts
    const lowStock = await count('products', (q) => q.where('status', 'low').whereNull('deleted_at'))
    const outOfStock = await count('products', (q) => q.where('status', 'out').whereNull('deleted_at'))

    // Today's profit = sum((unit_price - purchase_price) * quantity) over today's invoice lines.
    const profitRow = await db
      .from('invoices')
      .join('invoice_items', 'invoice_items.invoice_id', 'invoices.id')
      .where('invoices.tenant_id', tenantId)
      .where('invoices.company_id', companyId)
      .where('invoices.status', '!=', 'cancelled')
      .whereBetween('invoices.sale_date', [startOfDay, endOfDay])
      .select(
        db.raw(
          'SUM((invoice_items.unit_price - COALESCE(invoice_items.purchase_price, 0)) * invoice_items.quantity) as profit'
        )
      )
      .first()
    const todayProfit = Number((profitRow as any)?.profit ?? 0)

    // Last 5 invoices
    const recent = await invScope(db.from('invoices'))
      .orderBy('sale_date', 'desc')
      .limit(5)
      .select('id', 'invoice_number', 'client_name', 'total', 'status', 'sale_date')

    return {
      today: {
        revenue: todayRevenue,
        invoicesCount: todayInvoicesCount,
        profit: todayProfit,
        creditsCreated: creditsCreatedToday,
        creditsCreatedCount: creditsCreatedTodayCount,
      },
      totals: {
        revenue: totalRevenue,
        activeCredits: Number(activeCreditsRow?.total ?? 0),
        invoices: totalInvoices,
        products: totalProducts,
        clients: totalClients,
        suppliers: totalSuppliers,
      },
      salesLast7Days,
      paymentDistribution,
      topProducts: topProducts.map((r: any) => ({ productId: r.product_id, productName: r.product_name, totalQuantity: Number(r.total_quantity ?? 0) })),
      stock: { low: lowStock, out: outOfStock },
      recentInvoices: recent.map((r: any) => ({
        id: r.id,
        invoiceNumber: r.invoice_number,
        clientName: r.client_name ?? null,
        total: Number(r.total ?? 0),
        status: r.status,
        date: r.sale_date,
      })),
    }
  }
}

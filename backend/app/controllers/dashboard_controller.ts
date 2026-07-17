import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Dashboard — read-only SQL aggregates, all scoped to the current tenant+company.
 *
 * CA RULE: revenue is ALWAYS "encaissé" (money actually received) — never the
 * invoice total. A 20 000 sale paid 10 000 counts 10 000 the sale day; the
 * remaining 10 000 counts the day the credit is settled. So every revenue figure
 * = sum(invoices.paid_amount) + sum(client_credit_payments.amount) over the scope.
 *
 * PERF: all aggregates are independent → fired in a single Promise.all instead
 * of ~18 sequential round-trips (latency ÷3-5 on the most-visited screen).
 */
export default class DashboardController {
  async index(ctx: HttpContext) {
    const tenantId = ctx.tenantId
    const companyId = ctx.companyId as number

    // Optional ?date=yyyy-MM-dd — when provided, compute KPIs for that day
    // instead of "today" (powers the dashboard date picker).
    const dateParam = ctx.request.input('date') as string | undefined
    const now = dateParam ? new Date(dateParam + 'T12:00:00') : new Date()
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

    const count = async (table: string, extra?: (q: any) => void) => {
      const q = db.from(table).where('tenant_id', tenantId).where('company_id', companyId)
      if (extra) extra(q)
      const row = await q.count('* as c').first()
      return Number(row?.c ?? 0)
    }

    // Fire every independent aggregate in parallel (one DB round-trip window).
    const [
      todayInv,
      todayCredits,
      todayCountRow,
      creditsTodayRow,
      allTimeInv,
      allTimeCredits,
      activeCreditsRow,
      totalInvoices,
      totalProducts,
      totalClients,
      totalSuppliers,
      invByDay,
      payByDay,
      invByMethod,
      payByMode,
      topProducts,
      lowStock,
      outOfStock,
      profitRow,
      recent,
    ] = await Promise.all([
      invScope(db.from('invoices')).whereBetween('sale_date', [startOfDay, endOfDay]).sum('paid_amount as total').first(),
      payScope(db.from('client_credit_payments')).whereBetween('created_at', [startOfDay, endOfDay]).sum('amount as total').first(),
      invScope(db.from('invoices')).whereBetween('sale_date', [startOfDay, endOfDay]).count('* as c').first(),
      db
        .from('client_credits')
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .where('status', '!=', 'cancelled')
        .whereBetween('date', [startOfDay, endOfDay])
        .select(db.raw('COALESCE(SUM(amount), 0) as total'), db.raw('COUNT(*) as c'))
        .first(),
      invScope(db.from('invoices')).sum('paid_amount as total').first(),
      payScope(db.from('client_credit_payments')).sum('amount as total').first(),
      db
        .from('client_credits')
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .whereIn('status', ['active', 'partial'])
        .sum('remaining_amount as total')
        .first(),
      count('invoices', (q) => q.where('status', '!=', 'cancelled')),
      count('products', (q) => q.whereNull('deleted_at')),
      count('clients'),
      count('suppliers'),
      invScope(db.from('invoices'))
        .where('sale_date', '>=', sevenDaysAgo)
        .select(db.raw('DATE(sale_date) as date'))
        .sum('paid_amount as revenue')
        .groupByRaw('DATE(sale_date)'),
      payScope(db.from('client_credit_payments'))
        .where('created_at', '>=', sevenDaysAgo)
        .select(db.raw('DATE(created_at) as date'))
        .sum('amount as revenue')
        .groupByRaw('DATE(created_at)'),
      invScope(db.from('invoices')).select('payment_method').sum('paid_amount as total').groupBy('payment_method'),
      payScope(db.from('client_credit_payments')).select('payment_mode').sum('amount as total').groupBy('payment_mode'),
      db
        .from('invoice_items')
        .where('tenant_id', tenantId)
        .where('company_id', companyId)
        .select('product_id', 'product_name')
        .sum('quantity as total_quantity')
        .groupBy('product_id', 'product_name')
        .orderBy('total_quantity', 'desc')
        .limit(5),
      count('products', (q) => q.where('status', 'low').whereNull('deleted_at')),
      count('products', (q) => q.where('status', 'out').whereNull('deleted_at')),
      db
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
        .first(),
      invScope(db.from('invoices'))
        .orderBy('sale_date', 'desc')
        .limit(5)
        .select('id', 'invoice_number', 'client_name', 'total', 'status', 'sale_date'),
    ])

    // --- Derive the response from the parallel results ---
    const todayRevenue = Number(todayInv?.total ?? 0) + Number(todayCredits?.total ?? 0)
    const todayInvoicesCount = Number(todayCountRow?.c ?? 0)
    const creditsCreatedToday = Number((creditsTodayRow as any)?.total ?? 0)
    const creditsCreatedTodayCount = Number((creditsTodayRow as any)?.c ?? 0)
    const totalRevenue = Number(allTimeInv?.total ?? 0) + Number(allTimeCredits?.total ?? 0)

    const dayMap = new Map<string, number>()
    for (const r of invByDay as any[]) dayMap.set(String(r.date), Number(r.revenue ?? 0))
    for (const r of payByDay as any[]) dayMap.set(String(r.date), (dayMap.get(String(r.date)) ?? 0) + Number(r.revenue ?? 0))
    const salesLast7Days = [...dayMap.entries()]
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const methodMap = new Map<string, number>()
    for (const r of invByMethod as any[]) methodMap.set(String(r.payment_method ?? 'non_défini'), Number(r.total ?? 0))
    for (const r of payByMode as any[]) {
      const k = String((r as any).payment_mode ?? 'non_défini')
      methodMap.set(k, (methodMap.get(k) ?? 0) + Number((r as any).total ?? 0))
    }
    const paymentDistribution = [...methodMap.entries()].map(([method, revenue]) => ({ method, revenue }))

    const todayProfit = Number((profitRow as any)?.profit ?? 0)

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
      topProducts: (topProducts as any[]).map((r) => ({
        productId: r.product_id,
        productName: r.product_name,
        totalQuantity: Number(r.total_quantity ?? 0),
      })),
      stock: { low: lowStock, out: outOfStock },
      recentInvoices: (recent as any[]).map((r) => ({
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

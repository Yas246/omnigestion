'use client';

/**
 * Dashboard — API-backed. Maps the backend aggregates to the legacy `stats`
 * shape the dashboard page consumes. `selectedDate` is accepted for interface
 * compatibility but the API currently computes "today" server-side.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

interface DashboardResponse {
  today: { revenue: number; invoicesCount: number; profit: number };
  totals: { revenue: number; activeCredits: number; invoices: number; products: number; clients: number; suppliers: number };
  salesLast7Days: Array<{ date: string; revenue: number }>;
  paymentDistribution: Array<{ method: string | null; revenue: number }>;
  topProducts: Array<{ productId: number | null; productName: string; totalQuantity: number }>;
  stock: { low: number; out: number };
  recentInvoices: Array<{ id: number; invoiceNumber: string; clientName: string | null; total: number; status: string; date: string }>;
}

function mapStats(d: DashboardResponse) {
  const pay: Record<string, number> = { cash: 0, mobile: 0, bank: 0, credit: 0 };
  for (const p of d.paymentDistribution) {
    const key = (p.method ?? 'credit') as keyof typeof pay
    pay[key] = (pay[key] ?? 0) + p.revenue
  }
  return {
    todayRevenue: d.today.revenue,
    todayInvoicesCount: d.today.invoicesCount,
    todayProfit: d.today.profit,
    activeCredits: d.totals.activeCredits,
    totalRevenue: d.totals.revenue,
    totalInvoicesCount: d.totals.invoices,
    totalProducts: d.totals.products,
    totalClients: d.totals.clients,
    lowStockProducts: d.stock.low,
    outOfStockProducts: d.stock.out,
    salesLast7Days: d.salesLast7Days.map((s) => ({ date: s.date, revenue: s.revenue })),
    paymentDistribution: pay,
    topProducts: d.topProducts.map((p) => ({ productName: p.productName, totalQuantity: p.totalQuantity })),
    recentInvoices: d.recentInvoices.map((i) => ({
      id: String(i.id),
      invoiceNumber: i.invoiceNumber,
      clientName: i.clientName ?? 'Client de passage',
      total: i.total,
      status: i.status,
      date: new Date(i.date),
    })),
  }
}

export function useDashboard(_selectedDate?: Date | undefined) {
  const q = useQuery({
    queryKey: ['dashboard'] as const,
    queryFn: async () => mapStats(await api.get<DashboardResponse>('/dashboard')),
  })
  return { stats: q.data ?? null, loading: q.isLoading, error: q.error ? (q.error as Error).message : null }
}

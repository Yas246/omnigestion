'use client';

/** Profit report — API-backed (source of truth = backend profit_service). */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, startOfQuarter, endOfQuarter,
  startOfDay, endOfDay, format,
} from 'date-fns';

type PeriodType = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

function rangeFor(period: PeriodType, customRange?: { from?: Date; to?: Date }) {
  const now = new Date()
  switch (period) {
    case 'today': return { start: startOfDay(now), end: endOfDay(now) }
    case 'week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
    case 'month': return { start: startOfMonth(now), end: endOfMonth(now) }
    case 'quarter': return { start: startOfQuarter(now), end: endOfQuarter(now) }
    case 'year': return { start: startOfYear(now), end: endOfYear(now) }
    case 'custom':
    default:
      if (customRange?.from) {
        return {
          start: startOfDay(customRange.from),
          end: customRange.to ? endOfDay(customRange.to) : endOfDay(customRange.from),
        }
      }
      return { start: startOfMonth(now), end: endOfMonth(now) }
  }
}

export interface ProfitReportData {
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

export function useProfitReport(period: PeriodType, customRange?: { from?: Date; to?: Date }) {
  const { start, end } = rangeFor(period, customRange)
  const from = format(start, 'yyyy-MM-dd')
  const to = format(end, 'yyyy-MM-dd')

  const q = useQuery({
    queryKey: ['profit-report', from, to] as const,
    queryFn: async () => api.get<ProfitReportData>(`/reports/profits?from=${from}&to=${to}`),
  })

  return {
    data: q.data ?? null,
    isLoading: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
  }
}

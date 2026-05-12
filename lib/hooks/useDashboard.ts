'use client';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { startOfDay, endOfDay } from 'date-fns';
import { useAuth } from './useAuth';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { useInvoicesRealtime } from '@/lib/react-query/useInvoicesRealtime';
import { useClientsRealtime } from '@/lib/react-query/useClientsRealtime';
import { useClientCreditsRealtime } from '@/lib/react-query/useClientCreditsRealtime';
import { realtimeService } from '@/lib/services/RealtimeService';
import type { Invoice, Product, ClientCredit } from '@/types';
import { getRecognizedProfitForDate, buildInvoicePaymentsMap } from '@/lib/utils/profitCalculation';

export interface DashboardStats {
  todayRevenue: number;
  todayInvoicesCount: number;
  todayPaidAmount: number;
  activeCredits: number;
  todayProfit: number;

  totalRevenue: number;
  totalInvoicesCount: number;
  totalProducts: number;
  totalClients: number;
  lowStockProducts: number;
  outOfStockProducts: number;

  recentInvoices: Invoice[];
  topProducts: Array<{
    productId: string;
    productName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  paymentDistribution: {
    cash: number;
    mobile: number;
    bank: number;
    credit: number;
  };
  salesLast7Days: Array<{
    date: string;
    revenue: number;
  }>;
}

export function useDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Données depuis le cache React Query (temps réel via onSnapshot)
  const { invoices, isLoading: invoicesLoading } = useInvoicesRealtime();
  const { clients, isLoading: clientsLoading } = useClientsRealtime();
  const { credits, isLoading: creditsLoading } = useClientCreditsRealtime();

  // Produits via React Query cache (populé par RealtimeService.startProductsListener)
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['companies', user?.currentCompanyId, 'products'],
    queryFn: async () => [],
    enabled: !!user?.currentCompanyId,
    staleTime: Infinity,
  });

  // Démarrer le listener produits s'il n'est pas encore actif
  useMemo(() => {
    if (user?.currentCompanyId) {
      realtimeService.startProductsListener(queryClient, user.currentCompanyId);
    }
  }, [user?.currentCompanyId, queryClient]);

  const loading = invoicesLoading || productsLoading || clientsLoading || creditsLoading;

  const stats = useMemo(() => {
    if (!user?.currentCompanyId || loading) return null;

    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);

    // Factures actives (exclure annulées)
    const activeInvoices = invoices.filter(inv => inv.status !== 'cancelled');

    // Factures du jour
    const todayInvoices = activeInvoices.filter(inv => {
      const invDate = new Date(inv.date);
      return invDate >= startOfToday && invDate <= endOfToday;
    });

    // Crédits et paiements (embarqués dans les crédits)
    const allCreditPayments = credits.flatMap((c: any) => (c.payments || []));
    const todayCreditPaymentsTotal = allCreditPayments
      .filter((cp: any) => {
        const cpDate = cp.createdAt instanceof Date ? cp.createdAt : new Date(cp.createdAt);
        return cpDate >= startOfToday && cpDate <= endOfToday;
      })
      .reduce((sum: number, cp: any) => sum + (cp.amount || 0), 0);
    const allCreditPaymentsTotal = allCreditPayments
      .reduce((sum: number, cp: any) => sum + (cp.amount || 0), 0);

    // Stats du jour
    const todayRevenue = todayInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0) + todayCreditPaymentsTotal;
    const todayPaidAmount = todayInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
    const todayInvoicesCount = todayInvoices.length;

    // Crédits actifs du jour
    const activeCredits = credits
      .filter((c: any) => {
        if (c.status === 'paid' || c.status === 'cancelled') return false;
        const creditDate = c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt);
        return creditDate >= startOfToday && creditDate <= endOfToday;
      })
      .reduce((sum: number, c: any) => sum + (c.remainingAmount || 0), 0);

    // Bénéfice du jour
    const invoicePaymentsMap = buildInvoicePaymentsMap(
      credits as ClientCredit[],
      allCreditPayments.map((cp: any) => ({ creditId: cp.creditId, amount: cp.amount, createdAt: cp.createdAt }))
    );

    let todayProfit = 0;
    activeInvoices.forEach(inv => {
      const creditPaymentsForInvoice = invoicePaymentsMap.get(inv.id) || [];
      todayProfit += getRecognizedProfitForDate(
        inv.items,
        inv.paidAmount,
        inv.date,
        creditPaymentsForInvoice,
        today
      );
    });

    // Stats globales
    const totalRevenue = activeInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0) + allCreditPaymentsTotal;
    const totalInvoicesCount = activeInvoices.length;
    const totalProducts = products.length;
    const lowStockProducts = products.filter(p => p.status === 'low').length;
    const outOfStockProducts = products.filter(p => p.status === 'out').length;

    // Dernières factures
    const recentInvoices = [...activeInvoices]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    // Top produits
    const productSales = new Map<string, { productName: string; quantity: number; revenue: number }>();
    activeInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const existing = productSales.get(item.productId);
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += item.total;
        } else {
          productSales.set(item.productId, {
            productName: item.productName,
            quantity: item.quantity,
            revenue: item.total,
          });
        }
      });
    });

    const topProducts = Array.from(productSales.entries())
      .map(([productId, data]) => ({
        productId,
        productName: data.productName,
        totalQuantity: data.quantity,
        totalRevenue: data.revenue,
      }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 5);

    // Distribution des paiements
    const paymentDistribution = { cash: 0, mobile: 0, bank: 0, credit: 0 };
    activeInvoices.forEach(inv => {
      if (inv.paymentMethod === 'cash') paymentDistribution.cash += inv.paidAmount;
      else if (inv.paymentMethod === 'mobile') paymentDistribution.mobile += inv.paidAmount;
      else if (inv.paymentMethod === 'bank') paymentDistribution.bank += inv.paidAmount;
      else if (inv.paymentMethod === 'credit') paymentDistribution.credit += inv.paidAmount;
    });
    allCreditPayments.forEach((cp: any) => {
      if (cp.paymentMode === 'cash') paymentDistribution.cash += cp.amount;
      else if (cp.paymentMode === 'mobile') paymentDistribution.mobile += cp.amount;
      else if (cp.paymentMode === 'bank') paymentDistribution.bank += cp.amount;
    });

    // Ventes des 7 derniers jours
    const salesLast7Days: Array<{ date: string; revenue: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const start = startOfDay(date);
      const end = endOfDay(date);

      const dayInvoiceRevenue = activeInvoices
        .filter(inv => {
          const invDate = new Date(inv.date);
          return invDate >= start && invDate <= end;
        })
        .reduce((sum, inv) => sum + inv.paidAmount, 0);

      const dayCreditPayments = allCreditPayments
        .filter((cp: any) => {
          const cpDate = cp.createdAt instanceof Date ? cp.createdAt : new Date(cp.createdAt);
          return cpDate >= start && cpDate <= end;
        })
        .reduce((sum: number, cp: any) => sum + (cp.amount || 0), 0);

      salesLast7Days.push({
        date: date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
        revenue: dayInvoiceRevenue + dayCreditPayments,
      });
    }

    return {
      todayRevenue,
      todayInvoicesCount,
      todayPaidAmount,
      activeCredits,
      todayProfit,
      totalRevenue,
      totalInvoicesCount,
      totalProducts,
      totalClients: clients.length,
      lowStockProducts,
      outOfStockProducts,
      recentInvoices,
      topProducts,
      paymentDistribution,
      salesLast7Days,
    };
  }, [invoices, products, clients, credits, user, loading]);

  return { stats, loading, error: null };
}

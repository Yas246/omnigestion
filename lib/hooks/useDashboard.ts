'use client';

import { useState, useEffect } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase';
import { useAuth } from './useAuth';
import type { Invoice, Product, DailyStats, ClientCredit } from '@/types';

export interface DashboardStats {
  // Statistiques du jour
  todayRevenue: number;
  todayInvoicesCount: number;
  todayPaidAmount: number;
  activeCredits: number;
  todayProfit: number;

  // Statistiques globales
  totalRevenue: number;
  totalInvoicesCount: number;
  totalProducts: number;
  totalClients: number;
  lowStockProducts: number;
  outOfStockProducts: number;

  // Dernières factures
  recentInvoices: Invoice[];

  // Produits populaires
  topProducts: Array<{
    productId: string;
    productName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;

  // Ventes par mode de paiement
  paymentDistribution: {
    cash: number;
    mobile: number;
    bank: number;
    credit: number;
  };

  // Ventes des 7 derniers jours
  salesLast7Days: Array<{
    date: string;
    revenue: number;
  }>;
}

export function useDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.currentCompanyId) {
      fetchDashboardStats();
    }
  }, [user]);

  const fetchDashboardStats = async () => {
    if (!user?.currentCompanyId) return;

    setLoading(true);
    setError(null);

    try {
      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);

      // 1. Récupérer toutes les factures (pour les stats globales)
      const invoicesRef = collection(db, COLLECTIONS.companyInvoices(user.currentCompanyId));
      const allInvoicesSnap = await getDocs(invoicesRef);
      const allInvoices = allInvoicesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        validatedAt: doc.data().validatedAt?.toDate(),
        paidAt: doc.data().paidAt?.toDate(),
      } as Invoice));

      // 2. Filtrer les factures du jour
      const todayInvoices = allInvoices.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate >= startOfToday && invDate <= endOfToday;
      });

      // 3. Récupérer les produits pour les stats de stock
      const productsRef = collection(db, COLLECTIONS.companyProducts(user.currentCompanyId));
      const productsSnap = await getDocs(productsRef);
      const products = productsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Product));

      // 4. Récupérer les clients
      const clientsRef = collection(db, COLLECTIONS.companyClients(user.currentCompanyId));
      const clientsSnap = await getDocs(clientsRef);
      const totalClients = clientsSnap.size;

      // 4.5. Récupérer les crédits clients pour les statistiques
      const creditsRef = collection(db, COLLECTIONS.companyClientCredits(user.currentCompanyId));
      const creditsSnap = await getDocs(creditsRef);
      const credits = creditsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as ClientCredit));

      // 5. Calculer les statistiques du jour
      const todayRevenue = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const todayPaidAmount = todayInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
      const todayInvoicesCount = todayInvoices.length;

      // Calculer les crédits actifs à partir des crédits réels (pas des factures)
      const activeCredits = credits
        .filter(c => c.status !== 'paid' && c.status !== 'cancelled')
        .reduce((sum, c) => sum + c.remainingAmount, 0);

      // Calculer le bénéfice du jour
      let todayProfit = 0;
      todayInvoices.forEach(inv => {
        inv.items.forEach(item => {
          const purchasePrice = item.purchasePrice || 0;
          const profit = (item.unitPrice - purchasePrice) * item.quantity;
          todayProfit += profit;
        });
      });

      // 6. Statistiques globales
      const totalRevenue = allInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const totalInvoicesCount = allInvoices.length;
      const totalProducts = products.length;
      const lowStockProducts = products.filter(p => p.status === 'low').length;
      const outOfStockProducts = products.filter(p => p.status === 'out').length;

      // 7. Dernières factures (10 dernières)
      const recentInvoices = allInvoices
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

      // 8. Produits populaires
      const productSales = new Map<string, { productName: string; quantity: number; revenue: number }>();
      allInvoices.forEach(inv => {
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

      const topProducts: Array<{
        productId: string;
        productName: string;
        totalQuantity: number;
        totalRevenue: number;
      }> = Array.from(productSales.entries())
        .map(([productId, data]) => ({
          productId,
          productName: data.productName,
          totalQuantity: data.quantity,
          totalRevenue: data.revenue,
        }))
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 5);

      // 9. Distribution des paiements
      const paymentDistribution = {
        cash: 0,
        mobile: 0,
        bank: 0,
        credit: 0,
      };

      allInvoices.forEach(inv => {
        if (inv.paymentMethod === 'cash') paymentDistribution.cash += inv.total;
        else if (inv.paymentMethod === 'mobile') paymentDistribution.mobile += inv.total;
        else if (inv.paymentMethod === 'bank') paymentDistribution.bank += inv.total;
        else if (inv.paymentMethod === 'credit') paymentDistribution.credit += inv.total;
      });

      // 10. Ventes des 7 derniers jours
      const salesLast7Days: Array<{ date: string; revenue: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const startOfDay_i = startOfDay(date);
        const endOfDay_i = endOfDay(date);

        const dayRevenue = allInvoices
          .filter(inv => {
            const invDate = new Date(inv.date);
            return invDate >= startOfDay_i && invDate <= endOfDay_i;
          })
          .reduce((sum, inv) => sum + inv.total, 0);

        salesLast7Days.push({
          date: date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
          revenue: dayRevenue,
        });
      }

      setStats({
        todayRevenue,
        todayInvoicesCount,
        todayPaidAmount,
        activeCredits,
        todayProfit,
        totalRevenue,
        totalInvoicesCount,
        totalProducts,
        totalClients,
        lowStockProducts,
        outOfStockProducts,
        recentInvoices,
        topProducts,
        paymentDistribution,
        salesLast7Days,
      });
    } catch (err) {
      console.error('Erreur lors du chargement des statistiques:', err);
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  return {
    stats,
    loading,
    error,
    refetch: fetchDashboardStats,
  };
}

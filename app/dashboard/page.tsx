"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Package,
  Users,
  Receipt,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import {
  useInvoices,
  useInvoicesLoading,
  useInvoicesStore
} from '@/lib/stores/useInvoicesStore';
import {
  useProducts,
  useProductsLoading
} from '@/lib/stores/useProductsStore';
import { useClients } from '@/lib/stores/useClientsStore';
import { useClientCredits } from '@/lib/hooks/useClientCredits';
import { useAuth } from '@/lib/hooks/useAuth';
import { useMemo, useEffect } from 'react';
import { format, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

// Enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

export default function DashboardPage() {
  // Store selectors
  const invoices = useInvoices();
  const products = useProducts();
  const clients = useClients();
  const invoicesLoading = useInvoicesLoading();
  const productsLoading = useProductsLoading();

  // Credits still use hook (no store yet)
  const { credits } = useClientCredits();
  const { user } = useAuth();

  // Initialize stores on mount
  useEffect(() => {
    if (user?.currentCompanyId && invoices.length === 0) {
      console.log('[DashboardPage] Chargement initial des factures');
      useInvoicesStore.getState().fetchInvoices(user.currentCompanyId, { reset: true });
    }
    // Note: Products and clients are loaded by their respective pages
    // We can rely on localStorage cache
  }, [user?.currentCompanyId, invoices.length]);

  // Calculate all stats from store data
  const stats = useMemo(() => {
    if (invoices.length === 0 && products.length === 0) {
      return null;
    }

    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);

    // Filter today's invoices
    const todayInvoices = invoices.filter(inv => {
      const invDate = new Date(inv.date);
      return invDate >= startOfToday && invDate <= endOfToday;
    });

    // Today's stats
    const todayRevenue = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const todayPaidAmount = todayInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
    const todayInvoicesCount = todayInvoices.length;

    // Active credits
    const activeCredits = credits
      .filter(c => c.status !== 'paid' && c.status !== 'cancelled')
      .reduce((sum, c) => sum + c.remainingAmount, 0);

    // Today's profit
    let todayProfit = 0;
    todayInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const purchasePrice = item.purchasePrice || 0;
        const profit = (item.unitPrice - purchasePrice) * item.quantity;
        todayProfit += profit;
      });
    });

    // Global stats
    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalInvoicesCount = invoices.length;
    const totalProducts = products.length;
    const totalClients = clients.length;
    const lowStockProducts = products.filter(p => p.status === 'low').length;
    const outOfStockProducts = products.filter(p => p.status === 'out').length;

    // Recent invoices (10 most recent)
    const recentInvoices = [...invoices]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    // Top 5 products
    const productSales = new Map<string, { productName: string; quantity: number; revenue: number }>();
    invoices.forEach(inv => {
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

    // Payment distribution
    const paymentDistribution = {
      cash: 0,
      mobile: 0,
      bank: 0,
      credit: 0,
    };

    invoices.forEach(inv => {
      if (inv.paymentMethod === 'cash') paymentDistribution.cash += inv.total;
      else if (inv.paymentMethod === 'mobile') paymentDistribution.mobile += inv.total;
      else if (inv.paymentMethod === 'bank') paymentDistribution.bank += inv.total;
      else if (inv.paymentMethod === 'credit') paymentDistribution.credit += inv.total;
    });

    // Sales last 7 days
    const salesLast7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const startOfDay_i = startOfDay(date);
      const endOfDay_i = endOfDay(date);

      const dayRevenue = invoices
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

    return {
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
    };
  }, [invoices, products, clients, credits]);

  const loading = invoicesLoading || productsLoading;

  const currency = "FCFA"; // TODO: Récupérer depuis les paramètres de l'entreprise

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">
          Aucune donnée disponible
        </p>
      </div>
    );
  }

  // Préparer les données pour les graphiques
  const salesChartData = {
    labels: stats.salesLast7Days.map((d) => d.date),
    datasets: [
      {
        label: "Chiffre d'affaires",
        data: stats.salesLast7Days.map((d) => d.revenue),
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const paymentChartData = {
    labels: ["Espèces", "Mobile Money", "Banque", "Crédit"],
    datasets: [
      {
        data: [
          stats.paymentDistribution.cash,
          stats.paymentDistribution.mobile,
          stats.paymentDistribution.bank,
          stats.paymentDistribution.credit,
        ],
        backgroundColor: [
          "rgba(34, 197, 94, 0.8)",
          "rgba(249, 115, 22, 0.8)",
          "rgba(59, 130, 246, 0.8)",
          "rgba(239, 68, 68, 0.8)",
        ],
      },
    ],
  };

  const topProductsChartData = {
    labels: stats.topProducts.map((p) =>
      p.productName.length > 20
        ? p.productName.substring(0, 20) + "..."
        : p.productName,
    ),
    datasets: [
      {
        label: "Quantité vendue",
        data: stats.topProducts.map((p) => p.totalQuantity),
        backgroundColor: "rgba(59, 130, 246, 0.8)",
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR").format(price);
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground">
          Vue d'ensemble de votre activité
        </p>
      </div>

      {/* Statistiques du jour */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA du jour</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(stats.todayRevenue)} {currency}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.todayInvoicesCount} facture(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Encaissé aujourd'hui
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatPrice(stats.todayPaidAmount)} {currency}
            </div>
            <p className="text-xs text-muted-foreground">Paiements reçus</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Crédits actifs
            </CardTitle>
            <Receipt className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatPrice(stats.activeCredits)} {currency}
            </div>
            <p className="text-xs text-muted-foreground">Reste à payer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Bénéfice estimé
            </CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatPrice(stats.todayProfit)} {currency}
            </div>
            <p className="text-xs text-muted-foreground">Marge du jour</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertes de stock */}
      {(stats.lowStockProducts > 0 || stats.outOfStockProducts > 0) && (
        <Card className="border-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Alertes de stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {stats.outOfStockProducts > 0 && (
                <Badge variant="destructive" className="text-sm px-3 py-1">
                  {stats.outOfStockProducts} produit(s) en rupture
                </Badge>
              )}
              {stats.lowStockProducts > 0 && (
                <Badge
                  variant="outline"
                  className="text-sm px-3 py-1 border-orange-500 text-orange-600"
                >
                  {stats.lowStockProducts} produit(s) stock bas
                </Badge>
              )}
            </div>
            <Link href="/stock">
              <Button variant="link" className="mt-2 p-0 h-auto">
                Voir le stock →
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Graphiques */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Ventes des 7 derniers jours */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Ventes des 7 derniers jours</CardTitle>
            <CardDescription>Évolution du chiffre d'affaires</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <Line data={salesChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        {/* Répartition des paiements */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Répartition des paiements</CardTitle>
            <CardDescription>Par mode de paiement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              <Doughnut
                data={paymentChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom",
                      labels: {
                        boxWidth: 12,
                        padding: 15,
                      },
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top produits et dernières factures */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top 5 produits */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 produits</CardTitle>
            <CardDescription>Les plus vendus</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <Bar data={topProductsChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        {/* Dernières factures */}
        <Card>
          <CardHeader>
            <CardTitle>Dernières factures</CardTitle>
            <CardDescription>Transactions récentes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[250px] overflow-y-auto">
              {stats.recentInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune facture
                </p>
              ) : (
                stats.recentInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {invoice.invoiceNumber}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {invoice.clientName || "Client de passage"}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-medium">
                        {formatPrice(invoice.total)} {currency}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(invoice.date), "dd/MM", {
                          locale: fr,
                        })}
                      </span>
                    </div>
                    <Badge
                      variant={
                        invoice.status === "paid"
                          ? "default"
                          : invoice.status === "validated"
                            ? "outline"
                            : invoice.status === "draft"
                              ? "secondary"
                              : "destructive"
                      }
                      className="ml-2"
                    >
                      {invoice.status === "paid"
                        ? "Payée"
                        : invoice.status === "validated"
                          ? "Validée"
                          : invoice.status === "draft"
                            ? "Brouillon"
                            : "Annulée"}
                    </Badge>
                  </div>
                ))
              )}
            </div>
            <Link href="/sales">
              <Button variant="link" className="w-full mt-2">
                Voir toutes les factures →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Statistiques globales */}
      <Card>
        <CardHeader>
          <CardTitle>Statistiques globales</CardTitle>
          <CardDescription>Vue d'ensemble de votre entreprise</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3">
              <Receipt className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total factures</p>
                <p className="text-2xl font-bold">{stats.totalInvoicesCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">CA total</p>
                <p className="text-2xl font-bold">
                  {formatPrice(stats.totalRevenue)} {currency}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Produits</p>
                <p className="text-2xl font-bold">{stats.totalProducts}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Clients</p>
                <p className="text-2xl font-bold">{stats.totalClients}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation rapide */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Link href="/sales">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <Receipt className="h-8 w-8 text-blue-600 mb-2" />
              <span className="text-sm font-medium">Ventes</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/stock">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <Package className="h-8 w-8 text-purple-600 mb-2" />
              <span className="text-sm font-medium">Stock</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/clients">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <Users className="h-8 w-8 text-orange-600 mb-2" />
              <span className="text-sm font-medium">Clients</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/suppliers">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <Package className="h-8 w-8 text-green-600 mb-2" />
              <span className="text-sm font-medium">Fournisseurs</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/cash">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <DollarSign className="h-8 w-8 text-yellow-600 mb-2" />
              <span className="text-sm font-medium">Caisse</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex flex-col items-center justify-center p-6">
              <AlertTriangle className="h-8 w-8 text-gray-600 mb-2" />
              <span className="text-sm font-medium">Paramètres</span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard, KpiCardHeader, KpiCardValue } from "@/components/ui/kpi-card";
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
import { usePermissions } from '@/lib/hooks/usePermissions';
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
  const router = useRouter();
  const { hasPermission, getFirstAccessiblePage } = usePermissions();

  // Store selectors
  const invoices = useInvoices();
  const products = useProducts();
  const clients = useClients();
  const invoicesLoading = useInvoicesLoading();
  const productsLoading = useProductsLoading();

  // Credits still use hook (no store yet)
  const { credits } = useClientCredits();
  const { user } = useAuth();

  // Vérifier les permissions et rediriger si nécessaire
  useEffect(() => {
    if (!hasPermission('dashboard', 'read')) {
      const firstAccessiblePage = getFirstAccessiblePage();
      router.push(firstAccessiblePage);
    }
  }, [hasPermission, getFirstAccessiblePage, router]);

  // Afficher un message si l'utilisateur n'a pas accès au dashboard
  if (!hasPermission('dashboard', 'read')) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Initialize stores on mount
  useEffect(() => {
    if (user?.currentCompanyId && invoices.length === 0) {
      console.log('[DashboardPage] Chargement initial des factures (pagination normale)');
      // Charger les factures avec pagination normale (20)
      useInvoicesStore.getState().fetchInvoices(user.currentCompanyId, { reset: true });
    }
    // Products et clients sont chargés par leurs pages respectives
    // On compte sur le cache localStorage pour le Dashboard
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

    // Stock alerts
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
        <KpiCard variant="primary">
          <KpiCardHeader
            title="CA du jour"
            icon={<DollarSign className="h-4 w-4" />}
            iconVariant="primary"
          />
          <KpiCardValue
            value={`${formatPrice(stats.todayRevenue)} ${currency}`}
            label={`${stats.todayInvoicesCount} facture(s)`}
            variant="primary"
          />
        </KpiCard>

        <KpiCard variant="success">
          <KpiCardHeader
            title="Encaissé aujourd'hui"
            icon={<DollarSign className="h-4 w-4" />}
            iconVariant="success"
          />
          <KpiCardValue
            value={`${formatPrice(stats.todayPaidAmount)} ${currency}`}
            label="Paiements reçus"
            variant="success"
          />
        </KpiCard>

        <KpiCard variant="warning">
          <KpiCardHeader
            title="Crédits actifs"
            icon={<Receipt className="h-4 w-4" />}
            iconVariant="warning"
          />
          <KpiCardValue
            value={`${formatPrice(stats.activeCredits)} ${currency}`}
            label="Reste à payer"
            variant="warning"
          />
        </KpiCard>

        <KpiCard variant="info">
          <KpiCardHeader
            title="Bénéfice estimé"
            icon={<DollarSign className="h-4 w-4" />}
            iconVariant="info"
          />
          <KpiCardValue
            value={`${formatPrice(stats.todayProfit)} ${currency}`}
            label="Marge du jour"
            variant="info"
          />
        </KpiCard>
      </div>

      {/* Alertes de stock */}
      {(stats.lowStockProducts > 0 || stats.outOfStockProducts > 0) && (
        <Card className="relative overflow-hidden border-destructive/50 bg-linear-to-br from-destructive/5 to-destructive/10">
          {/* Decorative gradient background */}
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 bg-destructive -translate-y-1/2 translate-x-1/2" />

          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              Alertes de stock
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex flex-wrap gap-3">
              {stats.outOfStockProducts > 0 && (
                <Badge variant="destructive" className="text-sm px-4 py-1.5 shadow-sm">
                  {stats.outOfStockProducts} produit(s) en rupture
                </Badge>
              )}
              {stats.lowStockProducts > 0 && (
                <Badge
                  variant="outline"
                  className="text-sm px-4 py-1.5 border-destructive/50 text-destructive bg-destructive/5 shadow-sm"
                >
                  {stats.lowStockProducts} produit(s) stock bas
                </Badge>
              )}
            </div>
            <Link href="/stock">
              <Button variant="link" className="mt-3 p-0 h-auto text-destructive hover:text-destructive/80">
                Voir le stock →
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Graphiques */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Ventes des 7 derniers jours */}
        <Card className="col-span-4 border-primary/20 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-primary">Ventes des 7 derniers jours</CardTitle>
            <CardDescription>Évolution du chiffre d'affaires</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <Line data={salesChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        {/* Répartition des paiements */}
        <Card className="col-span-3 border-info/20 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-[oklch(0.68_0.10_200)]">Répartition des paiements</CardTitle>
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
        <Card className="border-success/20 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-[oklch(0.65_0.12_145)]">Top 5 produits</CardTitle>
            <CardDescription>Les plus vendus</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <Bar data={topProductsChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        {/* Dernières factures */}
        <Card className="border-warning/20 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-[oklch(0.75_0.15_75)]">Dernières factures</CardTitle>
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

      {/* Navigation rapide */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Link href="/sales" className="group">
          <KpiCard variant="primary" className="cursor-pointer transition-all duration-200 hover:-translate-y-1">
            <div className="flex flex-col items-center justify-center gap-3">
              <Receipt className="h-8 w-8 transition-transform duration-200 group-hover:scale-110" />
              <span className="text-sm font-medium">Ventes</span>
            </div>
          </KpiCard>
        </Link>

        <Link href="/stock" className="group">
          <KpiCard variant="info" className="cursor-pointer transition-all duration-200 hover:-translate-y-1">
            <div className="flex flex-col items-center justify-center gap-3">
              <Package className="h-8 w-8 transition-transform duration-200 group-hover:scale-110" />
              <span className="text-sm font-medium">Stock</span>
            </div>
          </KpiCard>
        </Link>

        <Link href="/clients" className="group">
          <KpiCard variant="warning" className="cursor-pointer transition-all duration-200 hover:-translate-y-1">
            <div className="flex flex-col items-center justify-center gap-3">
              <Users className="h-8 w-8 transition-transform duration-200 group-hover:scale-110" />
              <span className="text-sm font-medium">Clients</span>
            </div>
          </KpiCard>
        </Link>

        <Link href="/suppliers" className="group">
          <KpiCard variant="success" className="cursor-pointer transition-all duration-200 hover:-translate-y-1">
            <div className="flex flex-col items-center justify-center gap-3">
              <Package className="h-8 w-8 transition-transform duration-200 group-hover:scale-110" />
              <span className="text-sm font-medium">Fournisseurs</span>
            </div>
          </KpiCard>
        </Link>

        <Link href="/cash" className="group">
          <KpiCard variant="danger" className="cursor-pointer transition-all duration-200 hover:-translate-y-1">
            <div className="flex flex-col items-center justify-center gap-3">
              <DollarSign className="h-8 w-8 transition-transform duration-200 group-hover:scale-110" />
              <span className="text-sm font-medium">Caisse</span>
            </div>
          </KpiCard>
        </Link>

        <Link href="/settings" className="group">
          <KpiCard variant="neutral" className="cursor-pointer transition-all duration-200 hover:-translate-y-1">
            <div className="flex flex-col items-center justify-center gap-3">
              <AlertTriangle className="h-8 w-8 transition-transform duration-200 group-hover:scale-110" />
              <span className="text-sm font-medium">Paramètres</span>
            </div>
          </KpiCard>
        </Link>
      </div>
    </div>
  );
}

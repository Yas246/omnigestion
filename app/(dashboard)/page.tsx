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
import { useDashboard } from "@/lib/hooks/useDashboard";
import { format } from "date-fns";
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
  const { stats, loading, error } = useDashboard();

  const currency = "FCFA"; // TODO: Récupérer depuis les paramètres de l'entreprise

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">
          {error || "Impossible de charger les statistiques"}
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

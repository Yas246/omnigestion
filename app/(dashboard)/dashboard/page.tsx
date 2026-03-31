"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { useDashboard } from "@/lib/hooks/useDashboard";
import { usePermissions } from "@/lib/hooks/usePermissions";
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

export default function DashboardPage() {
  const router = useRouter();

  // Enregistrer les composants Chart.js côté client uniquement
  useEffect(() => {
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
  }, []);

  const { stats, loading, error } = useDashboard();
  const { hasPermission, getFirstAccessiblePage } = usePermissions();

  // Vérifier les permissions et rediriger si nécessaire
  useEffect(() => {
    if (!hasPermission('dashboard', 'read')) {
      const firstAccessiblePage = getFirstAccessiblePage();
      router.push(firstAccessiblePage);
    }
  }, [hasPermission, getFirstAccessiblePage, router]);

  const currency = "FCFA"; // TODO: Récupérer depuis les paramètres de l'entreprise

  // Afficher un message si l'utilisateur n'a pas accès au dashboard
  if (!hasPermission('dashboard', 'read')) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
        borderColor: "oklch(0.62 0.14 35)",
        backgroundColor: "oklch(0.62 0.14 35 / 0.15)",
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
        backgroundColor: "oklch(0.65 0.12 145 / 0.85)",
        borderRadius: 4,
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
          Vue d&apos;ensemble de votre activité
        </p>
      </div>

      {/* Statistiques du jour */}
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard variant="primary">
          <KpiCardHeader
            title="CA du jour"
            icon={<DollarSign className="h-5 w-5" />}
            iconVariant="primary"
          />
          <KpiCardValue
            value={`${formatPrice(stats.todayRevenue)} ${currency}`}
            label={`${stats.todayInvoicesCount} facture(s)`}
            variant="primary"
          />
        </KpiCard>

        <KpiCard variant="warning">
          <KpiCardHeader
            title="Crédits actifs"
            icon={<Receipt className="h-5 w-5" />}
            iconVariant="warning"
          />
          <KpiCardValue
            value={`${formatPrice(stats.activeCredits)} ${currency}`}
            label="Crédits créés aujourd'hui"
            variant="warning"
          />
        </KpiCard>

        <KpiCard variant="info">
          <KpiCardHeader
            title="Bénéfice estimé"
            icon={<DollarSign className="h-5 w-5" />}
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
            <CardDescription>Évolution du chiffre d&apos;affaires</CardDescription>
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
          <CardDescription>Vue d&apos;ensemble de votre entreprise</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard variant="primary">
              <KpiCardHeader
                title="Total factures"
                icon={<Receipt className="h-5 w-5" />}
                iconVariant="primary"
              />
              <KpiCardValue
                value={stats.totalInvoicesCount}
                variant="primary"
              />
            </KpiCard>

            <KpiCard variant="success">
              <KpiCardHeader
                title="CA total"
                icon={<DollarSign className="h-5 w-5" />}
                iconVariant="success"
              />
              <KpiCardValue
                value={`${formatPrice(stats.totalRevenue)} ${currency}`}
                variant="success"
              />
            </KpiCard>

            <KpiCard variant="info">
              <KpiCardHeader
                title="Produits"
                icon={<Package className="h-5 w-5" />}
                iconVariant="info"
              />
              <KpiCardValue
                value={stats.totalProducts}
                variant="info"
              />
            </KpiCard>

            <KpiCard variant="warning">
              <KpiCardHeader
                title="Clients"
                icon={<Users className="h-5 w-5" />}
                iconVariant="warning"
              />
              <KpiCardValue
                value={stats.totalClients}
                variant="warning"
              />
            </KpiCard>
          </div>
        </CardContent>
      </Card>

      {/* Navigation rapide */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Link href="/sales" className="group">
          <KpiCard variant="primary" className="cursor-pointer transition-all duration-200 hover:-translate-y-1">
            <div className="flex flex-col items-center justify-center gap-3">
              <Receipt className="h-8 w-8 text-[oklch(0.62_0.14_35)] transition-transform duration-200 group-hover:scale-110" />
              <span className="text-sm font-medium">Ventes</span>
            </div>
          </KpiCard>
        </Link>

        <Link href="/stock" className="group">
          <KpiCard variant="info" className="cursor-pointer transition-all duration-200 hover:-translate-y-1">
            <div className="flex flex-col items-center justify-center gap-3">
              <Package className="h-8 w-8 text-[oklch(0.58_0.18_200)] transition-transform duration-200 group-hover:scale-110" />
              <span className="text-sm font-medium">Stock</span>
            </div>
          </KpiCard>
        </Link>

        <Link href="/clients" className="group">
          <KpiCard variant="warning" className="cursor-pointer transition-all duration-200 hover:-translate-y-1">
            <div className="flex flex-col items-center justify-center gap-3">
              <Users className="h-8 w-8 text-[oklch(0.75_0.15_75)] transition-transform duration-200 group-hover:scale-110" />
              <span className="text-sm font-medium">Clients</span>
            </div>
          </KpiCard>
        </Link>

        <Link href="/suppliers" className="group">
          <KpiCard variant="success" className="cursor-pointer transition-all duration-200 hover:-translate-y-1">
            <div className="flex flex-col items-center justify-center gap-3">
              <Package className="h-8 w-8 text-[oklch(0.65_0.12_145)] transition-transform duration-200 group-hover:scale-110" />
              <span className="text-sm font-medium">Fournisseurs</span>
            </div>
          </KpiCard>
        </Link>

        <Link href="/cash" className="group">
          <KpiCard variant="primary" className="cursor-pointer transition-all duration-200 hover:-translate-y-1">
            <div className="flex flex-col items-center justify-center gap-3">
              <DollarSign className="h-8 w-8 text-[oklch(0.62_0.14_35)] transition-transform duration-200 group-hover:scale-110" />
              <span className="text-sm font-medium">Caisse</span>
            </div>
          </KpiCard>
        </Link>

        <Link href="/settings" className="group">
          <KpiCard variant="neutral" className="cursor-pointer transition-all duration-200 hover:-translate-y-1">
            <div className="flex flex-col items-center justify-center gap-3">
              <AlertTriangle className="h-8 w-8 text-muted-foreground transition-transform duration-200 group-hover:scale-110" />
              <span className="text-sm font-medium">Paramètres</span>
            </div>
          </KpiCard>
        </Link>
      </div>
    </div>
  );
}

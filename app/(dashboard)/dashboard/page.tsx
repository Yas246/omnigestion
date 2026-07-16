"use client";

import { useEffect, useState } from "react";
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
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Loader2,
  Package,
  Users,
  Receipt,
  DollarSign,
  AlertTriangle,
  Settings,
} from "lucide-react";
import { useDashboard } from "@/lib/api/hooks/useDashboard";
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
import { formatPrice } from "@/lib/utils";
import { getInvoiceStatusBadge } from "@/lib/utils/invoice-helpers";
import { DashboardDatePicker } from "@/components/dashboard/DashboardDatePicker";

// Enregistrer les composants Chart.js au niveau du module (avant tout render)
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

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { stats, loading, error } = useDashboard(selectedDate);
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

  const dateLabel = selectedDate
    ? format(selectedDate, "d MMMM yyyy", { locale: fr })
    : "du jour";

  // Préparer les données pour les graphiques
  const salesChartData = {
    labels: stats.salesLast7Days.map((d) => {
      const dt = new Date(d.date);
      return isNaN(dt.getTime()) ? d.date : format(dt, "dd/MM", { locale: fr });
    }),
    datasets: [
      {
        label: "Chiffre d'affaires",
        data: stats.salesLast7Days.map((d) => d.revenue),
        borderColor: "oklch(0.55 0.20 280)",
        backgroundColor: "oklch(0.55 0.20 280 / 0.15)",
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
        backgroundColor: "oklch(0.55 0.20 280 / 0.85)",
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
        grid: { color: "oklch(0.90 0.01 85)" },
        ticks: { color: "oklch(0.52 0.02 50)", font: { size: 11 } },
        border: { display: false },
      },
      x: {
        grid: { display: false },
        ticks: { color: "oklch(0.52 0.02 50)", font: { size: 11 } },
        border: { display: false },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <PageHeader
        eyebrow="Pilotage"
        title="Tableau de bord"
        description="Vue d'ensemble de votre activité"
      >
        <DashboardDatePicker date={selectedDate} onDateChange={setSelectedDate} />
      </PageHeader>

      {/* Statistiques du jour */}
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard variant="primary">
          <KpiCardHeader
            title={`CA ${dateLabel}`}
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
            title="Crédits du jour"
            icon={<Receipt className="h-5 w-5" />}
            iconVariant="warning"
          />
          <KpiCardValue
            value={`${formatPrice(stats.creditsCreatedToday)} ${currency}`}
            label={`${stats.creditsCreatedTodayCount} crédit(s) créé(s)`}
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
            label={`Marge ${dateLabel}`}
            variant="info"
          />
        </KpiCard>
      </div>

      {/* Alertes de stock */}
      {(stats.lowStockProducts > 0 || stats.outOfStockProducts > 0) && (
        <Card className="border-orange-500/30">
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
                  className="text-sm px-3 py-1 border-orange-500/40 text-orange-700"
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
            <div className="h-75">
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
            <div className="h-75 flex items-center justify-center">
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
            <div className="h-62.5">
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
            <div className="space-y-3 max-h-62.5 overflow-y-auto">
              {stats.recentInvoices.length === 0 ? (
                <EmptyState
                  title="Aucune facture"
                  description="Les dernières ventes apparaîtront ici dès qu'elles seront enregistrées."
                />
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
                    <span className="ml-2">{getInvoiceStatusBadge(invoice.status)}</span>
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

      {/* Accès rapide */}
      <div>
        <p className="mb-3 text-[11px] font-medium uppercase tracking-eyebrow text-muted-foreground/70">
          Accès rapide
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              { href: "/sales", icon: Receipt, label: "Ventes" },
              { href: "/stock", icon: Package, label: "Stock" },
              { href: "/clients", icon: Users, label: "Clients" },
              { href: "/suppliers", icon: Package, label: "Fournisseurs" },
              { href: "/cash", icon: DollarSign, label: "Caisse" },
              { href: "/settings", icon: Settings, label: "Réglages" },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="group">
                <div className="flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border bg-card p-5 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
                  <Icon className="h-6 w-6 text-primary transition-transform duration-200 group-hover:scale-110" />
                  <span className="text-sm font-medium text-foreground/80">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

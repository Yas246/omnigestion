'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard, KpiCardHeader, KpiCardValue } from '@/components/ui/kpi-card';
import { useInvoices } from '@/lib/hooks/useInvoices';
import { DollarSign, ShoppingCart, TrendingUp, FileText } from 'lucide-react';
import { Bar, Line, Pie } from 'react-chartjs-2';
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
} from 'chart.js';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';

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

type PeriodType = 'today' | 'week' | 'month' | 'year' | 'custom';

interface SalesReportProps {
  period: PeriodType;
}

export function SalesReport({ period }: SalesReportProps) {
  const { invoices } = useInvoices();
  const [filteredInvoices, setFilteredInvoices] = useState(invoices);

  useEffect(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999); // Fin de la journée
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = startOfMonth(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'year':
        startDate = startOfYear(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate = startOfMonth(now);
        startDate.setHours(0, 0, 0, 0);
    }

    const filtered = invoices.filter(inv => {
      const invDate = new Date(inv.date);
      return invDate >= startDate && invDate <= now;
    });

    setFilteredInvoices(filtered);
  }, [period, invoices]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  // Calculer les KPIs
  const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalInvoices = filteredInvoices.length;
  const avgBasket = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;
  const paidAmount = filteredInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);

  // Préparer les données pour les graphiques
  // Ventes par jour
  const salesByDay = filteredInvoices.reduce((acc, inv) => {
    const day = format(new Date(inv.date), 'dd/MM');
    acc[day] = (acc[day] || 0) + inv.total;
    return acc;
  }, {} as Record<string, number>);

  const salesChartData = {
    labels: Object.keys(salesByDay),
    datasets: [
      {
        label: "Chiffre d'affaires",
        data: Object.values(salesByDay),
        borderColor: 'oklch(0.62 0.14 35)',
        backgroundColor: 'oklch(0.62 0.14 35 / 0.15)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Répartition par mode de paiement
  const paymentDistribution = filteredInvoices.reduce((acc, inv) => {
    const method = inv.paymentMethod || 'non_défini';
    acc[method] = (acc[method] || 0) + inv.total;
    return acc;
  }, {} as Record<string, number>);

  const paymentLabels: Record<string, string> = {
    cash: 'Espèces',
    mobile: 'Mobile Money',
    bank: 'Banque',
    credit: 'Crédit',
    non_défini: 'Non défini',
  };

  const paymentChartData = {
    labels: Object.keys(paymentDistribution).map(k => paymentLabels[k] || k),
    datasets: [
      {
        data: Object.values(paymentDistribution),
        backgroundColor: [
          'oklch(0.65 0.12 145 / 0.8)',
          'oklch(0.75 0.15 75 / 0.8)',
          'oklch(0.58 0.18 200 / 0.8)',
          'oklch(0.58 0.22 25 / 0.8)',
          'oklch(0.52 0.02 50 / 0.8)',
        ],
      },
    ],
  };

  // Top 10 produits
  const productSales = filteredInvoices.reduce((acc, inv) => {
    inv.items.forEach(item => {
      acc[item.productName] = (acc[item.productName] || 0) + item.quantity;
    });
    return acc;
  }, {} as Record<string, number>);

  const topProducts = Object.entries(productSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const topProductsChartData = {
    labels: topProducts.map(([name]) => name.length > 20 ? name.substring(0, 20) + '...' : name),
    datasets: [
      {
        label: 'Quantité vendue',
        data: topProducts.map(([, qty]) => qty),
        backgroundColor: 'oklch(0.65 0.12 145 / 0.85)',
        borderRadius: 4,
      },
    ],
  };

  // Top 10 clients
  const clientSales = filteredInvoices.reduce((acc, inv) => {
    const client = inv.clientName || 'Client de passage';
    acc[client] = (acc[client] || 0) + inv.total;
    return acc;
  }, {} as Record<string, number>);

  const topClients = Object.entries(clientSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const topClientsChartData = {
    labels: topClients.map(([name]) => name),
    datasets: [
      {
        label: 'Montant total (FCFA)',
        data: topClients.map(([, amount]) => amount),
        backgroundColor: 'oklch(0.62 0.14 35 / 0.85)',
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

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 12,
          padding: 15,
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard variant="primary">
          <KpiCardHeader
            title="Chiffre d'affaires"
            icon={<DollarSign className="h-4 w-4" />}
            iconVariant="primary"
          />
          <KpiCardValue
            value={`${formatPrice(totalRevenue)} FCFA`}
            label="Total de la période"
            variant="primary"
          />
        </KpiCard>

        <KpiCard variant="info">
          <KpiCardHeader
            title="Factures"
            icon={<FileText className="h-4 w-4" />}
            iconVariant="info"
          />
          <KpiCardValue
            value={totalInvoices.toString()}
            label="Nombre de ventes"
            variant="info"
          />
        </KpiCard>

        <KpiCard variant="warning">
          <KpiCardHeader
            title="Panier moyen"
            icon={<ShoppingCart className="h-4 w-4" />}
            iconVariant="warning"
          />
          <KpiCardValue
            value={`${formatPrice(Math.round(avgBasket))} FCFA`}
            label="Moyenne par vente"
            variant="warning"
          />
        </KpiCard>

        <KpiCard variant="success">
          <KpiCardHeader
            title="Encaissé"
            icon={<TrendingUp className="h-4 w-4" />}
            iconVariant="success"
          />
          <KpiCardValue
            value={`${formatPrice(paidAmount)} FCFA`}
            label="Montant payé"
            variant="success"
          />
        </KpiCard>
      </div>

      {/* Graphiques */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Ventes par jour */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Évolution des ventes</CardTitle>
            <CardDescription>Chiffre d'affaires par jour</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] sm:h-[250px] md:h-[300px]">
              {Object.keys(salesByDay).length > 0 ? (
                <Line data={salesChartData} options={chartOptions} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune donnée pour cette période
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Répartition par mode de paiement */}
        <Card>
          <CardHeader>
            <CardTitle>Mode de paiement</CardTitle>
            <CardDescription>Répartition du CA</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              {Object.keys(paymentDistribution).length > 0 ? (
                <Pie data={paymentChartData} options={pieOptions} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune donnée
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top 10 produits */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 produits</CardTitle>
            <CardDescription>Les plus vendus</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {topProducts.length > 0 ? (
                <Bar data={topProductsChartData} options={chartOptions} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune donnée
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top 10 clients */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 clients</CardTitle>
            <CardDescription>Meilleurs clients</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {topClients.length > 0 ? (
                <Bar data={topClientsChartData} options={chartOptions} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune donnée
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

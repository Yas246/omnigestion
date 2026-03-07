'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useInvoices } from '@/lib/hooks/useInvoices';
import { DollarSign, TrendingUp } from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PaginatedTable } from '@/components/ui/PaginatedTable';

// Enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

type PeriodType = 'today' | 'week' | 'month' | 'year' | 'custom';

interface ProfitsReportProps {
  period: PeriodType;
}

export function ProfitsReport({ period }: ProfitsReportProps) {
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

  // Calculer les marges
  let totalRevenue = 0;
  let totalCost = 0;
  let totalMargin = 0;
  const productsWithMargin: Record<string, { revenue: number; cost: number; margin: number; marginRate: number }> = {};
  const salesByDay: Record<string, { revenue: number; margin: number }> = {};

  filteredInvoices.forEach(inv => {
    inv.items.forEach(item => {
      const revenue = item.unitPrice * item.quantity;
      const cost = (item.purchasePrice || 0) * item.quantity;
      const margin = revenue - cost;
      const marginRate = revenue > 0 ? (margin / revenue) * 100 : 0;

      totalRevenue += revenue;
      totalCost += cost;
      totalMargin += margin;

      // Par produit
      if (!productsWithMargin[item.productName]) {
        productsWithMargin[item.productName] = { revenue: 0, cost: 0, margin: 0, marginRate: 0 };
      }
      productsWithMargin[item.productName].revenue += revenue;
      productsWithMargin[item.productName].cost += cost;
      productsWithMargin[item.productName].margin += margin;
      productsWithMargin[item.productName].marginRate = marginRate;

      // Par jour
      const day = format(new Date(inv.date), 'dd/MM');
      if (!salesByDay[day]) {
        salesByDay[day] = { revenue: 0, margin: 0 };
      }
      salesByDay[day].revenue += revenue;
      salesByDay[day].margin += margin;
    });
  });

  const avgMarginRate = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  // Top produits rentables
  const topProducts = Object.entries(productsWithMargin)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 10);

  // Graphique marge par jour
  const marginChartData = {
    labels: Object.keys(salesByDay),
    datasets: [
      {
        label: 'Marge brute (FCFA)',
        data: Object.values(salesByDay).map(d => d.margin),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Graphique rentabilité par produit
  const profitabilityChartData = {
    labels: topProducts.map(p => p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name),
    datasets: [
      {
        label: 'Marge brute (FCFA)',
        data: topProducts.map(p => p.margin),
        backgroundColor: topProducts.map(p =>
          p.marginRate >= 30 ? 'rgba(34, 197, 94, 0.8)' :
          p.marginRate >= 15 ? 'rgba(249, 115, 22, 0.8)' :
          'rgba(239, 68, 68, 0.8)'
        ),
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

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(totalRevenue)} FCFA</div>
            <p className="text-xs text-muted-foreground">
              Total des ventes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coût total</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatPrice(totalCost)} FCFA</div>
            <p className="text-xs text-muted-foreground">
              Prix d'achat total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marge brute</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatPrice(totalMargin)} FCFA</div>
            <p className="text-xs text-muted-foreground">
              Bénéfice brut
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de marge</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{avgMarginRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Moyenne
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Marge par jour */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Évolution de la marge brute</CardTitle>
            <CardDescription>Marge brute par jour</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {Object.keys(salesByDay).length > 0 ? (
                <Line data={marginChartData} options={chartOptions} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune donnée pour cette période
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rentabilité par produit */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Top 10 produits les plus rentables</CardTitle>
            <CardDescription>Marge brute par produit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {topProducts.length > 0 ? (
                <Bar data={profitabilityChartData} options={chartOptions} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune donnée
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau détaillé */}
      <Card>
        <CardHeader>
          <CardTitle>Détail des marges par produit</CardTitle>
          <CardDescription>Analyse de rentabilité</CardDescription>
        </CardHeader>
        <CardContent>
          <PaginatedTable
            data={topProducts}
            columns={[
              {
                key: 'name',
                header: 'Produit',
                render: (product) => <span className="font-medium">{product.name}</span>,
              },
              {
                key: 'revenue',
                header: 'CA (FCFA)',
                className: 'text-right',
                render: (product) => formatPrice(product.revenue),
              },
              {
                key: 'cost',
                header: 'Coût (FCFA)',
                className: 'text-right',
                render: (product) => formatPrice(product.cost),
              },
              {
                key: 'margin',
                header: 'Marge (FCFA)',
                className: 'text-right',
                render: (product) => (
                  <span className={`font-semibold ${product.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPrice(product.margin)}
                  </span>
                ),
              },
              {
                key: 'marginRate',
                header: 'Taux',
                className: 'text-right',
                render: (product) => (
                  <span className={`font-semibold ${
                    product.marginRate >= 30 ? 'text-green-600' :
                    product.marginRate >= 15 ? 'text-orange-600' :
                    'text-red-600'
                  }`}>
                    {product.marginRate.toFixed(1)}%
                  </span>
                ),
              },
            ]}
            initialPageSize={25}
            emptyMessage="Aucune donnée disponible"
          />
        </CardContent>
      </Card>
    </div>
  );
}

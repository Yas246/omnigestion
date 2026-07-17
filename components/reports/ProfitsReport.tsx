'use client';

import { KpiCard, KpiCardHeader, KpiCardValue } from '@/components/ui/kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PaginatedTable } from '@/components/ui/PaginatedTable';
import { DollarSign, TrendingUp, LineChart } from 'lucide-react';
import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatPrice } from '@/lib/utils';
import { useProfitReport } from '@/lib/api/hooks/useProfitReport';

// Charts are heavy — load client-side only (deferred from initial bundle).
const Line = dynamic(() => import('react-chartjs-2').then((m) => m.Line), { ssr: false, loading: () => null });
const Bar = dynamic(() => import('react-chartjs-2').then((m) => m.Bar), { ssr: false, loading: () => null });

interface ProfitsReportProps {
  period: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  customRange?: { from?: Date; to?: Date };
}

export function ProfitsReport({ period, customRange }: ProfitsReportProps) {
  const { data, isLoading, error } = useProfitReport(period, customRange);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <p className="text-destructive">{error || 'Impossible de charger les données'}</p>
      </div>
    );
  }

  const { kpis, byDay, byProduct } = data;

  // Compute marginRate per product (not returned by the API).
  const topProducts = byProduct.map((p) => ({
    ...p,
    marginRate: p.revenue > 0 ? (p.margin / p.revenue) * 100 : 0,
  }));

  // Sort day keys chronologically for the margin chart.
  const sortedDays = [...byDay].sort((a, b) => (a.date < b.date ? -1 : 1));

  const marginChartData = {
    labels: sortedDays.map((d) => format(new Date(d.date), 'dd/MM', { locale: fr })),
    datasets: [
      {
        label: 'Marge brute (FCFA)',
        data: sortedDays.map((d) => d.margin),
        borderColor: 'oklch(0.65 0.12 145)',
        backgroundColor: 'oklch(0.65 0.12 145 / 0.15)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const profitabilityChartData = {
    labels: topProducts.map((p) =>
      p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
    ),
    datasets: [
      {
        label: 'Marge brute (FCFA)',
        data: topProducts.map((p) => p.margin),
        backgroundColor: topProducts.map((p) =>
          p.marginRate >= 30
            ? 'oklch(0.65 0.12 145 / 0.8)'
            : p.marginRate >= 15
              ? 'oklch(0.75 0.15 75 / 0.8)'
              : 'oklch(0.58 0.22 25 / 0.8)',
        ),
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'oklch(0.90 0.01 85)' },
        ticks: { color: 'oklch(0.52 0.02 50)', font: { size: 11 } },
        border: { display: false },
      },
      x: {
        grid: { display: false },
        ticks: { color: 'oklch(0.52 0.02 50)', font: { size: 11 } },
        border: { display: false },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard variant="primary">
          <KpiCardHeader title="Chiffre d'affaires" icon={<DollarSign className="h-4 w-4" />} iconVariant="primary" />
          <KpiCardValue value={`${formatPrice(kpis.totalRevenue)} FCFA`} label="Total des ventes" variant="primary" />
        </KpiCard>

        <KpiCard variant="danger">
          <KpiCardHeader title="Coût total" icon={<TrendingUp className="h-4 w-4" />} iconVariant="danger" />
          <KpiCardValue value={`${formatPrice(kpis.totalCost)} FCFA`} label="Prix d'achat total" variant="danger" />
        </KpiCard>

        <KpiCard variant="success">
          <KpiCardHeader title="Marge brute" icon={<DollarSign className="h-4 w-4" />} iconVariant="success" />
          <KpiCardValue value={`${formatPrice(kpis.totalMargin)} FCFA`} label="Bénéfice brut" variant="success" />
        </KpiCard>

        <KpiCard variant="primary">
          <KpiCardHeader title="Taux de marge" icon={<TrendingUp className="h-4 w-4" />} iconVariant="primary" />
          <KpiCardValue value={`${kpis.marginRate.toFixed(1)}%`} label="Moyenne" variant="primary" />
        </KpiCard>
      </div>

      {/* Graphiques */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Évolution de la marge brute</CardTitle>
            <CardDescription>Marge brute par jour</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-75">
              {sortedDays.length > 0 ? (
                <Line data={marginChartData} options={chartOptions} />
              ) : (
                <EmptyState icon={<LineChart className="h-5 w-5" />} title="Aucune donnée pour cette période" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Top 10 produits les plus rentables</CardTitle>
            <CardDescription>Marge brute par produit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-75">
              {topProducts.length > 0 ? (
                <Bar data={profitabilityChartData} options={chartOptions} />
              ) : (
                <EmptyState icon={<TrendingUp className="h-5 w-5" />} title="Aucune donnée" />
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
                render: (product: any) => <span className="font-medium">{product.name}</span>,
              },
              {
                key: 'revenue',
                header: 'CA (FCFA)',
                className: 'text-right',
                render: (product: any) => <span className="tabular-nums">{formatPrice(product.revenue)}</span>,
              },
              {
                key: 'cost',
                header: 'Coût (FCFA)',
                className: 'text-right',
                render: (product: any) => <span className="tabular-nums">{formatPrice(product.cost)}</span>,
              },
              {
                key: 'margin',
                header: 'Marge (FCFA)',
                className: 'text-right',
                render: (product: any) => (
                  <span className={`font-semibold tabular-nums ${product.margin >= 0 ? 'text-[oklch(0.65_0.12_145)]' : 'text-[oklch(0.58_0.22_25)]'}`}>
                    {formatPrice(product.margin)}
                  </span>
                ),
              },
              {
                key: 'marginRate',
                header: 'Taux',
                className: 'text-right',
                render: (product: any) => (
                  <span className={`font-semibold tabular-nums ${
                    product.marginRate >= 30 ? 'text-[oklch(0.65_0.12_145)]' :
                    product.marginRate >= 15 ? 'text-[oklch(0.75_0.15_75)]' :
                    'text-[oklch(0.58_0.22_25)]'
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

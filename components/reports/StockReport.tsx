'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KpiCard, KpiCardHeader, KpiCardValue } from '@/components/ui/kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { useProductsRealtime } from '@/lib/api/hooks/useProducts';
import { Package, AlertTriangle, DollarSign, BarChart3 } from 'lucide-react';
import { Bar, Pie } from 'react-chartjs-2';
import { PaginatedTable } from '@/components/ui/PaginatedTable';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { formatPrice } from '@/lib/utils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
);

export function StockReport() {
  const { products: rawProducts, isLoading } = useProductsRealtime();

  const { activeProducts, stockStats } = useMemo(() => {
    const active = rawProducts.filter(p => !p.deletedAt);
    const totalProducts = active.length;
    const totalValue = active.reduce((sum, p) => {
      return sum + (p.currentStock || 0) * (p.purchasePrice || 0);
    }, 0);
    const outOfStock = active.filter(p => (p.currentStock || 0) === 0).length;
    const lowStock = active.filter(p => {
      const stock = p.currentStock || 0;
      return stock > 0 && stock <= (p.alertThreshold || 0);
    }).length;
    const okStock = totalProducts - outOfStock - lowStock;

    return {
      activeProducts: active,
      stockStats: { totalProducts, totalValue, outOfStock, lowStock, okStock },
    };
  }, [rawProducts]);

  // Répartition par statut
  const statusDistribution = {
    labels: ['En stock', 'Stock bas', 'Rupture'],
    datasets: [
      {
        data: [stockStats.okStock, stockStats.lowStock, stockStats.outOfStock],
        backgroundColor: [
          'oklch(0.65 0.12 145 / 0.8)',
          'oklch(0.75 0.15 75 / 0.8)',
          'oklch(0.58 0.22 25 / 0.8)',
        ],
      },
    ],
  };

  // Top 10 produits avec le plus grand stock
  const topStock = [...activeProducts]
    .sort((a, b) => (b.currentStock || 0) - (a.currentStock || 0))
    .slice(0, 10);

  const topStockChartData = {
    labels: topStock.map(p => p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name),
    datasets: [
      {
        label: 'Quantité en stock',
        data: topStock.map(p => p.currentStock || 0),
        backgroundColor: 'oklch(0.68 0.10 200 / 0.8)',
      },
    ],
  };

  // Top 10 produits les plus valorisés
  const topValue = [...activeProducts]
    .map(p => ({
      ...p,
      value: (p.currentStock || 0) * (p.purchasePrice || 0),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const topValueChartData = {
    labels: topValue.map(p => p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name),
    datasets: [
      {
        label: 'Valeur stock (FCFA)',
        data: topValue.map(p => p.value),
        backgroundColor: 'oklch(0.65 0.12 145 / 0.8)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: 10,
          color: 'oklch(0.52 0.02 50)',
          font: { size: 11 },
        },
        grid: { color: 'oklch(0.90 0.01 85)' },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { color: 'oklch(0.52 0.02 50)', font: { size: 11 } },
        grid: { color: 'oklch(0.90 0.01 85)' },
        border: { display: false },
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
          color: 'oklch(0.52 0.02 50)',
          font: { size: 11 },
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard variant="info">
          <KpiCardHeader
            title="Total produits"
            icon={<Package className="h-4 w-4" />}
            iconVariant="info"
          />
          <KpiCardValue
            value={isLoading ? '...' : stockStats.totalProducts.toString()}
            label="Références"
            variant="info"
          />
        </KpiCard>

        <KpiCard variant="primary">
          <KpiCardHeader
            title="Valeur du stock"
            icon={<DollarSign className="h-4 w-4" />}
            iconVariant="primary"
          />
          <KpiCardValue
            value={isLoading ? '...' : `${formatPrice(stockStats.totalValue)} FCFA`}
            label="Valorisation totale"
            variant="primary"
          />
        </KpiCard>

        <KpiCard variant="warning">
          <KpiCardHeader
            title="Stock bas"
            icon={<AlertTriangle className="h-4 w-4" />}
            iconVariant="warning"
          />
          <KpiCardValue
            value={isLoading ? '...' : stockStats.lowStock.toString()}
            label="En alerte"
            variant="warning"
          />
        </KpiCard>

        <KpiCard variant="danger">
          <KpiCardHeader
            title="Rupture de stock"
            icon={<Package className="h-4 w-4" />}
            iconVariant="danger"
          />
          <KpiCardValue
            value={isLoading ? '...' : stockStats.outOfStock.toString()}
            label="À réapprovisionner"
            variant="danger"
          />
        </KpiCard>
      </div>

      {/* Alertes */}
      {(stockStats.outOfStock > 0 || stockStats.lowStock > 0) && (
        <Card className="border-[oklch(0.75_0.15_75)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[oklch(0.75_0.15_75)]" />
              Alertes de stock
            </CardTitle>
            <CardDescription>
              {stockStats.outOfStock > 0 && `${stockStats.outOfStock} produit(s) en rupture `}
              {stockStats.lowStock > 0 && `• ${stockStats.lowStock} produit(s) stock bas`}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Graphiques */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>État du stock</CardTitle>
            <CardDescription>Répartition par statut</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-75 flex items-center justify-center">
              {stockStats.totalProducts > 0 ? (
                <Pie data={statusDistribution} options={pieOptions} />
              ) : (
                <EmptyState
                  icon={<Package className="h-5 w-5" />}
                  title="Aucune donnée"
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 10 plus gros stocks</CardTitle>
            <CardDescription>Quantités par produit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-75">
              {topStock.length > 0 ? (
                <Bar data={topStockChartData} options={chartOptions} />
              ) : (
                <EmptyState
                  icon={<BarChart3 className="h-5 w-5" />}
                  title="Aucune donnée"
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Top 10 valeur de stock</CardTitle>
            <CardDescription>Produits les plus valorisés</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-50 sm:h-62.5 md:h-75 w-full overflow-x-auto">
              {topValue.length > 0 ? (
                <Bar data={topValueChartData} options={chartOptions} />
              ) : (
                <EmptyState
                  icon={<DollarSign className="h-5 w-5" />}
                  title="Aucune donnée"
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau état du stock */}
      <Card>
        <CardHeader>
          <CardTitle>État détaillé du stock</CardTitle>
          <CardDescription>Vue d'ensemble de tous les produits</CardDescription>
        </CardHeader>
        <CardContent>
          <PaginatedTable
            data={activeProducts}
            columns={[
              {
                key: 'name',
                header: 'Produit',
                render: (product) => (
                  <div className="flex flex-col">
                    <span className="font-medium">{product.name}</span>
                    {product.code && (
                      <span className="text-xs text-muted-foreground">{product.code}</span>
                    )}
                  </div>
                ),
              },
              {
                key: 'stock',
                header: 'Stock',
                className: 'text-right',
                render: (product) => (
                  <span className="font-medium tabular-nums">{product.currentStock || 0} {product.unit}</span>
                ),
              },
              {
                key: 'alertThreshold',
                header: 'Seuil alerte',
                className: 'text-right',
                render: (product) => <span className="tabular-nums">{product.alertThreshold || 0} {product.unit}</span>,
              },
              {
                key: 'purchasePrice',
                header: 'Prix achat',
                className: 'text-right',
                render: (product) => <span className="tabular-nums">{formatPrice(product.purchasePrice || 0)} FCFA</span>,
              },
              {
                key: 'value',
                header: 'Valeur',
                className: 'text-right',
                render: (product) => {
                  const value = (product.currentStock || 0) * (product.purchasePrice || 0);
                  return <span className="font-medium tabular-nums">{formatPrice(value)} FCFA</span>;
                },
              },
              {
                key: 'status',
                header: 'Statut',
                className: 'text-center',
                render: (product) => {
                  const stock = product.currentStock || 0;
                  const threshold = product.alertThreshold || 0;
                  const status = stock === 0 ? 'out' : stock <= threshold ? 'low' : 'ok';
                  return (
                    <Badge
                      variant={
                        status === 'out' ? 'destructive' :
                        status === 'low' ? 'warning' :
                        'success'
                      }
                    >
                      {status === 'out' ? 'Rupture' :
                       status === 'low' ? 'Bas' :
                       'OK'}
                    </Badge>
                  );
                },
              },
            ]}
            initialPageSize={50}
            emptyMessage="Aucun produit"
          />
        </CardContent>
      </Card>
    </div>
  );
}

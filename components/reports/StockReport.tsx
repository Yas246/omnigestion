'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { db, COLLECTIONS } from '@/lib/firebase';
import { Package, AlertTriangle, DollarSign, TrendingUp } from 'lucide-react';
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
import type { Product } from '@/types';

// Enregistrer les composants Chart.js
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
  const { user } = useAuth();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stockStats, setStockStats] = useState({
    totalProducts: 0,
    totalValue: 0,
    outOfStock: 0,
    lowStock: 0,
    okStock: 0,
  });

  // Charger tous les produits depuis Firestore
  useEffect(() => {
    const fetchAllProducts = async () => {
      if (!user?.currentCompanyId) return;

      setIsLoading(true);
      try {
        const q = query(
          collection(db, COLLECTIONS.companyProducts(user.currentCompanyId)),
          orderBy('name')
        );

        const snapshot = await getDocs(q);
        const products = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product));
        setAllProducts(products);
      } catch (error) {
        console.error('Erreur lors du chargement des produits:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllProducts();
  }, [user?.currentCompanyId]);

  useEffect(() => {
    const totalProducts = allProducts.length;
    const totalValue = allProducts.reduce((sum, p) => {
      const price = p.purchasePrice || 0;
      return sum + (p.currentStock || 0) * price;
    }, 0);
    const outOfStock = allProducts.filter(p => p.status === 'out').length;
    const lowStock = allProducts.filter(p => p.status === 'low').length;
    const okStock = allProducts.filter(p => p.status === 'ok').length;

    setStockStats({ totalProducts, totalValue, outOfStock, lowStock, okStock });
  }, [allProducts]);

  // Répartition par statut
  const statusDistribution = {
    labels: ['En stock', 'Stock bas', 'Rupture'],
    datasets: [
      {
        data: [stockStats.okStock, stockStats.lowStock, stockStats.outOfStock],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(249, 115, 22, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
      },
    ],
  };

  // Top 10 produits avec le plus grand stock
  const topStock = [...allProducts]
    .sort((a, b) => (b.currentStock || 0) - (a.currentStock || 0))
    .slice(0, 10);

  const topStockChartData = {
    labels: topStock.map(p => p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name),
    datasets: [
      {
        label: 'Quantité en stock',
        data: topStock.map(p => p.currentStock || 0),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
      },
    ],
  };

  // Top 10 produits les plus valorisés
  const topValue = [...allProducts]
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
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total produits</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockStats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              Références
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valeur du stock</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(stockStats.totalValue)} FCFA</div>
            <p className="text-xs text-muted-foreground">
              Valorisation totale
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock bas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stockStats.lowStock}</div>
            <p className="text-xs text-muted-foreground">
              En alerte
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rupture de stock</CardTitle>
            <Package className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stockStats.outOfStock}</div>
            <p className="text-xs text-muted-foreground">
              À réapprovisionner
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertes */}
      {(stockStats.outOfStock > 0 || stockStats.lowStock > 0) && (
        <Card className="border-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
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
        {/* Répartition par statut */}
        <Card>
          <CardHeader>
            <CardTitle>État du stock</CardTitle>
            <CardDescription>Répartition par statut</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              {stockStats.totalProducts > 0 ? (
                <Pie data={statusDistribution} options={pieOptions} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune donnée
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top 10 plus gros stocks */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 plus gros stocks</CardTitle>
            <CardDescription>Quantités par produit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {topStock.length > 0 ? (
                <Bar data={topStockChartData} options={chartOptions} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune donnée
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top 10 valeur stock */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Top 10 valeur de stock</CardTitle>
            <CardDescription>Produits les plus valorisés</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {topValue.length > 0 ? (
                <Bar data={topValueChartData} options={chartOptions} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune donnée
                </p>
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
            data={allProducts}
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
                  <span className="font-medium">{product.currentStock || 0} {product.unit}</span>
                ),
              },
              {
                key: 'alertThreshold',
                header: 'Seuil alerte',
                className: 'text-right',
                render: (product) => `${product.alertThreshold || 0} ${product.unit}`,
              },
              {
                key: 'purchasePrice',
                header: 'Prix achat',
                className: 'text-right',
                render: (product) => `${formatPrice(product.purchasePrice || 0)} FCFA`,
              },
              {
                key: 'value',
                header: 'Valeur',
                className: 'text-right',
                render: (product) => {
                  const value = (product.currentStock || 0) * (product.purchasePrice || 0);
                  return <span className="font-medium">{formatPrice(value)} FCFA</span>;
                },
              },
              {
                key: 'status',
                header: 'Statut',
                className: 'text-center',
                render: (product) => (
                  <Badge
                    variant={
                      product.status === 'out' ? 'destructive' :
                      product.status === 'low' ? 'default' :
                      'outline'
                    }
                  >
                    {product.status === 'out' ? 'Rupture' :
                     product.status === 'low' ? 'Bas' :
                     'OK'}
                  </Badge>
                ),
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

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard, KpiCardHeader, KpiCardValue } from '@/components/ui/kpi-card';
import { useInvoicesRealtime } from '@/lib/react-query/useInvoicesRealtime';
import { useClientCredits } from '@/lib/hooks/useClientCredits';
import { getRecognizedProfits, buildInvoicePaymentsMap } from '@/lib/utils/profitCalculation';
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
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PaginatedTable } from '@/components/ui/PaginatedTable';
import { formatPrice } from '@/lib/utils';

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
  customRange?: { from?: Date; to?: Date };
}

export function ProfitsReport({ period, customRange }: ProfitsReportProps) {
  const { invoices } = useInvoicesRealtime();
  const { credits, payments: clientCreditPayments } = useClientCredits();
  const [filteredInvoices, setFilteredInvoices] = useState(invoices);

  useEffect(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999); // Fin de la journée
    let startDate: Date;
    let endDate: Date = now;

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
      case 'custom':
        if (customRange?.from) {
          startDate = new Date(customRange.from);
          startDate.setHours(0, 0, 0, 0);
          endDate = customRange.to ? new Date(customRange.to) : startDate;
          endDate.setHours(23, 59, 59, 999);
          break;
        }
        startDate = startOfMonth(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate = startOfMonth(now);
        startDate.setHours(0, 0, 0, 0);
    }

    const filtered = invoices.filter(inv => {
      const invDate = new Date(inv.date);
      return invDate >= startDate && invDate <= endDate;
    });

    setFilteredInvoices(filtered);
  }, [period, customRange, invoices]);

  // Construire le map invoiceId → creditPayments
  const allCreditPaymentsFlat = Object.values(clientCreditPayments).flat();
  const invoicePaymentsMap = buildInvoicePaymentsMap(
    credits,
    allCreditPaymentsFlat.map(cp => ({ creditId: cp.creditId, amount: cp.amount, createdAt: cp.createdAt }))
  );

  // Calculer la période (même logique que SalesReport pour être cohérent)
  const { periodStart, periodEnd } = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let s: Date;
    let e: Date = now;

    switch (period) {
      case 'today':
        s = new Date(); s.setHours(0, 0, 0, 0); break;
      case 'week':
        s = startOfWeek(now, { weekStartsOn: 1 }); s.setHours(0, 0, 0, 0); break;
      case 'month':
        s = startOfMonth(now); s.setHours(0, 0, 0, 0); break;
      case 'year':
        s = startOfYear(now); s.setHours(0, 0, 0, 0); break;
      case 'custom':
        if (customRange?.from) {
          s = new Date(customRange.from); s.setHours(0, 0, 0, 0);
          e = customRange.to ? new Date(customRange.to) : s; e.setHours(23, 59, 59, 999);
          break;
        }
        s = startOfMonth(now); s.setHours(0, 0, 0, 0); break;
      default:
        s = startOfMonth(now); s.setHours(0, 0, 0, 0);
    }
    return { periodStart: s, periodEnd: e };
  }, [period, customRange]);

  // Calculer les marges
  const activeFiltered = filteredInvoices.filter(inv => inv.status !== 'cancelled');

  let totalCost = 0;
  const productsWithMargin: Record<string, { revenue: number; cost: number; margin: number; marginRate: number }> = {};
  const salesByDay: Record<string, { revenue: number; margin: number }> = {};

  // Paiements de crédits reçus dans la période (même scope que SalesReport)
  const periodCreditPayments = allCreditPaymentsFlat.filter(cp => {
    const payDate = new Date(cp.createdAt);
    return payDate >= periodStart && payDate <= periodEnd;
  });

  // CA encaissé = paidAmount des factures de la période + paiements de crédits reçus dans la période
  const creditPaymentsTotal = periodCreditPayments.reduce((sum, cp) => sum + (cp.amount || 0), 0);
  const totalRevenue = activeFiltered.reduce((sum, inv) => sum + inv.paidAmount, 0) + creditPaymentsTotal;

  // 1. Traiter les factures de la période
  activeFiltered.forEach(inv => {
    inv.items.forEach(item => {
      const cost = (item.purchasePrice || 0) * item.quantity;
      totalCost += cost;

      if (!productsWithMargin[item.productName]) {
        productsWithMargin[item.productName] = { revenue: 0, cost: 0, margin: 0, marginRate: 0 };
      }
      const itemRevenue = item.unitPrice * item.quantity;
      productsWithMargin[item.productName].revenue += itemRevenue;
      productsWithMargin[item.productName].cost += cost;
      productsWithMargin[item.productName].margin += itemRevenue - cost;
      productsWithMargin[item.productName].marginRate = itemRevenue > 0 ? ((itemRevenue - cost) / itemRevenue) * 100 : 0;
    });

    // Bénéfice reconnu
    const creditPaymentsForInvoice = invoicePaymentsMap.get(inv.id) || [];
    const recognizedProfits = getRecognizedProfits(
      inv.items, inv.paidAmount, inv.date, creditPaymentsForInvoice
    );

    const invDay = format(new Date(inv.date), 'dd/MM');
    if (!salesByDay[invDay]) salesByDay[invDay] = { revenue: 0, margin: 0 };
    salesByDay[invDay].revenue += inv.paidAmount;

    recognizedProfits.forEach(({ amount, date }) => {
      const day = format(new Date(date), 'dd/MM');
      if (!salesByDay[day]) salesByDay[day] = { revenue: 0, margin: 0 };
      salesByDay[day].margin += amount;
    });
  });

  // 2. Ajouter les paiements de crédits reçus dans la période au revenue par jour
  periodCreditPayments.forEach(cp => {
    const day = format(new Date(cp.createdAt), 'dd/MM');
    if (!salesByDay[day]) salesByDay[day] = { revenue: 0, margin: 0 };
    salesByDay[day].revenue += cp.amount || 0;
  });

  // 3. Traiter les factures hors période qui ont eu des paiements de crédits dans la période
  const additionalInvoiceIds = new Set<string>();
  periodCreditPayments.forEach(cp => {
    const credit = credits.find(c => c.id === cp.creditId);
    if (credit?.invoiceId && !activeFiltered.some(inv => inv.id === credit.invoiceId)) {
      additionalInvoiceIds.add(credit.invoiceId);
    }
  });

  invoices.filter(inv => additionalInvoiceIds.has(inv.id) && inv.status !== 'cancelled').forEach(inv => {
    const creditPaymentsForInvoice = invoicePaymentsMap.get(inv.id) || [];
    const recognizedProfits = getRecognizedProfits(
      inv.items, inv.paidAmount, inv.date, creditPaymentsForInvoice
    );

    recognizedProfits.forEach(({ amount, date }) => {
      const profitDate = new Date(date);
      if (profitDate >= periodStart && profitDate <= periodEnd) {
        const day = format(profitDate, 'dd/MM');
        if (!salesByDay[day]) salesByDay[day] = { revenue: 0, margin: 0 };
        salesByDay[day].margin += amount;
      }
    });
  });

  const totalMargin = Object.values(salesByDay).reduce((sum, d) => sum + d.margin, 0);

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
        <KpiCard variant="primary">
          <KpiCardHeader
            title="Chiffre d'affaires"
            icon={<DollarSign className="h-4 w-4" />}
            iconVariant="primary"
          />
          <KpiCardValue
            value={`${formatPrice(totalRevenue)} FCFA`}
            label="Total des ventes"
            variant="primary"
          />
        </KpiCard>

        <KpiCard variant="danger">
          <KpiCardHeader
            title="Coût total"
            icon={<TrendingUp className="h-4 w-4" />}
            iconVariant="danger"
          />
          <KpiCardValue
            value={`${formatPrice(totalCost)} FCFA`}
            label="Prix d'achat total"
            variant="danger"
          />
        </KpiCard>

        <KpiCard variant="success">
          <KpiCardHeader
            title="Marge brute"
            icon={<DollarSign className="h-4 w-4" />}
            iconVariant="success"
          />
          <KpiCardValue
            value={`${formatPrice(totalMargin)} FCFA`}
            label="Bénéfice brut"
            variant="success"
          />
        </KpiCard>

        <KpiCard variant="primary">
          <KpiCardHeader
            title="Taux de marge"
            icon={<TrendingUp className="h-4 w-4" />}
            iconVariant="primary"
          />
          <KpiCardValue
            value={`${avgMarginRate.toFixed(1)}%`}
            label="Moyenne"
            variant="primary"
          />
        </KpiCard>
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
                  <span className={`font-semibold ${product.margin >= 0 ? 'text-[oklch(0.65_0.12_145)]' : 'text-[oklch(0.58_0.22_25)]'}`}>
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

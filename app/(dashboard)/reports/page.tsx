'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, TrendingUp, Package, DollarSign } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ProtectedPage } from '@/components/auth';
import { SalesReport } from '@/components/reports/SalesReport';
import { ProfitsReport } from '@/components/reports/ProfitsReport';
import { StockReport } from '@/components/reports/StockReport';
import { CashReport } from '@/components/reports/CashReport';
import { ExportButton } from '@/components/ui/ExportButton';
import { exportToExcel, exportToCSV, type ExportColumn } from '@/lib/utils/export';
import { useInvoices } from '@/lib/hooks/useInvoices';
import { useProducts } from '@/lib/hooks/useProducts';
import { useCashRegisters } from '@/lib/hooks/useCashRegisters';

type PeriodType = 'today' | 'week' | 'month' | 'year' | 'custom';
type ReportTab = 'sales' | 'profits' | 'stock' | 'cash';
type ExportFormat = 'excel' | 'csv';

export default function ReportsPage() {
  const [period, setPeriod] = useState<PeriodType>('month');
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');
  const { invoices } = useInvoices();
  const { products } = useProducts();
  const { movements, cashRegisters } = useCashRegisters();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  const getPeriodLabel = (periodType: PeriodType) => {
    const labels: Record<PeriodType, string> = {
      today: "Aujourd'hui",
      week: 'Cette semaine',
      month: 'Ce mois',
      year: 'Cette année',
      custom: 'Personnalisé',
    };
    return labels[periodType];
  };

  // Filtrer les données par période
  const getFilteredInvoices = () => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
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

    return invoices.filter(inv => {
      const invDate = new Date(inv.date);
      return invDate >= startDate && invDate <= now;
    });
  };

  const getFilteredMovements = () => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
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

    return movements.filter(mov => {
      const movDate = new Date(mov.createdAt);
      return movDate >= startDate && movDate <= now;
    });
  };

  // Fonction d'export pour les ventes
  const handleExportSales = async (exportFormat: ExportFormat) => {
    const filteredInvoices = getFilteredInvoices();

    const columns: ExportColumn[] = [
      { key: 'invoiceNumber', header: 'N° Facture', width: 15 },
      { key: 'date', header: 'Date', format: (v) => format(new Date(v), 'dd/MM/yyyy HH:mm', { locale: fr }), width: 20 },
      { key: 'clientName', header: 'Client', width: 25 },
      { key: 'total', header: 'Montant (FCFA)', format: (v) => formatPrice(v), width: 15 },
      { key: 'paidAmount', header: 'Payé (FCFA)', format: (v) => formatPrice(v), width: 15 },
      { key: 'remainingAmount', header: 'Reste (FCFA)', format: (v) => formatPrice(v), width: 15 },
      { key: 'paymentMethod', header: 'Mode paiement', width: 15 },
      { key: 'status', header: 'Statut', width: 12 },
    ];

    const exportData = {
      title: `Rapport_Ventes_${getPeriodLabel(period).replace(/\s/g, '_')}`,
      subtitle: `Du ${format(new Date(), 'dd/MM/yyyy', { locale: fr })}`,
      columns,
      data: filteredInvoices,
    };

    if (exportFormat === 'excel') {
      exportToExcel(exportData);
    } else {
      exportToCSV(exportData);
    }
  };

  // Fonction d'export pour les bénéfices
  const handleExportProfits = async (exportFormat: ExportFormat) => {
    const filteredInvoices = getFilteredInvoices();

    // Calculer les marges par produit
    const productsWithMargin: Record<string, { revenue: number; cost: number; margin: number; marginRate: number; quantity: number }> = {};

    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        if (!productsWithMargin[item.productName]) {
          productsWithMargin[item.productName] = { revenue: 0, cost: 0, margin: 0, marginRate: 0, quantity: 0 };
        }
        const revenue = item.unitPrice * item.quantity;
        const cost = (item.purchasePrice || 0) * item.quantity;
        const margin = revenue - cost;

        productsWithMargin[item.productName].revenue += revenue;
        productsWithMargin[item.productName].cost += cost;
        productsWithMargin[item.productName].margin += margin;
        productsWithMargin[item.productName].quantity += item.quantity;
      });
    });

    const productsData = Object.entries(productsWithMargin).map(([name, data]) => ({
      name,
      ...data,
      marginRate: data.revenue > 0 ? (data.margin / data.revenue) * 100 : 0,
    }));

    const columns: ExportColumn[] = [
      { key: 'name', header: 'Produit', width: 30 },
      { key: 'quantity', header: 'Quantité vendue', width: 15 },
      { key: 'revenue', header: 'CA (FCFA)', format: (v) => formatPrice(v), width: 15 },
      { key: 'cost', header: 'Coût (FCFA)', format: (v) => formatPrice(v), width: 15 },
      { key: 'margin', header: 'Marge (FCFA)', format: (v) => formatPrice(v), width: 15 },
      { key: 'marginRate', header: 'Taux marge (%)', format: (v) => v.toFixed(1), width: 12 },
    ];

    const exportData = {
      title: `Rapport_Benefices_${getPeriodLabel(period).replace(/\s/g, '_')}`,
      subtitle: `Du ${format(new Date(), 'dd/MM/yyyy', { locale: fr })}`,
      columns,
      data: productsData,
    };

    if (exportFormat === 'excel') {
      exportToExcel(exportData);
    } else {
      exportToCSV(exportData);
    }
  };

  // Fonction d'export pour le stock
  const handleExportStock = async (exportFormat: ExportFormat) => {
    const columns: ExportColumn[] = [
      { key: 'code', header: 'Code', width: 12 },
      { key: 'name', header: 'Produit', width: 30 },
      { key: 'category', header: 'Catégorie', width: 15 },
      { key: 'currentStock', header: 'Stock actuel', width: 12 },
      { key: 'unit', header: 'Unité', width: 10 },
      { key: 'alertThreshold', header: 'Seuil alerte', width: 12 },
      { key: 'purchasePrice', header: 'Prix achat (FCFA)', format: (v) => formatPrice(v || 0), width: 15 },
      { key: 'retailPrice', header: 'Prix vente (FCFA)', format: (v) => formatPrice(v || 0), width: 15 },
      {
        key: 'value',
        header: 'Valeur stock (FCFA)',
        format: (v, row) => formatPrice((row.currentStock || 0) * (row.purchasePrice || 0)),
        width: 18,
      },
      { key: 'status', header: 'Statut', width: 12 },
    ];

    const exportData = {
      title: `Rapport_Stock_${format(new Date(), 'dd/MM/yyyy', { locale: fr })}`,
      subtitle: `${products.length} produits`,
      columns,
      data: products,
    };

    if (exportFormat === 'excel') {
      exportToExcel(exportData);
    } else {
      exportToCSV(exportData);
    }
  };

  // Fonction d'export pour la caisse
  const handleExportCash = async (exportFormat: ExportFormat) => {
    const filteredMovements = getFilteredMovements();

    const columns: ExportColumn[] = [
      { key: 'createdAt', header: 'Date', format: (v) => format(new Date(v), 'dd/MM/yyyy HH:mm', { locale: fr }), width: 20 },
      { key: 'category', header: 'Catégorie', width: 15 },
      { key: 'description', header: 'Description', width: 30 },
      { key: 'amount', header: 'Montant (FCFA)', format: (v) => formatPrice(v), width: 15 },
      { key: 'type', header: 'Type', width: 12 },
      { key: 'cashRegisterId', header: 'Caisse ID', width: 30 },
    ];

    const exportData = {
      title: `Rapport_Caisse_${getPeriodLabel(period).replace(/\s/g, '_')}`,
      subtitle: `Du ${format(new Date(), 'dd/MM/yyyy', { locale: fr })}`,
      columns,
      data: filteredMovements,
    };

    if (exportFormat === 'excel') {
      exportToExcel(exportData);
    } else {
      exportToCSV(exportData);
    }
  };

  // Router vers la bonne fonction d'export
  const handleExport = async (exportFormat: ExportFormat) => {
    switch (activeTab) {
      case 'sales':
        await handleExportSales(exportFormat);
        break;
      case 'profits':
        await handleExportProfits(exportFormat);
        break;
      case 'stock':
        await handleExportStock(exportFormat);
        break;
      case 'cash':
        await handleExportCash(exportFormat);
        break;
    }
  };

  return (
    <ProtectedPage module="reports" action="read">
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rapports</h1>
            <p className="text-muted-foreground">
              Analyse et statistiques de votre activité
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Aujourd'hui</SelectItem>
                <SelectItem value="week">Cette semaine</SelectItem>
                <SelectItem value="month">Ce mois</SelectItem>
                <SelectItem value="year">Cette année</SelectItem>
                <SelectItem value="custom">Personnalisé</SelectItem>
              </SelectContent>
            </Select>
            <ExportButton onExport={handleExport} />
          </div>
        </div>

        {/* Onglets */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto">
            <TabsTrigger value="sales" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Ventes</span>
            </TabsTrigger>
            <TabsTrigger value="profits" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Bénéfices</span>
            </TabsTrigger>
            <TabsTrigger value="stock" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Stock</span>
            </TabsTrigger>
            <TabsTrigger value="cash" className="gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Caisse</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="space-y-6">
            <SalesReport period={period} />
          </TabsContent>

          <TabsContent value="profits" className="space-y-6">
            <ProfitsReport period={period} />
          </TabsContent>

          <TabsContent value="stock" className="space-y-6">
            <StockReport />
          </TabsContent>

          <TabsContent value="cash" className="space-y-6">
            <CashReport period={period} />
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedPage>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useInvoicesRealtime } from '@/lib/react-query/useInvoicesRealtime';
import { useInvoices as useInvoicesHelpers } from '@/lib/hooks/useInvoices';
import { useClientCredits } from '@/lib/hooks/useClientCredits';
import { useAuth } from '@/lib/hooks/useAuth';
import { useSettings } from '@/lib/hooks/useSettings';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { PermissionGate } from '@/components/auth';
import type { Invoice } from '@/types';
import { InvoiceDialog } from '@/components/invoices/InvoiceDialog';
import { InvoiceTable } from '@/components/invoices/InvoiceTable';
import { InvoiceDetailDialog } from '@/components/invoices/InvoiceDetailDialog';
import { StockTransferModal } from '@/components/sales/StockTransferModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KpiCard, KpiCardHeader, KpiCardValue } from '@/components/ui/kpi-card';
import { Plus, FileText, TrendingUp, DollarSign, AlertCircle, CloudOff, RefreshCw, Cloud, Calendar, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { fr } from 'date-fns/locale';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Type pour le résultat de création de facture (avec ou sans pending)
type InvoiceCreateResult = {
  id: string;
  invoiceNumber: string;
  total: number;
  status: string;
  remainingAmount: number;
  pending?: boolean;
};

export default function SalesPage() {
  // Utiliser React Query + onSnapshot pour les factures temps réel
  const { invoices: rawInvoices, isLoading } = useInvoicesRealtime();

  // État local pour la recherche
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'all' | Date>('today');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Filtrage local pour la recherche
  const invoices = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) {
      return rawInvoices;
    }

    const query = searchQuery.toLowerCase();
    return rawInvoices.filter(invoice =>
      invoice.invoiceNumber.toLowerCase().includes(query) ||
      (invoice.clientName && invoice.clientName.toLowerCase().includes(query))
    );
  }, [rawInvoices, searchQuery]);

  // Utiliser l'ancien hook pour les fonctions helpers (offline, stock, etc.)
  const {
    createInvoiceOffline,
    deleteInvoice,
    updateInvoice,
    isOnline,
    pendingInvoicesCount,
    isSyncing,
    syncPendingInvoices,
    checkStockBeforeInvoice,
    executeStockTransfers,
  } = useInvoicesHelpers();

  const { credits, payments } = useClientCredits();
  const { user } = useAuth();
  const { company, settings } = useSettings();
  const { canCreateSale, canDeleteSale, canAccessModule, getFirstAccessiblePage } = usePermissions();
  const router = useRouter();

  // Vérifier les permissions - rediriger si pas d'accès
  useEffect(() => {
    if (!canAccessModule('sales')) {
      router.push(getFirstAccessiblePage());
    }
  }, [canAccessModule, getFirstAccessiblePage, router]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [pendingInvoiceData, setPendingInvoiceData] = useState<any>(null);
  const [stockTransferProducts, setStockTransferProducts] = useState<any[]>([]);

  // Effet pour la synchronisation automatique
  useEffect(() => {
    if (isOnline && pendingInvoicesCount > 0 && !isSyncing) {
      // Afficher une notification de synchronisation
      const syncTimer = setTimeout(() => {
        syncPendingInvoices();
      }, 2000);

      return () => clearTimeout(syncTimer);
    }
  }, [isOnline, pendingInvoicesCount, isSyncing]);

  const handleCreateInvoice = async (data: any) => {
    if (!user?.currentCompanyId) {
      toast.error('Utilisateur non connecté');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Vérifier le stock avant création
      const primaryWarehouseId = settings?.stock?.defaultWarehouseId;
      const stockCheck = await checkStockBeforeInvoice(data.items, primaryWarehouseId);

      // 2. Si des produits nécessitent un transfert, afficher la modale
      if (stockCheck.productsNeedingTransfer.length > 0) {
        // Sauvegarder les données de la facture en attente
        setPendingInvoiceData(data);
        setStockTransferProducts(stockCheck.productsNeedingTransfer);
        setIsTransferModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      // 3. Si pas de transfert nécessaire, créer directement la facture
      const result = await createInvoiceOffline(data) as InvoiceCreateResult;

      // Si la facture est en attente (hors ligne)
      if ('pending' in result && result.pending) {
        toast.success(
          `Facture créée (en attente de synchronisation)`,
          {
            description: `La facture sera synchronisée lorsque vous serez en ligne`,
            action: {
              label: 'Voir',
              onClick: () => {
                // Ouvrir la liste des factures en attente
              },
            },
          }
        );
      } else {
        toast.success('Facture créée avec succès');
        // NOTE: Plus besoin de rafraîchir manuellement - onSnapshot gère la mise à jour automatiquement
        console.log('[SalesPage] Facture créée, onSnapshot va mettre à jour automatiquement');
      }

      setIsDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création de la facture');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferConfirm = async (transfers: Array<{ productId: string; fromWarehouseId: string; quantity: number }>) => {
    if (!settings?.stock?.defaultWarehouseId || !pendingInvoiceData) {
      toast.error('Erreur de configuration');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Exécuter les transferts
      await executeStockTransfers(transfers, settings.stock.defaultWarehouseId);

      // 2. Créer ou modifier la facture
      if (pendingInvoiceData.isUpdate && pendingInvoiceData.invoiceId) {
        // Mode modification
        const { invoiceId, isUpdate, ...invoiceData } = pendingInvoiceData;
        await updateInvoice(invoiceId, invoiceData);
        toast.success('Transferts effectués et facture modifiée avec succès');
      } else {
        // Mode création
        const result = await createInvoiceOffline(pendingInvoiceData) as InvoiceCreateResult;
        toast.success('Transferts effectués et facture créée avec succès');
      }

      console.log('[SalesPage] Transferts effectués, onSnapshot va mettre à jour automatiquement');

      // Fermer les modales
      setIsTransferModalOpen(false);
      setIsDialogOpen(false);
      setPendingInvoiceData(null);
      setStockTransferProducts([]);
      setEditingInvoice(null);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors des transferts ou de la création de la facture');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferCancel = () => {
    setIsTransferModalOpen(false);
    setPendingInvoiceData(null);
    setStockTransferProducts([]);
  };

  const handleSyncNow = async () => {
    try {
      const result = await syncPendingInvoices();

      if (result && result.total > 0) {
        toast.success(
          `Synchronisation terminée: ${result.success} facture(s) synchronisée(s)`,
          result.failed > 0 ? {
            description: `${result.failed} facture(s) n'ont pas pu être synchronisée(s)`,
          } : undefined
        );
      } else {
        toast.info('Aucune facture à synchroniser');
      }
    } catch (error: any) {
      toast.error('Erreur lors de la synchronisation');
    }
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailDialogOpen(true);
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette facture ?')) {
      return;
    }

    try {
      await deleteInvoice(id);
    } catch (error) {
      console.error('Erreur lors de l\'annulation:', error);
    }
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    // Ouvrir la page d'impression dans un nouvel onglet
    window.open(`/sales/print/${invoice.id}`, '_blank');
  };

   const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setIsDialogOpen(true);
  };

  const handleUpdateInvoice = async (invoiceId: string, data: any) => {
    if (!user?.currentCompanyId) {
      toast.error('Utilisateur non connecté');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Vérifier le stock avant modification — passer les anciens items pour le diff
      const primaryWarehouseId = settings?.stock?.defaultWarehouseId;
      const oldItems = editingInvoice?.items;
      const stockCheck = await checkStockBeforeInvoice(data.items, primaryWarehouseId, oldItems);

      // 2. Si des produits nécessitent un transfert, afficher la modale
      if (stockCheck.productsNeedingTransfer.length > 0) {
        setPendingInvoiceData({ ...data, invoiceId, isUpdate: true });
        setStockTransferProducts(stockCheck.productsNeedingTransfer);
        setIsTransferModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      // 3. Pas de transfert nécessaire, modifier directement
      await updateInvoice(invoiceId, data);
      setIsDialogOpen(false);
      setEditingInvoice(null);
      toast.success('Facture modifiée avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la modification de la facture');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Date cible pour le filtre
  const targetDate = useMemo(() => {
    if (dateFilter === 'all') return null;
    if (dateFilter === 'today') {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const d = new Date(dateFilter);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [dateFilter]);

  // Factures filtrées par date et excluant les annulées (admin: selon le filtre, employé: aujourd'hui)
  const displayedInvoices = useMemo(() => {
    const active = invoices.filter(inv => inv.status !== 'cancelled');
    if (!targetDate) return active;
    return active.filter(inv => {
      const invDate = new Date(inv.date);
      invDate.setHours(0, 0, 0, 0);
      return invDate.getTime() === targetDate.getTime();
    });
  }, [invoices, targetDate]);

  // CA = encaissé uniquement
  const allCreditPayments = Object.values(payments).flat();
  const periodCreditPaymentsTotal = allCreditPayments
    .filter(cp => {
      if (!targetDate) return true;
      const payDate = new Date(cp.createdAt);
      payDate.setHours(0, 0, 0, 0);
      return payDate.getTime() === targetDate.getTime();
    })
    .reduce((sum, cp) => sum + (cp.amount || 0), 0);

  const periodRevenue = displayedInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0) + periodCreditPaymentsTotal;
  const periodInvoicesCount = displayedInvoices.length;

  // Crédits actifs de la période
  const activeCredits = credits
    .filter(c => {
      if (c.status === 'paid' || c.status === 'cancelled') return false;
      if (!targetDate) return true;
      const creditDate = new Date(c.createdAt);
      creditDate.setHours(0, 0, 0, 0);
      return creditDate.getTime() === targetDate.getTime();
    })
    .reduce((sum, c) => sum + (c.remainingAmount || 0), 0);

  // Libellé de la période
  const periodLabel = useMemo(() => {
    if (dateFilter === 'all') return 'Toutes les factures';
    if (dateFilter === 'today') return "Aujourd'hui";
    return format(targetDate!, 'dd/MM/yyyy');
  }, [dateFilter, targetDate]);

  // Réinitialiser le filtre date pour les employés
  useEffect(() => {
    if (user?.role === 'employee') {
      setDateFilter('today');
    }
  }, [user?.role]);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Ventes</h1>

            {/* Indicateur de statut hors ligne */}
            {!isOnline && (
              <Badge variant="secondary" className="gap-1.5">
                <CloudOff className="h-3.5 w-3.5" />
                Hors ligne
              </Badge>
            )}

            {/* Indicateur de factures en attente */}
            {pendingInvoicesCount > 0 && (
              <Badge variant="outline" className="gap-1.5 border-orange-500 text-orange-600 hover:bg-orange-50">
                <AlertCircle className="h-3.5 w-3.5" />
                {pendingInvoicesCount} facture(s) en attente
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Gérez vos factures et vos ventes
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Bouton de synchronisation manuelle */}
          {pendingInvoicesCount > 0 && isOnline && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Synchronisation...' : 'Synchroniser'}
            </Button>
          )}

          <PermissionGate module="sales" action="create">
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle facture
            </Button>
          </PermissionGate>
        </div>
      </div>


      {/* Filtre par date (admin uniquement) */}
      {user?.role === 'admin' && (
        <div className="flex items-center gap-2">
          <Button
            variant={dateFilter === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('today')}
          >
            Aujourd'hui
          </Button>

          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={dateFilter instanceof Date ? 'default' : 'outline'}
                size="sm"
                className="gap-1"
              >
                <Calendar className="h-4 w-4" />
                {dateFilter instanceof Date ? format(dateFilter, 'dd/MM/yyyy') : 'Date précise'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={dateFilter instanceof Date ? dateFilter : undefined}
                onSelect={(date) => {
                  if (date) {
                    setDateFilter(date);
                    setIsCalendarOpen(false);
                  }
                }}
                locale={fr}
              />
            </PopoverContent>
          </Popover>

          <Button
            variant={dateFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('all')}
          >
            Toutes
          </Button>
        </div>
      )}

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard variant="info">
          <KpiCardHeader
            title="Factures"
            icon={<FileText className="h-5 w-5" />}
            iconVariant="info"
          />
          <KpiCardValue
            value={periodInvoicesCount}
            label={periodLabel}
            variant="info"
          />
        </KpiCard>

        <KpiCard variant="primary">
          <KpiCardHeader
            title="Chiffre d'affaires"
            icon={<TrendingUp className="h-5 w-5" />}
            iconVariant="primary"
          />
          <KpiCardValue
            value={`${periodRevenue.toLocaleString()} FCFA`}
            label={`Encaissé — ${periodLabel}`}
            variant="primary"
          />
        </KpiCard>

        <KpiCard variant="warning">
          <KpiCardHeader
            title="Crédits actifs"
            icon={<AlertCircle className="h-5 w-5" />}
            iconVariant="warning"
          />
          <KpiCardValue
            value={`${activeCredits.toLocaleString()} FCFA`}
            label={`Crédits — ${periodLabel}`}
            variant="warning"
          />
        </KpiCard>
      </div>

      {/* Liste des factures */}
      <Card>
        <CardHeader>
          <CardTitle>Factures</CardTitle>
          <CardDescription>
            Liste de toutes vos factures
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceTable
            invoices={displayedInvoices}
            loading={isLoading}
            onSearch={setSearchQuery}
            searchQuery={searchQuery}
            onView={handleViewInvoice}
            onEdit={handleEditInvoice}
            onDelete={handleDeleteInvoice}
          />
        </CardContent>
      </Card>

      {/* Dialog création facture */}
      <InvoiceDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingInvoice(null);
        }}
        onCreateInvoice={handleCreateInvoice}
        onUpdateInvoice={handleUpdateInvoice}
        editInvoice={editingInvoice}
        isSubmitting={isSubmitting}
      />

      {/* Dialog détail facture */}
      <InvoiceDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        invoice={selectedInvoice}
        company={company}
        onPrint={handlePrintInvoice}
      />

      {/* Modal de transfert de stock */}
      <StockTransferModal
        open={isTransferModalOpen}
        onClose={handleTransferCancel}
        products={stockTransferProducts}
        onConfirm={handleTransferConfirm}
        isLoading={isSubmitting}
      />
    </div>
  );
}

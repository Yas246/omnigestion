'use client';

import { useState, useEffect } from 'react';
import { useInvoicesStoreState, useInvoices, useInvoicesLoading, useInvoicesHasMore } from '@/lib/stores/useInvoicesStore';
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
import { Plus, FileText, TrendingUp, DollarSign, AlertCircle, CloudOff, RefreshCw, Cloud } from 'lucide-react';
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
  // Utiliser le store Zustand pour les données (pagination optimisée)
  const invoicesStore = useInvoicesStoreState();
  const invoices = useInvoices();
  const loading = useInvoicesLoading();
  const hasMore = useInvoicesHasMore();

  // État local pour la recherche (pas de conflit avec le store)
  const [searchQuery, setSearchQuery] = useState('');

  // Utiliser l'ancien hook pour les fonctions helpers (offline, stock, etc.)
  const {
    createInvoiceOffline,
    deleteInvoice,
    isOnline,
    pendingInvoicesCount,
    isSyncing,
    syncPendingInvoices,
    checkStockBeforeInvoice,
    executeStockTransfers,
  } = useInvoicesHelpers();

  const { credits } = useClientCredits();
  const { user } = useAuth();
  const { company, settings } = useSettings();
  const { canCreateSale, canDeleteSale } = usePermissions();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [pendingInvoiceData, setPendingInvoiceData] = useState<any>(null);
  const [stockTransferProducts, setStockTransferProducts] = useState<any[]>([]);

  // Charger les factures au montage
  useEffect(() => {
    if (user?.currentCompanyId && invoices.length === 0) {
      console.log('[SalesPage] Chargement initial des factures', { companyId: user.currentCompanyId });
      invoicesStore.fetchInvoices(user.currentCompanyId, { reset: true });
    }
  }, [user?.currentCompanyId]);

  // Effet pour la synchronisation automatique
  useEffect(() => {
    if (isOnline && pendingInvoicesCount > 0 && !isSyncing) {
      // Afficher une notification de synchronisation
      const syncTimer = setTimeout(() => {
        syncPendingInvoices();
      }, 2000);

      return () => clearTimeout(syncTimer);
    }
  }, [isOnline, pendingInvoicesCount]);

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

        // IMPORTANT: Rafraîchir les stores Zustand après vente
        console.log('[SalesPage] Rafraîchissement des stores après création');
        if (user?.currentCompanyId) {
          await invoicesStore.refreshInvoices(user.currentCompanyId);
        }

        // Rafraîchir les produits pour mettre à jour les stocks après vente
        const { useProductsStore } = await import('@/lib/stores/useProductsStore');
        console.log('[SalesPage] Rafraîchissement des produits pour mise à jour des stocks');
        if (user?.currentCompanyId) {
          await useProductsStore.getState().fetchProducts(user.currentCompanyId, { reset: true });
        }
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

      // 2. Créer la facture
      const result = await createInvoiceOffline(pendingInvoiceData) as InvoiceCreateResult;

      toast.success('Transferts effectués et facture créée avec succès');

      // IMPORTANT: Rafraîchir les stores Zustand après vente
      console.log('[SalesPage] Rafraîchissement des stores après transfert + création');
      if (user?.currentCompanyId) {
        await invoicesStore.refreshInvoices(user.currentCompanyId);
      }

      // Rafraîchir les produits pour mettre à jour les stocks après transfert
      const { useProductsStore } = await import('@/lib/stores/useProductsStore');
      console.log('[SalesPage] Rafraîchissement des produits pour mise à jour des stocks');
      if (user?.currentCompanyId) {
        await useProductsStore.getState().fetchProducts(user.currentCompanyId, { reset: true });
      }

      // Fermer les modales
      setIsTransferModalOpen(false);
      setIsDialogOpen(false);
      setPendingInvoiceData(null);
      setStockTransferProducts([]);
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

  // Calculer les statistiques du jour
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayInvoices = invoices.filter(inv => {
    const invDate = new Date(inv.date);
    invDate.setHours(0, 0, 0, 0);
    return invDate.getTime() === today.getTime();
  });

  const todayRevenue = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const todayPaid = todayInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const todayInvoicesCount = todayInvoices.length;

  // Calculer le total des crédits actifs (à partir des crédits réels, pas des factures)
  const activeCredits = credits
    .filter(c => c.status !== 'paid' && c.status !== 'cancelled')
    .reduce((sum, c) => sum + c.remainingAmount, 0);

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

      {/* Statistiques du jour */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Factures du jour</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayInvoicesCount}</div>
            <p className="text-xs text-muted-foreground">
              Aujourd'hui
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {todayRevenue.toLocaleString()} FCFA
            </div>
            <p className="text-xs text-muted-foreground">
              Total facturé aujourd'hui
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Encaissé</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {todayPaid.toLocaleString()} FCFA
            </div>
            <p className="text-xs text-muted-foreground">
              Montant payé aujourd'hui
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crédits actifs</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {activeCredits.toLocaleString()} FCFA
            </div>
            <p className="text-xs text-muted-foreground">
              Reste à payer total
            </p>
          </CardContent>
        </Card>
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
            invoices={invoices}
            loading={loading}
            hasMore={hasMore}
            totalLoaded={invoices.length}
            onSearch={setSearchQuery}
            searchQuery={searchQuery}
            onLoadMore={() => invoicesStore.loadMore()}
            onView={handleViewInvoice}
            onDelete={handleDeleteInvoice}
          />
        </CardContent>
      </Card>

      {/* Dialog création facture */}
      <InvoiceDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onCreateInvoice={handleCreateInvoice}
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

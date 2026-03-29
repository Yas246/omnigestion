'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KpiCard, KpiCardHeader, KpiCardValue } from '@/components/ui/kpi-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, DollarSign, Calendar, Package, User, Edit, Trash2 } from 'lucide-react';
import { useSuppliersRealtime } from '@/lib/react-query/useSuppliersRealtime';
import { useSupplierCreditsRealtime } from '@/lib/react-query/useSupplierCreditsRealtime';
import { usePurchasesRealtime } from '@/lib/react-query/usePurchasesRealtime';
import { useSuppliers } from '@/lib/hooks/useSuppliers'; // Garder pour les fonctions CRUD
import { useSupplierCredits } from '@/lib/hooks/useSupplierCredits'; // Garder pour les fonctions CRUD
import { usePermissions } from '@/lib/hooks/usePermissions';
import { PermissionGate } from '@/components/auth';
import { SupplierCreditPaymentDialog } from '@/components/suppliers/SupplierCreditPaymentDialog';
import { SupplierDialog } from '@/components/suppliers/SupplierDialog';
import { SupplierEditDialog } from '@/components/suppliers/SupplierEditDialog';
import { PurchaseDialog } from '@/components/suppliers/PurchaseDialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

// Custom hook pour le debouncing
function useDebounce(value: string, delay: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

type StatusFilter = 'all' | 'active' | 'overdue' | 'paid';
type PurchaseStatusFilter = 'all' | 'paid' | 'active' | 'partial';
type TabType = 'suppliers' | 'credits' | 'purchases';

export default function SuppliersPage() {
  const router = useRouter();
  const { canAccessModule, getFirstAccessiblePage } = usePermissions();

  // NOUVEAUX hooks React Query + onSnapshot pour temps réel
  const { suppliers, isLoading: suppliersLoading } = useSuppliersRealtime();
  const { credits, isLoading: creditsLoading } = useSupplierCreditsRealtime();
  const { purchases, isLoading: purchasesLoading } = usePurchasesRealtime();

  // Garder les anciens hooks pour les fonctions CRUD
  const { createSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const { addPayment } = useSupplierCredits();

  // Vérifier les permissions - rediriger si pas d'accès
  useEffect(() => {
    if (!canAccessModule('suppliers')) {
      router.push(getFirstAccessiblePage());
    }
  }, [canAccessModule, getFirstAccessiblePage, router]);

  const [activeTab, setActiveTab] = useState<TabType>('suppliers');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<PurchaseStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCredit, setSelectedCredit] = useState<any>(null);

  // Debouncing de 300ms pour la recherche
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { label: string; variant: any }> = {
      active: { label: 'En cours', variant: 'default' },
      partial: { label: 'En cours', variant: 'default' }, // Même affichage que active
      paid: { label: 'Payé', variant: 'outline' },
      overdue: { label: 'En retard', variant: 'destructive' },
      cancelled: { label: 'Annulé', variant: 'outline' },
    };
    return labels[status] || { label: status, variant: 'outline' };
  };

  const getPurchaseStatusLabel = (status: string) => {
    const labels: Record<string, { label: string; variant: any }> = {
      paid: { label: 'Payé', variant: 'outline' },
      active: { label: 'Non payé', variant: 'destructive' },
      partial: { label: 'Partiel', variant: 'default' },
    };
    return labels[status] || { label: status, variant: 'outline' };
  };

  // Filtrage local optimisé pour les crédits
  const filteredCredits = useMemo(() => {
    return credits.filter((credit) => {
      // 'active' inclut à la fois 'active' et 'partial'
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && (credit.status === 'active' || credit.status === 'partial')) ||
        credit.status === statusFilter;

      // Ne filtrer que si la recherche est vide ou a minimum 3 caractères
      if (debouncedSearchQuery.length > 0 && debouncedSearchQuery.length < 3) {
        return false; // Masquer tous les résultats si moins de 3 caractères
      }
      const matchesSearch =
        debouncedSearchQuery === '' ||
        credit.supplierName?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        credit.invoiceNumber?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [credits, statusFilter, debouncedSearchQuery]);

  // Statistiques optimisées avec useMemo (seulement les crédits actifs)
  const { totalCredits, totalPaid, totalRemaining, activeCreditsCount } = useMemo(() => {
    const activeCredits = credits.filter((c) => c.status !== 'paid' && c.status !== 'cancelled');
    return {
      totalCredits: activeCredits.reduce((sum, c) => sum + (c.amount || 0), 0),
      totalPaid: activeCredits.reduce((sum, c) => sum + (c.amountPaid || 0), 0),
      totalRemaining: activeCredits.reduce((sum, c) => sum + (c.remainingAmount || 0), 0),
      activeCreditsCount: activeCredits.length,
    };
  }, [credits]);

  // Filtrage local pour les achats
  const filteredPurchases = useMemo(() => {
    return purchases.filter((purchase) => {
      const matchesStatus =
        purchaseStatusFilter === 'all' || purchase.status === purchaseStatusFilter;

      const matchesSearch =
        debouncedSearchQuery === '' ||
        debouncedSearchQuery.length < 3 ||
        purchase.supplierName?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        purchase.purchaseNumber?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [purchases, purchaseStatusFilter, debouncedSearchQuery]);

  const handlePayment = async (data: any) => {
    if (!selectedCredit) return;
    try {
      await addPayment(selectedCredit.id, data);
      setShowPaymentDialog(false);
      setSelectedCredit(null);
      toast.success('Paiement enregistré avec succès');
      // NOTE: Plus besoin de recharger - onSnapshot met à jour automatiquement
    } catch (error: any) {
      console.error('Erreur lors du paiement:', error);
      toast.error('Erreur lors de l\'enregistrement du paiement');
    }
  };

  const handleCreateSupplier = async (data: any) => {
    setIsCreating(true);
    try {
      await createSupplier(data);
      setShowSupplierDialog(false);
      toast.success('Fournisseur créé avec succès');
      // NOTE: Plus besoin de recharger - onSnapshot met à jour automatiquement
    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      toast.error('Erreur lors de la création du fournisseur');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateSupplier = async (data: any) => {
    setIsUpdating(true);
    try {
      await updateSupplier(selectedSupplier.id, data);
      setShowEditDialog(false);
      setSelectedSupplier(null);
      toast.success('Fournisseur modifié avec succès');
      // NOTE: Plus besoin de recharger - onSnapshot met à jour automatiquement
    } catch (error: any) {
      console.error('Erreur lors de la modification:', error);
      toast.error('Erreur lors de la modification du fournisseur');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) {
      return;
    }

    try {
      await deleteSupplier(supplierId);
      toast.success('Fournisseur supprimé avec succès');
      // NOTE: Plus besoin de recharger - onSnapshot met à jour automatiquement
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression du fournisseur');
    }
  };

  const openEditDialog = (supplier: any) => {
    setSelectedSupplier(supplier);
    setShowEditDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fournisseurs</h1>
          <p className="text-muted-foreground">
            Gérez vos fournisseurs et vos achats
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <PermissionGate module="suppliers" action="create">
            <Button variant="outline" onClick={() => setShowSupplierDialog(true)}>
              <User className="h-4 w-4 mr-2" />
              Nouveau fournisseur
            </Button>
          </PermissionGate>
          <PermissionGate module="suppliers" action="purchase">
            <Button onClick={() => setShowPurchaseDialog(true)}>
              <Package className="h-4 w-4 mr-2" />
              Nouvel achat
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'suppliers'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Fournisseurs ({suppliers.length})
        </button>
        <button
          onClick={() => setActiveTab('credits')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'credits'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Crédits ({activeCreditsCount})
        </button>
        <button
          onClick={() => setActiveTab('purchases')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'purchases'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Achats ({purchases.length})
        </button>
      </div>

      {activeTab === 'suppliers' ? (
        /* Liste des fournisseurs */
        <Card>
          <CardHeader>
            <CardTitle>Fournisseurs</CardTitle>
            <CardDescription>Liste de vos fournisseurs</CardDescription>
          </CardHeader>
          <CardContent>
            {suppliersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : suppliers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">
                  Aucun fournisseur. Ajoutez votre premier fournisseur.
                </p>
                <PermissionGate module="suppliers" action="create">
                  <Button onClick={() => setShowSupplierDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un fournisseur
                  </Button>
                </PermissionGate>
              </div>
            ) : (
              <div className="space-y-3">
                {suppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium">{supplier.name}</span>
                        {supplier.code && (
                          <Badge variant="outline">{supplier.code}</Badge>
                        )}
                        {supplier.isActive ? (
                          <Badge variant="default">Actif</Badge>
                        ) : (
                          <Badge variant="secondary">Inactif</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {supplier.phone && <span>Tél: {supplier.phone}</span>}
                        {supplier.email && <span>Email: {supplier.email}</span>}
                        {supplier.address && <span>Adresse: {supplier.address}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <PermissionGate module="suppliers" action="update">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(supplier)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate module="suppliers" action="delete">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSupplier(supplier.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : activeTab === 'credits' ? (
        /* Liste des crédits fournisseurs */
        <>
          {/* Statistiques */}
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard variant="danger">
              <KpiCardHeader
                title="Total dettes"
                icon={<DollarSign className="h-4 w-4" />}
                iconVariant="danger"
              />
              <KpiCardValue
                value={`${formatPrice(totalCredits)} FCFA`}
                label={`${activeCreditsCount} crédit(s)`}
                variant="danger"
              />
            </KpiCard>

            <KpiCard variant="success">
              <KpiCardHeader
                title="Total payé"
                icon={<DollarSign className="h-4 w-4" />}
                iconVariant="success"
              />
              <KpiCardValue
                value={`${formatPrice(totalPaid)} FCFA`}
                variant="success"
              />
            </KpiCard>

            <KpiCard variant="warning">
              <KpiCardHeader
                title="Reste à payer"
                icon={<DollarSign className="h-4 w-4" />}
                iconVariant="warning"
              />
              <KpiCardValue
                value={`${formatPrice(totalRemaining)} FCFA`}
                variant="warning"
              />
            </KpiCard>
          </div>

          {/* Filtres et liste */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Crédits fournisseurs</CardTitle>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                  <Input
                    placeholder="Rechercher fournisseur, facture... (min. 3 caractères)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-64"
                  />
                  <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="active">En cours</SelectItem>
                      <SelectItem value="overdue">En retard</SelectItem>
                      <SelectItem value="paid">Payé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {creditsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCredits.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun crédit trouvé
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredCredits.map((credit) => (
                    <div
                      key={credit.id}
                      className="flex flex-wrap items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors sm:flex-nowrap sm:justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-medium">{credit.supplierName}</span>
                          {credit.invoiceNumber && (
                            <span className="text-sm text-muted-foreground">
                              Achat {credit.invoiceNumber}
                            </span>
                          )}
                          <Badge variant={getStatusLabel(credit.status).variant}>
                            {getStatusLabel(credit.status).label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            Total : {formatPrice(credit.amount || 0)} FCFA
                          </span>
                          <span className="text-[oklch(0.65_0.12_145)]">
                            Payé : {formatPrice(credit.amountPaid || 0)} FCFA
                          </span>
                          <span className="text-[oklch(0.75_0.15_75)] font-medium">
                            Reste : {formatPrice(credit.remainingAmount || 0)} FCFA
                          </span>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(credit.createdAt || credit.date), 'dd/MM/yyyy', { locale: fr })}
                          </span>
                          {credit.dueDate && (
                            <span className="text-muted-foreground">
                              Échéance : {format(new Date(credit.dueDate), 'dd/MM/yyyy', { locale: fr })}
                            </span>
                          )}
                        </div>
                      </div>
                      <PermissionGate module="suppliers" action="payment">
                        {credit.status !== 'paid' && credit.status !== 'cancelled' && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedCredit(credit);
                              setShowPaymentDialog(true);
                            }}
                            className="shrink-0"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            <span>Payer</span>
                          </Button>
                        )}
                      </PermissionGate>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        /* Liste des achats */
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Achats fournisseurs</CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                <Input
                  placeholder="Rechercher fournisseur, n° achat... (min. 3 caractères)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64"
                />
                <Select value={purchaseStatusFilter} onValueChange={(v: any) => setPurchaseStatusFilter(v)}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="paid">Payé</SelectItem>
                    <SelectItem value="active">Non payé</SelectItem>
                    <SelectItem value="partial">Partiel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {purchasesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPurchases.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun achat trouvé
              </p>
            ) : (
              <div className="space-y-3">
                {filteredPurchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="flex flex-wrap items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors sm:flex-nowrap sm:justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium">{purchase.supplierName}</span>
                        <span className="text-sm text-muted-foreground">
                          {purchase.purchaseNumber}
                        </span>
                        <Badge variant={getPurchaseStatusLabel(purchase.status).variant}>
                          {getPurchaseStatusLabel(purchase.status).label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          Total : {formatPrice(purchase.total || 0)} FCFA
                        </span>
                        <span className="text-[oklch(0.65_0.12_145)]">
                          Payé : {formatPrice(purchase.paidAmount || 0)} FCFA
                        </span>
                        {purchase.remainingAmount > 0 && (
                          <span className="text-[oklch(0.75_0.15_75)] font-medium">
                            Reste : {formatPrice(purchase.remainingAmount || 0)} FCFA
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {purchase.items?.length || 0} article(s)
                        </span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(purchase.createdAt), 'dd/MM/yyyy', { locale: fr })}
                        </span>
                      </div>
                      {purchase.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{purchase.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <SupplierDialog
        open={showSupplierDialog}
        onOpenChange={setShowSupplierDialog}
        onCreateSupplier={handleCreateSupplier}
        isSubmitting={isCreating}
      />

      <SupplierEditDialog
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) setSelectedSupplier(null);
        }}
        supplier={selectedSupplier}
        onUpdateSupplier={handleUpdateSupplier}
        isSubmitting={isUpdating}
      />

      <PurchaseDialog
        open={showPurchaseDialog}
        onOpenChange={setShowPurchaseDialog}
        suppliers={suppliers}
      />

      <SupplierCreditPaymentDialog
        open={showPaymentDialog}
        onOpenChange={(open) => {
          setShowPaymentDialog(open);
          if (!open) setSelectedCredit(null);
        }}
        credit={selectedCredit}
        onSubmit={handlePayment}
      />
    </div>
  );
}

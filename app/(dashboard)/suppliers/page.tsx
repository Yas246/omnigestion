'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, DollarSign, Calendar, Package, User, Edit } from 'lucide-react';
import { useSuppliers } from '@/lib/hooks/useSuppliers';
import { useSupplierCredits } from '@/lib/hooks/useSupplierCredits';
import { PermissionGate } from '@/components/auth';
import { SupplierCreditPaymentDialog } from '@/components/suppliers/SupplierCreditPaymentDialog';
import { SupplierDialog } from '@/components/suppliers/SupplierDialog';
import { SupplierEditDialog } from '@/components/suppliers/SupplierEditDialog';
import { PurchaseDialog } from '@/components/suppliers/PurchaseDialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
type TabType = 'suppliers' | 'credits';

export default function SuppliersPage() {
  const { suppliers, loading: suppliersLoading, createSupplier, updateSupplier } = useSuppliers();
  const { credits, loading: creditsLoading, addPayment } = useSupplierCredits();
  const [activeTab, setActiveTab] = useState<TabType>('suppliers');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
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

  const filteredCredits = credits.filter((credit) => {
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
      credit.supplierName.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      credit.invoiceNumber?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totalCredits = credits.reduce((sum, c) => sum + c.amount, 0);
  const totalPaid = credits.reduce((sum, c) => sum + c.amountPaid, 0);
  const totalRemaining = credits.reduce((sum, c) => sum + c.remainingAmount, 0);

  const handlePayment = async (data: any) => {
    if (!selectedCredit) return;
    try {
      await addPayment(selectedCredit.id, data);
      setShowPaymentDialog(false);
      setSelectedCredit(null);
    } catch (error: any) {
      console.error('Erreur lors du paiement:', error);
    }
  };

  const handleCreateSupplier = async (data: any) => {
    setIsCreating(true);
    try {
      await createSupplier(data);
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
    } finally {
      setIsUpdating(false);
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
          <PermissionGate module="credits" action="create">
            <Button variant="outline" onClick={() => setShowSupplierDialog(true)}>
              <User className="h-4 w-4 mr-2" />
              Nouveau fournisseur
            </Button>
          </PermissionGate>
          <PermissionGate module="credits" action="create">
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
          Crédits ({credits.length})
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
                <PermissionGate module="credits" action="create">
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
                    <PermissionGate module="credits" action="update">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(supplier)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </PermissionGate>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Liste des crédits fournisseurs */
        <>
          {/* Statistiques */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total dettes</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPrice(totalCredits)} FCFA</div>
                <p className="text-xs text-muted-foreground">{credits.length} crédit(s)</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total payé</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatPrice(totalPaid)} FCFA</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reste à payer</CardTitle>
                <DollarSign className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{formatPrice(totalRemaining)} FCFA</div>
              </CardContent>
            </Card>
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
                  {debouncedSearchQuery ? 'Aucun crédit trouvé' : 'Aucun crédit trouvé'}
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredCredits.map((credit) => (
                    <div
                      key={credit.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
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
                            Total : {formatPrice(credit.amount)} FCFA
                          </span>
                          <span className="text-green-600">
                            Payé : {formatPrice(credit.amountPaid)} FCFA
                          </span>
                          <span className="text-orange-600 font-medium">
                            Reste : {formatPrice(credit.remainingAmount)} FCFA
                          </span>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(credit.date), 'dd/MM/yyyy', { locale: fr })}
                          </span>
                          {credit.dueDate && (
                            <span className="text-muted-foreground">
                              Échéance : {format(new Date(credit.dueDate), 'dd/MM/yyyy', { locale: fr })}
                            </span>
                          )}
                        </div>
                      </div>
                      <PermissionGate module="credits" action="payment">
                        {credit.status !== 'paid' && credit.status !== 'cancelled' && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedCredit(credit);
                              setShowPaymentDialog(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Payer
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

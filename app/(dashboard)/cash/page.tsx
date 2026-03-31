'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KpiCard, KpiCardHeader, KpiCardValue } from '@/components/ui/kpi-card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Plus, ArrowUpCircle, ArrowDownCircle, ArrowRightCircle, DollarSign, Pencil, Trash2, MoreVertical, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { PermissionGate } from '@/components/auth';
import { CashMovementDialog } from '@/components/cash/CashMovementDialog';
import { CashRegisterDialog } from '@/components/cash/CashRegisterDialog';
import { useCashRegistersRealtime } from '@/lib/react-query/useCashRegistersRealtime';
import { useCashMovementsRealtime } from '@/lib/react-query/useCashMovementsRealtime';
import { useCashRegistersStore } from '@/lib/stores/useCashRegistersStore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import type { CashRegister } from '@/types';

export default function CashPage() {
  const router = useRouter();

  // NOUVEAUX hooks React Query + onSnapshot pour temps réel
  const { cashRegisters, isLoading: registersLoading } = useCashRegistersRealtime();
  const {
    movements,
    loadMore,
    hasMore: movementsHasMore,
    isLoading: movementsLoading,
  } = useCashMovementsRealtime();

  // Garder le store pour les autres fonctions utilitaires (CRUD)
  const { deleteCashRegister } = useCashRegistersStore();

  const { canCreateCashOperation, canAccessModule, getFirstAccessiblePage } = usePermissions();

  // Vérifier les permissions - rediriger si pas d'accès
  useEffect(() => {
    if (!canAccessModule('cash')) {
      router.push(getFirstAccessiblePage());
    }
  }, [canAccessModule, getFirstAccessiblePage, router]);

  // Obtenir l'utilisateur connecté
  const { user } = useAuth();

  // État local UI seulement
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [selectedCashRegister, setSelectedCashRegister] = useState<string | null>(null);
  const [editingCashRegister, setEditingCashRegister] = useState<CashRegister | null>(null);
  const [deletingCashRegister, setDeletingCashRegister] = useState<CashRegister | null>(null);

  // NOTE: Plus besoin d'initialiser le store manuellement - onSnapshot gère ça automatiquement
  // NOTE: Plus besoin de fetchMovements - onSnapshot synchronise tout automatiquement

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      sale: 'Vente',
      expense: 'Dépense',
      supplier: 'Fournisseur',
      transfer: 'Transfert',
      deposit: 'Dépôt',
      withdrawal: 'Retrait',
      adjustment: 'Ajustement',
    };
    return labels[category] || category;
  };

  // Calculer les statistiques localement depuis les données React Query (optimisé)
  const todayStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayMovements = movements.filter(m => {
      const movementDate = new Date(m.createdAt);
      movementDate.setHours(0, 0, 0, 0);
      return movementDate.getTime() === today.getTime();
    });

    const grossIn = todayMovements
      .filter(m => m.type === 'in' || (m.type === 'transfer' && m.sourceCashRegisterId))
      .reduce((sum, m) => sum + m.amount, 0);

    const cancellationOut = todayMovements
      .filter(m => m.type === 'out' && (m.category === 'cancellation' || m.category === 'credit_payment_reversal'))
      .reduce((sum, m) => sum + m.amount, 0);

    const todayIn = grossIn - cancellationOut;

    const todayOut = todayMovements
      .filter(m => m.type === 'out' || (m.type === 'transfer' && !m.sourceCashRegisterId))
      .reduce((sum, m) => sum + m.amount, 0);

    return { todayIn, todayOut };
  }, [movements]);

  // Calculer les totaux du jour pour l'affichage
  const todayInCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const grossInCount = movements.filter(m => {
      const movementDate = new Date(m.createdAt);
      movementDate.setHours(0, 0, 0, 0);
      return movementDate.getTime() === today.getTime() &&
        (m.type === 'in' || (m.type === 'transfer' && m.sourceCashRegisterId));
    }).length;
    const cancelCount = movements.filter(m => {
      const movementDate = new Date(m.createdAt);
      movementDate.setHours(0, 0, 0, 0);
      return movementDate.getTime() === today.getTime() &&
        m.type === 'out' && (m.category === 'cancellation' || m.category === 'credit_payment_reversal');
    }).length;
    return grossInCount - cancelCount;
  }, [movements]);

  const todayOutCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return movements.filter(m => {
      const movementDate = new Date(m.createdAt);
      movementDate.setHours(0, 0, 0, 0);
      return movementDate.getTime() === today.getTime() &&
        (m.type === 'out' || (m.type === 'transfer' && !m.sourceCashRegisterId));
    }).length;
  }, [movements]);

  // Calculer le solde total depuis les caisses (le solde est déjà calculé dans Firestore)
  const totalBalance = useMemo(() => {
    return cashRegisters.reduce((sum, cr) => sum + (cr.currentBalance || 0), 0);
  }, [cashRegisters]);

  // Handler pour l'édition d'une caisse
  const handleEditCashRegister = (cashRegister: CashRegister) => {
    setEditingCashRegister(cashRegister);
    setShowRegisterDialog(true);
  };

  // Handler pour la suppression d'une caisse
  const handleDeleteCashRegister = async () => {
    if (!deletingCashRegister || !user?.currentCompanyId) return;

    try {
      await deleteCashRegister(deletingCashRegister.id);
      toast.success('Caisse supprimée avec succès');
      setDeletingCashRegister(null);
      // NOTE: Plus besoin de recharger - onSnapshot met à jour automatiquement
    } catch {
      toast.error('Erreur lors de la suppression de la caisse');
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Caisse</h1>
          <p className="text-muted-foreground">
            Gestion des caisses et des mouvements de trésorerie
          </p>
        </div>
        <PermissionGate module="cash" action="create">
          <Button onClick={() => setShowMovementDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau mouvement
          </Button>
        </PermissionGate>
      </div>

      {/* Statistiques globales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard variant="primary">
          <KpiCardHeader
            title="Solde total"
            icon={<DollarSign className="h-4 w-4" />}
            iconVariant="primary"
          />
          <KpiCardValue
            value={`${formatPrice(totalBalance)} FCFA`}
            label={`${cashRegisters.length} caisse(s)`}
            variant="primary"
          />
        </KpiCard>

        <KpiCard variant="success">
          <KpiCardHeader
            title="Entrées aujourd'hui"
            icon={<ArrowUpCircle className="h-4 w-4" />}
            iconVariant="success"
          />
          <KpiCardValue
            value={`${formatPrice(todayStats.todayIn)} FCFA`}
            label={`${todayInCount} mouvement(s)`}
            variant="success"
          />
        </KpiCard>

        <KpiCard variant="danger">
          <KpiCardHeader
            title="Sorties aujourd'hui"
            icon={<ArrowDownCircle className="h-4 w-4" />}
            iconVariant="danger"
          />
          <KpiCardValue
            value={`${formatPrice(todayStats.todayOut)} FCFA`}
            label={`${todayOutCount} mouvement(s)`}
            variant="danger"
          />
        </KpiCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Liste des caisses */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Caisses</CardTitle>
                <CardDescription>Solde actuel de chaque caisse</CardDescription>
              </div>
              <PermissionGate module="cash" action="create">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingCashRegister(null);
                    setShowRegisterDialog(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle caisse
                </Button>
              </PermissionGate>
            </div>
          </CardHeader>
          <CardContent>
            {cashRegisters.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune caisse configurée</p>
            ) : (
              <div className="space-y-3">
                {cashRegisters.map((cr) => (
                  <div
                    key={cr.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{cr.name}</span>
                      {cr.code && (
                        <span className="text-xs text-muted-foreground">{cr.code}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold">{formatPrice(cr.currentBalance || 0)} FCFA</p>
                        {cr.isMain && (
                          <Badge variant="outline" className="text-xs">Principale</Badge>
                        )}
                      </div>
                      <PermissionGate module="cash" action="create">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setSelectedCashRegister(cr.id);
                            setShowMovementDialog(true);
                          }}
                          title="Ajouter un mouvement"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </PermissionGate>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditCashRegister(cr)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingCashRegister(cr)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Derniers mouvements */}
        <Card>
          <CardHeader>
            <CardTitle>Derniers mouvements</CardTitle>
            <CardDescription>Historique récent des opérations</CardDescription>
          </CardHeader>
          <CardContent>
            {movementsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : movements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun mouvement</p>
            ) : (
              <>
                <div className="space-y-3 max-h-100 overflow-y-auto">
                  {movements.map((movement) => {
                    const cashRegister = cashRegisters.find(cr => cr.id === movement.cashRegisterId);
                    const isIn = movement.type === 'in' || (movement.type === 'transfer' && movement.sourceCashRegisterId);

                    return (
                      <div key={movement.id} className="flex items-center justify-between text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium">{getCategoryLabel(movement.category)}</span>
                          <span className="text-xs text-muted-foreground">
                            {cashRegister?.name || 'Caisse inconnue'} - {format(new Date(movement.createdAt), 'HH:mm', { locale: fr })}
                          </span>
                          {movement.description && (
                            <span className="text-xs text-muted-foreground">{movement.description}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isIn ? 'text-[oklch(0.65_0.12_145)]' : 'text-[oklch(0.58_0.22_25)]'}`}>
                            {isIn ? '+' : '-'}{formatPrice(movement.amount)} FCFA
                          </span>
                          <Badge variant={isIn ? 'default' : 'destructive'} className="text-xs">
                            {isIn ? 'Entrée' : 'Sortie'}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination : Charger plus de mouvements */}
                {movementsHasMore && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline"
                      onClick={() => loadMore()}
                      disabled={movementsLoading}
                    >
                      {movementsLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Chargement...
                        </>
                      ) : (
                        'Charger plus de mouvements'
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog pour les mouvements */}
      <CashMovementDialog
        open={showMovementDialog}
        onOpenChange={(open) => {
          setShowMovementDialog(open);
          if (!open) setSelectedCashRegister(null);
        }}
        cashRegisterId={selectedCashRegister}
        cashRegisters={cashRegisters}
        onSuccess={() => {
          // NOTE: Plus besoin de recharger - onSnapshot met à jour automatiquement
          toast.success('Mouvement enregistré avec succès');
        }}
      />

      {/* Dialog pour créer/éditer une caisse */}
      <CashRegisterDialog
        open={showRegisterDialog}
        onOpenChange={(open) => {
          setShowRegisterDialog(open);
          if (!open) setEditingCashRegister(null);
        }}
        cashRegister={editingCashRegister}
        onSuccess={() => {
          // NOTE: Plus besoin de recharger - onSnapshot met à jour automatiquement
          toast.success(editingCashRegister ? 'Caisse modifiée avec succès' : 'Caisse créée avec succès');
        }}
      />

      {/* Alert de suppression */}
      <Dialog open={!!deletingCashRegister} onOpenChange={() => setDeletingCashRegister(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Supprimer la caisse
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la caisse &quot;{deletingCashRegister?.name}&quot; ?
              Cette action est irréversible et supprimera également tous les mouvements associés.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingCashRegister(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteCashRegister}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

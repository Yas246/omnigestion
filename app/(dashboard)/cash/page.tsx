'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { useCashRegisters } from '@/lib/hooks/useCashRegisters';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { PermissionGate } from '@/components/auth';
import { CashMovementDialog } from '@/components/cash/CashMovementDialog';
import { CashRegisterDialog } from '@/components/cash/CashRegisterDialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import type { CashRegister } from '@/types';

export default function CashPage() {
  const {
    cashRegisters,
    movements,
    loading,
    calculateBalance,
    createMovement,
    fetchCashRegisters,
    fetchMovements,
    deleteCashRegister,
  } = useCashRegisters();

  const { canCreateCashOperation } = usePermissions();

  const [balances, setBalances] = useState<Record<string, number>>({});
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [selectedCashRegister, setSelectedCashRegister] = useState<string | null>(null);
  const [editingCashRegister, setEditingCashRegister] = useState<CashRegister | null>(null);
  const [deletingCashRegister, setDeletingCashRegister] = useState<CashRegister | null>(null);

  useEffect(() => {
    // Calculer les soldes de toutes les caisses
    const fetchBalances = async () => {
      const balancePromises = cashRegisters.map(async (cr) => {
        const balance = await calculateBalance(cr.id);
        return { id: cr.id, balance };
      });

      const balanceResults = await Promise.all(balancePromises);
      const balanceMap = balanceResults.reduce((acc, { id, balance }) => {
        acc[id] = balance;
        return acc;
      }, {} as Record<string, number>);

      setBalances(balanceMap);
    };

    if (cashRegisters.length > 0) {
      fetchBalances();
    }
  }, [cashRegisters, movements]); // Ajout de movements pour recalculer quand il y a des changements

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

  const totalBalance = Object.values(balances).reduce((sum, balance) => sum + balance, 0);

  // Calculer les statistiques du jour
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayMovements = movements.filter(m => {
    const movementDate = new Date(m.createdAt);
    movementDate.setHours(0, 0, 0, 0);
    return movementDate.getTime() === today.getTime();
  });

  const todayIn = todayMovements
    .filter(m => m.type === 'in' || (m.type === 'transfer' && m.sourceCashRegisterId))
    .reduce((sum, m) => sum + m.amount, 0);

  const todayOut = todayMovements
    .filter(m => m.type === 'out' || (m.type === 'transfer' && !m.sourceCashRegisterId))
    .reduce((sum, m) => sum + m.amount, 0);

  // Handler pour l'édition d'une caisse
  const handleEditCashRegister = (cashRegister: CashRegister) => {
    setEditingCashRegister(cashRegister);
    setShowRegisterDialog(true);
  };

  // Handler pour la suppression d'une caisse
  const handleDeleteCashRegister = async () => {
    if (!deletingCashRegister) return;

    try {
      await deleteCashRegister(deletingCashRegister.id);
      toast.success('Caisse supprimée avec succès');
      setDeletingCashRegister(null);
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solde total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(totalBalance)} FCFA</div>
            <p className="text-xs text-muted-foreground">
              {cashRegisters.length} caisse(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entrées aujourd'hui</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatPrice(todayIn)} FCFA</div>
            <p className="text-xs text-muted-foreground">
              {todayMovements.filter(m => m.type === 'in' || (m.type === 'transfer' && m.sourceCashRegisterId)).length} mouvement(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sorties aujourd'hui</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatPrice(todayOut)} FCFA</div>
            <p className="text-xs text-muted-foreground">
              {todayMovements.filter(m => m.type === 'out' || (m.type === 'transfer' && !m.sourceCashRegisterId)).length} mouvement(s)
            </p>
          </CardContent>
        </Card>
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
                        <p className="font-bold">{formatPrice(balances[cr.id] || 0)} FCFA</p>
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
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : movements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun mouvement</p>
            ) : (
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
                        <span className={`font-semibold ${isIn ? 'text-green-600' : 'text-red-600'}`}>
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
        onSuccess={() => fetchMovements()}
      />

      {/* Dialog pour créer/éditer une caisse */}
      <CashRegisterDialog
        open={showRegisterDialog}
        onOpenChange={(open) => {
          setShowRegisterDialog(open);
          if (!open) setEditingCashRegister(null);
        }}
        cashRegister={editingCashRegister}
        onSuccess={() => fetchCashRegisters()}
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

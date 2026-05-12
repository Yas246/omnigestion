'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import type { Product, StockMovement } from '@/types';
import { useStockMovementsRealtime } from '@/lib/react-query/useStockMovementsRealtime';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowUp, ArrowDown, ArrowRight, XCircle, History } from 'lucide-react';
import { getMovementBadge } from '@/lib/utils/stock-helpers';

interface ProductMovementHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

const referenceTypeLabels: Record<string, string> = {
  invoice: 'Vente',
  invoice_modification: 'Modification facture',
  invoice_cancellation: 'Annulation facture',
  restock: 'Approvisionnement',
  purchase: 'Achat fournisseur',
  adjustment: 'Ajustement',
  loss: 'Perte',
  transfer: 'Transfert',
  auto_transfer_for_sale: 'Transfert auto (vente)',
};

function getOperationLabel(movement: StockMovement) {
  const typeLabel = referenceTypeLabels[movement.referenceType || ''] || movement.referenceType || '—';
  return (
    <div>
      <span>{typeLabel}</span>
      {movement.reason && movement.reason !== typeLabel && (
        <p className="text-xs text-muted-foreground mt-0.5">{movement.reason}</p>
      )}
    </div>
  );
}

export function ProductMovementHistoryDialog({
  open,
  onOpenChange,
  product,
}: ProductMovementHistoryDialogProps) {
  const { allMovements } = useStockMovementsRealtime();

  const movements = useMemo(() => {
    if (!product) return [];
    return allMovements
      .filter((m: StockMovement) => m.productId === product.id)
      .sort((a: StockMovement, b: StockMovement) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
  }, [allMovements, product]);

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique — {product.name}
          </DialogTitle>
          <DialogDescription>
            {movements.length} mouvement{movements.length !== 1 ? 's' : ''} enregistré{movements.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        {movements.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Aucun mouvement enregistré pour ce produit
          </div>
        ) : (
          /* Desktop : tableau, Mobile : cartes */
          <>
            <div className="hidden sm:block rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium whitespace-nowrap">Date</th>
                    <th className="text-center p-3 font-medium">Qté initiale</th>
                    <th className="text-center p-3 font-medium">Type</th>
                    <th className="text-center p-3 font-medium">Mouvement</th>
                    <th className="text-center p-3 font-medium">Qté finale</th>
                    <th className="text-left p-3 font-medium">Opération</th>
                    <th className="text-left p-3 font-medium whitespace-nowrap">Utilisateur</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement: StockMovement) => (
                    <tr key={movement.id} className="border-b last:border-0">
                      <td className="p-3 whitespace-nowrap">
                        {format(
                          movement.createdAt instanceof Date ? movement.createdAt : new Date(movement.createdAt),
                          'dd/MM/yyyy HH:mm'
                        )}
                      </td>
                      <td className="p-3 text-center font-mono">
                        {movement.quantityBefore ?? '—'}
                      </td>
                      <td className="p-3 text-center">
                        {getMovementBadge(movement)}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold">
                        {Math.abs(movement.quantity)}
                      </td>
                      <td className="p-3 text-center font-mono">
                        {movement.quantityAfter ?? '—'}
                      </td>
                      <td className="p-3">
                        {getOperationLabel(movement)}
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {movement.userName || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden space-y-3">
              {movements.map((movement: StockMovement) => (
                <div key={movement.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    {getMovementBadge(movement)}
                    <span className="text-xs text-muted-foreground">
                      {format(
                        movement.createdAt instanceof Date ? movement.createdAt : new Date(movement.createdAt),
                        'dd/MM/yyyy HH:mm'
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Qté initiale: </span>
                      <span className="font-mono">{movement.quantityBefore ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Mouvement: </span>
                      <span className="font-mono">{Math.abs(movement.quantity)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Qté finale: </span>
                      <span className="font-mono">{movement.quantityAfter ?? '—'}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div>{getOperationLabel(movement)}</div>
                    <span className="text-muted-foreground">{movement.userName || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

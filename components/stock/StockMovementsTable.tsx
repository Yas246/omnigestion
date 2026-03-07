'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { StockMovement } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowUp, ArrowDown, ArrowRight, XCircle, Filter } from 'lucide-react';

interface StockMovementsTableProps {
  movements: Array<StockMovement & { productName?: string; warehouseName?: string; toWarehouseName?: string }>;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export function StockMovementsTable({
  movements,
  loading = false,
  hasMore = false,
  onLoadMore,
}: StockMovementsTableProps) {
  const [selectedType, setSelectedType] = useState<'all' | 'in' | 'out' | 'loss' | 'transfer'>('all');

  // Filtrer les mouvements par type
  const filteredMovements = selectedType === 'all'
    ? movements
    : movements.filter(m => m.type === selectedType);

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'in':
        return <ArrowUp className="h-4 w-4 text-green-600" />;
      case 'out':
      case 'loss':
        return <ArrowDown className="h-4 w-4 text-red-600" />;
      case 'transfer':
        return <ArrowRight className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getMovementBadge = (movement: StockMovement & { warehouseName?: string; toWarehouseName?: string }) => {
    switch (movement.type) {
      case 'in':
        return (
          <Badge variant="default" className="gap-1">
            <ArrowUp className="h-3 w-3" />
            Entrée
          </Badge>
        );
      case 'out':
        return (
          <Badge variant="destructive" className="gap-1">
            <ArrowDown className="h-3 w-3" />
            Sortie
          </Badge>
        );
      case 'loss':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Perte
          </Badge>
        );
      case 'transfer':
        const isNegative = movement.quantity < 0;
        return (
          <Badge variant={isNegative ? "outline" : "default"} className="gap-1">
            <ArrowRight className="h-3 w-3" />
            {isNegative ? 'Transfert (sortie)' : 'Transfert (entrée)'}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{movement.type}</Badge>;
    }
  };

  const formatQuantity = (quantity: number) => {
    return quantity > 0 ? `+${quantity}` : quantity;
  };

  return (
    <div className="space-y-4">
      {/* Filtre par type de mouvement */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select onValueChange={(value) => setSelectedType(value as any)} value={selectedType}>
          <SelectTrigger className="w-55">
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="in">
              <div className="flex items-center gap-2">
                <ArrowUp className="h-3 w-3 text-green-600" />
                Entrées
              </div>
            </SelectItem>
            <SelectItem value="out">
              <div className="flex items-center gap-2">
                <ArrowDown className="h-3 w-3 text-red-600" />
                Sorties
              </div>
            </SelectItem>
            <SelectItem value="loss">
              <div className="flex items-center gap-2">
                <XCircle className="h-3 w-3 text-red-600" />
                Pertes
              </div>
            </SelectItem>
            <SelectItem value="transfer">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-3 w-3 text-blue-600" />
                Transferts
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Produit</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Dépôt</TableHead>
              <TableHead className="text-right">Quantité</TableHead>
              <TableHead>Raison</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && filteredMovements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : filteredMovements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <p className="text-sm text-muted-foreground">
                    {selectedType === 'all'
                      ? 'Aucun mouvement de stock enregistré'
                      : `Aucun mouvement de type "${selectedType}" trouvé`}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredMovements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="text-sm">
                    {format(new Date(movement.createdAt), 'PPP', { locale: fr })}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(movement.createdAt), 'HH:mm')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{movement.productName || 'Produit inconnu'}</span>
                  </TableCell>
                  <TableCell>
                    {getMovementBadge(movement)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{movement.warehouseName || 'Dépôt inconnu'}</span>
                      {movement.type === 'transfer' && movement.toWarehouseName && (
                        <span className="text-xs text-muted-foreground">
                          → {movement.toWarehouseName}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${
                    movement.quantity > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatQuantity(movement.quantity)}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {movement.reason || '-'}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {hasMore && onLoadMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? 'Chargement...' : 'Charger plus de mouvements'}
          </Button>
        </div>
      )}
    </div>
  );
}

import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, ArrowRight, XCircle } from 'lucide-react';
import type { StockMovement } from '@/types';

export function getMovementBadge(movement: StockMovement) {
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
    case 'transfer': {
      const isNegative = movement.quantity < 0;
      return (
        <Badge variant={isNegative ? 'outline' : 'default'} className="gap-1">
          <ArrowRight className="h-3 w-3" />
          {isNegative ? 'Transfert (sortie)' : 'Transfert (entrée)'}
        </Badge>
      );
    }
    default:
      return <Badge variant="secondary">{movement.type}</Badge>;
  }
}

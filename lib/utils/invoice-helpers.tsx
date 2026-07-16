import { Badge } from '@/components/ui/badge';

export function getInvoiceStatusBadge(status: string) {
  switch (status) {
    case 'draft':
      return <Badge variant="secondary">Brouillon</Badge>;
    case 'validated':
      return <Badge variant="info">Validée</Badge>;
    case 'paid':
      return <Badge variant="success">Payée</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">Annulée</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

import { Badge } from '@/components/ui/badge';

export function getInvoiceStatusBadge(status: string) {
  switch (status) {
    case 'draft':
      return <Badge variant="secondary">Brouillon</Badge>;
    case 'validated':
      return <Badge variant="outline" className="border-orange-500 text-orange-500">Validée</Badge>;
    case 'paid':
      return <Badge variant="default" className="bg-green-600">Payée</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">Annulée</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

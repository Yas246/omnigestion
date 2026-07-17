// Mapping canonique des statuts de crédit -> { label, variant }.
// Variants disponibles (cf. components/ui/badge.tsx) :
//   default, secondary, success, warning, info, destructive, outline, ghost, link

export interface StatusMeta {
  label: string;
  variant:
    | 'default'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'info'
    | 'destructive'
    | 'outline';
}

const CREDIT_STATUS_MAP: Record<string, StatusMeta> = {
  active: { label: 'En cours', variant: 'info' },
  partial: { label: 'En cours', variant: 'warning' },
  paid: { label: 'Payé', variant: 'success' },
  overdue: { label: 'En retard', variant: 'destructive' },
  cancelled: { label: 'Annulé', variant: 'destructive' },
};

export function getCreditStatusLabel(status: string): StatusMeta {
  return CREDIT_STATUS_MAP[status] ?? { label: status, variant: 'outline' };
}

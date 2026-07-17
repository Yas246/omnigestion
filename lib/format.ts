// Helpers de formatage monétaire centralisés.

export function formatMoney(amount: number, currency = 'FCFA'): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' ' + currency;
}

// Réexporté pour éviter de dupliquer l'ancien helper formatPrice (sans arrondi,
// sans symbole) qui est encore utilisé à plusieurs endroits.
export { formatPrice } from '@/lib/utils';

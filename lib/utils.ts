import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { getCurrency } from '@/lib/constants/currencies';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR').format(price);
}

/**
 * Formate un montant avec le libellé de la devise en suffixe.
 * ex: formatMoney(1250, 'MAD') → "1 250 Dhs" ; formatMoney(12.5, 'EUR') → "12,50 €"
 */
export function formatMoney(amount: number, currencyCode: string | undefined | null): string {
  const currency = getCurrency(currencyCode);
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: currency.decimals,
  }).format(amount);
  return `${formatted} ${currency.label}`;
}

export function toJsDate(value: Date | { toDate(): Date }): Date {
  return value instanceof Date ? value : value.toDate();
}

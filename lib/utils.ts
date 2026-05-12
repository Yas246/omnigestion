import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR').format(price);
}

export function toJsDate(value: Date | { toDate(): Date }): Date {
  return value instanceof Date ? value : value.toDate();
}

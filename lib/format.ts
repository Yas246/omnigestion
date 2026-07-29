// Helpers de formatage monétaire centralisés.

export function formatMoney(amount: number, currency = 'FCFA'): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' ' + currency;
}

// Réexporté pour éviter de dupliquer l'ancien helper formatPrice (sans arrondi,
// sans symbole) qui est encore utilisé à plusieurs endroits.
export { formatPrice } from '@/lib/utils';

// --- Groupement des livraisons par jour (historique livreur + ERP) ---

/** Clé de jour ISO (YYYY-MM-DD) à partir d'une date ISO ou null. */
export function dayKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Libellé lisible : "Aujourd'hui", "Hier", ou la date locale complète. */
export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return 'Date inconnue'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Date inconnue'
  const now = new Date()
  const sameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  if (sameDay(d, now)) return "Aujourd'hui"
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (sameDay(d, yest)) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** Groupe une liste d'items par jour, du plus récent au plus ancien.
 *  `dateFn` extrait la date ISO de chaque item (ex: (d) => d.deliveredAt). */
export function groupByDay<T>(
  items: T[],
  dateFn: (item: T) => string | null | undefined
): Array<{ key: string; label: string; items: T[] }> {
  const groups = new Map<string, T[]>()
  for (const it of items) {
    const key = dayKey(dateFn(it))
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(it)
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => ({ key, label: dayLabel(`${key}T00:00:00`), items: list }))
}

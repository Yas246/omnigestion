/**
 * Compiles a compact, AI-ready summary of the business over a period, from the
 * same React Query data the reports pages already use (invoices w/ items, client
 * credits + payments, products, cash registers + movements). Defensive: every
 * field is coerced with Number() and defaults to 0 so a missing/odd shape can't
 * break report generation.
 *
 * CA = encaissé (paid_amount + credit payments), consistent with the dashboard.
 * Stock & credits are point-in-time snapshots (not period-scoped).
 */
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfQuarter,
  endOfQuarter,
  startOfDay,
  endOfDay,
  format,
} from 'date-fns';
import { fr } from 'date-fns/locale';

export type PeriodType = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface PeriodRange {
  start: Date;
  end: Date;
  /** Relative label for the selector (e.g. "Ce mois"). */
  label: string;
  /** Concrete name for titling/filing (e.g. "juillet 2026") — stable over time. */
  name: string;
}

export function periodRange(period: PeriodType, customRange?: { from?: Date; to?: Date }): PeriodRange {
  const now = new Date();
  let start: Date;
  let end: Date = endOfDay(now);

  switch (period) {
    case 'today':
      start = startOfDay(now);
      break;
    case 'week':
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case 'month':
      start = startOfMonth(now);
      end = endOfMonth(now);
      break;
    case 'quarter':
      start = startOfQuarter(now);
      end = endOfQuarter(now);
      break;
    case 'year':
      start = startOfYear(now);
      end = endOfYear(now);
      break;
    case 'custom':
    default:
      if (customRange?.from) {
        start = startOfDay(customRange.from);
        end = customRange.to ? endOfDay(customRange.to) : endOfDay(customRange.from);
      } else {
        start = startOfMonth(now);
        end = endOfMonth(now);
      }
      break;
  }

  const label =
    period === 'today'
      ? "Aujourd'hui"
      : period === 'week'
        ? 'Cette semaine'
        : period === 'month'
          ? 'Ce mois'
          : period === 'quarter'
            ? 'Ce trimestre'
            : period === 'year'
              ? 'Cette année'
              : 'Période personnalisée';

  // Concrete, time-stable name for the report title + PDF filename.
  let name: string;
  switch (period) {
    case 'today':
      name = format(start, 'dd MMM yyyy', { locale: fr });
      break;
    case 'week':
      name = `${format(start, 'dd MMM', { locale: fr })} – ${format(end, 'dd MMM yyyy', { locale: fr })}`;
      break;
    case 'month':
      name = format(start, 'MMMM yyyy', { locale: fr }); // "juillet 2026"
      break;
    case 'quarter':
      name = `T${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`;
      break;
    case 'year':
      name = String(start.getFullYear());
      break;
    case 'custom':
    default:
      name = `${format(start, 'dd/MM/yyyy')} – ${format(end, 'dd/MM/yyyy')}`;
      break;
  }

  return { start, end, label, name };
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces',
  mobile: 'Mobile Money',
  bank: 'Banque',
  credit: 'Crédit',
  non_défini: 'Non défini',
};

export interface ReportSummary {
  periode: { label: string; name: string; debut: string; fin: string };
  devise: string;
  ventes: {
    caVenteHT: number;
    caEncaisse: number;
    encaisseCredit: number;
    nbFactures: number;
    panierMoyen: number;
    repartitionPaiement: Array<{ mode: string; montant: number }>;
    topProduits: Array<{ nom: string; quantite: number }>;
    topClients: Array<{ nom: string; ca: number }>;
  };
  rentabilite: { caVente: number; coutTotal: number; margeTotale: number; tauxMarge: number };
  stock: { nbProduitsActifs: number; valeurStock: number; ruptures: number; stockFaible: number };
  credits: { totalRestantDu: number; nbCreditsActifs: number };
  caisse: { soldeTotal: number; entrees: number; sorties: number };
}

export function compileReportSummary(opts: {
  period: PeriodType;
  customRange?: { from?: Date; to?: Date };
  invoices: any[];
  creditPayments?: any[];
  credits?: any[];
  products?: any[];
  cashMovements?: any[];
  cashRegisters?: any[];
  currency?: string;
}): ReportSummary {
  const { period, customRange, invoices, creditPayments = [], credits = [], products = [], cashMovements = [], cashRegisters = [], currency = 'FCFA' } = opts;
  const { start, end, label, name } = periodRange(period, customRange);

  const inPeriod = (d: any) => {
    const dt = new Date(d);
    return !isNaN(dt.getTime()) && dt >= start && dt <= end;
  };

  const inv = invoices.filter((i) => i.status !== 'cancelled' && inPeriod(i.date));
  const cp = creditPayments.filter((c) => inPeriod(c.createdAt));

  // Ventes — cash collecté sur la période (paidAmount des factures + paiements de
  // crédits). ATTENTION : ce n'est PAS le chiffre d'affaires. Les paiements de
  // crédits sont des remboursements de ventes souvent antérieures (ou de crédits
  // manuels sans aucune vente) -> caEncaisse peut très fortement différer du CA vendu.
  const paidFromInv = inv.reduce((s, i) => s + Number(i.paidAmount ?? 0), 0);
  const paidFromCredits = cp.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const caEncaisse = paidFromInv + paidFromCredits;
  const nbFactures = inv.length;

  const payMap: Record<string, number> = {};
  inv.forEach((i) => {
    const k = String(i.paymentMethod ?? 'non_défini');
    payMap[k] = (payMap[k] ?? 0) + Number(i.paidAmount ?? 0);
  });
  cp.forEach((c) => {
    const k = String(c.paymentMode ?? 'non_défini');
    payMap[k] = (payMap[k] ?? 0) + Number(c.amount ?? 0);
  });
  const repartitionPaiement = Object.entries(payMap)
    .map(([mode, montant]) => ({ mode: PAYMENT_LABELS[mode] ?? mode, montant }))
    .sort((a, b) => b.montant - a.montant);

  // Ventes — CA vendu HT (valeur réelle des ventes facturées du mois) + coût + tops.
  // C'est ce caVente HT qui est le CHIFFRE D'AFFAIRES (base facturation), pas caEncaisse.
  const qtyByProduct: Record<string, number> = {};
  const venteParClient: Record<string, number> = {};
  let caVente = 0;
  let coutTotal = 0;
  inv.forEach((i) => {
    let venteInvoice = 0;
    (i.items ?? []).forEach((it: any) => {
      const q = Number(it.quantity ?? 0);
      const pu = Number(it.unitPrice ?? it.price ?? 0);
      const pa = Number(it.purchasePrice ?? 0);
      venteInvoice += pu * q;
      coutTotal += pa * q;
      qtyByProduct[it.productName ?? 'Produit'] = (qtyByProduct[it.productName ?? 'Produit'] ?? 0) + q;
    });
    caVente += venteInvoice;
    // Top clients sur la valeur de vente (et non sur le cash paidAmount, qui
    // ignore les ventes à crédit et attribue à tort les remboursements de crédits).
    const client = i.clientName ?? 'Client de passage';
    venteParClient[client] = (venteParClient[client] ?? 0) + venteInvoice;
  });
  // Panier moyen sur le CA vendu HT (et non sur le cash collecté).
  const panierMoyen = nbFactures > 0 ? caVente / nbFactures : 0;
  const topProduits = Object.entries(qtyByProduct)
    .map(([nom, quantite]) => ({ nom, quantite }))
    .sort((a, b) => b.quantite - a.quantite)
    .slice(0, 8);
  const topClients = Object.entries(venteParClient)
    .map(([nom, ca]) => ({ nom, ca }))
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 8);

  const margeTotale = caVente - coutTotal;
  const tauxMarge = caVente > 0 ? (margeTotale / caVente) * 100 : 0;

  // Stock (snapshot)
  const actifs = (products ?? []).filter((p) => p.isActive !== false && !p.deletedAt);
  const valeurStock = actifs.reduce((s, p) => s + Number(p.currentStock ?? 0) * Number(p.purchasePrice ?? 0), 0);
  const ruptures = actifs.filter((p) => p.status === 'out').length;
  const stockFaible = actifs.filter((p) => p.status === 'low').length;

  // Crédits (snapshot)
  const creditsActifs = (credits ?? []).filter((c) => c.status === 'active' || c.status === 'partial');
  const totalRestantDu = creditsActifs.reduce((s, c) => s + Number(c.remainingAmount ?? 0), 0);

  // Caisse
  const soldeTotal = (cashRegisters ?? []).reduce((s, r) => s + Number(r.currentBalance ?? 0), 0);
  const mov = (cashMovements ?? []).filter((m) => inPeriod(m.createdAt));
  const entrees = mov.filter((m) => m.type === 'in').reduce((s, m) => s + Number(m.amount ?? 0), 0);
  const sorties = mov.filter((m) => m.type === 'out').reduce((s, m) => s + Number(m.amount ?? 0), 0);

  return {
    periode: { label, name, debut: format(start, 'dd/MM/yyyy'), fin: format(end, 'dd/MM/yyyy') },
    devise: currency,
    ventes: { caVenteHT: caVente, caEncaisse, encaisseCredit: paidFromCredits, nbFactures, panierMoyen, repartitionPaiement, topProduits, topClients },
    rentabilite: { caVente, coutTotal, margeTotale, tauxMarge },
    stock: { nbProduitsActifs: actifs.length, valeurStock, ruptures, stockFaible },
    credits: { totalRestantDu, nbCreditsActifs: creditsActifs.length },
    caisse: { soldeTotal, entrees, sorties },
  };
}

/**
 * Calcul de bénéfice selon l'approche "récupération des coûts d'abord".
 *
 * Principe : on ne compte du bénéfice que lorsque les coûts d'achat sont entièrement récupérés.
 * 1. Le paidAmount de la facture est d'abord appliqué aux coûts
 * 2. Puis chaque paiement crédit (chronologiquement) est appliqué
 * 3. Le bénéfice n'est compté que quand les coûts sont dépassés
 */

interface InvoiceItemInput {
  unitPrice: number;
  purchasePrice?: number;
  quantity: number;
}

interface CreditPaymentInput {
  amount: number;
  createdAt: Date;
}

export interface RecognizedProfitEntry {
  amount: number;
  date: Date;
}

/**
 * Calcule tous les bénéfices reconnus pour une facture donnée.
 * Retourne une liste d'entrées (montant + date) correspondant aux moments
 * où du bénéfice a été reconnu.
 */
export function getRecognizedProfits(
  invoiceItems: InvoiceItemInput[],
  invoicePaidAmount: number,
  invoiceDate: Date,
  creditPayments: CreditPaymentInput[]
): RecognizedProfitEntry[] {
  const profits: RecognizedProfitEntry[] = [];

  const totalCost = invoiceItems.reduce(
    (sum, item) => sum + ((item.purchasePrice || 0) * item.quantity),
    0
  );

  // Si pas de coût (purchasePrice non renseigné), tout est bénéfice immédiatement
  if (totalCost === 0) {
    const totalMargin = invoiceItems.reduce(
      (sum, item) => sum + (item.unitPrice * item.quantity),
      0
    );
    if (totalMargin > 0) {
      profits.push({ amount: totalMargin, date: invoiceDate });
    }
    return profits;
  }

  let costRecovered = invoicePaidAmount;

  // Bénéfice du paidAmount (si les coûts sont dépassés à la création)
  if (costRecovered > totalCost) {
    profits.push({ amount: costRecovered - totalCost, date: invoiceDate });
  }

  // Traiter les paiements crédit chronologiquement
  const sortedPayments = [...creditPayments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const payment of sortedPayments) {
    if (costRecovered >= totalCost) {
      // Coûts entièrement récupérés → tout est bénéfice
      profits.push({ amount: payment.amount, date: payment.createdAt });
    } else {
      // Encore en train de récupérer les coûts
      const stillNeeded = totalCost - costRecovered;
      const profitFromPayment = Math.max(0, payment.amount - stillNeeded);
      if (profitFromPayment > 0) {
        profits.push({ amount: profitFromPayment, date: payment.createdAt });
      }
    }
    costRecovered += payment.amount;
  }

  return profits;
}

/**
 * Calcule le bénéfice reconnu pour une date cible.
 * Itère sur les bénéfices reconnus d'une facture et ne retourne que ceux du jour cible.
 */
export function getRecognizedProfitForDate(
  invoiceItems: InvoiceItemInput[],
  invoicePaidAmount: number,
  invoiceDate: Date,
  creditPayments: CreditPaymentInput[],
  targetDate: Date
): number {
  const allProfits = getRecognizedProfits(invoiceItems, invoicePaidAmount, invoiceDate, creditPayments);

  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  return allProfits
    .filter(p => {
      const d = new Date(p.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === target.getTime();
    })
    .reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Construit un map invoiceId → creditPayments à partir des crédits et paiements.
 */
export function buildInvoicePaymentsMap(
  credits: Array<{ id: string; invoiceId?: string }>,
  payments: Array<{ creditId: string; amount: number; createdAt: Date }>
): Map<string, CreditPaymentInput[]> {
  const creditToInvoice = new Map<string, string>();
  credits.forEach(credit => {
    if (credit.invoiceId) {
      creditToInvoice.set(credit.id, credit.invoiceId);
    }
  });

  const invoicePaymentsMap = new Map<string, CreditPaymentInput[]>();
  payments.forEach(cp => {
    const invoiceId = creditToInvoice.get(cp.creditId);
    if (invoiceId) {
      const existing = invoicePaymentsMap.get(invoiceId) || [];
      existing.push({ amount: cp.amount, createdAt: cp.createdAt });
      invoicePaymentsMap.set(invoiceId, existing);
    }
  });

  return invoicePaymentsMap;
}

import { z } from 'zod';

export const invoiceItemSchema = z.object({
  productId: z.string().min(1, 'Le produit est requis'),
  productName: z.string().min(1, 'Le nom du produit est requis'),
  quantity: z.number().int().min(1, 'La quantité doit être d\'au moins 1'),
  unit: z.string().min(1, 'L\'unité est requise'),
  unitPrice: z.number().min(0, 'Le prix unitaire doit être positif'),
  purchasePrice: z.number().optional(),
});

// Type inféré pour les items
export type InvoiceItemFormData = z.infer<typeof invoiceItemSchema>;

// Schéma du formulaire de facture
export const invoiceSchema = z.object({
  // Client (champ de recherche local, pas stocké)
  clientSearch: z.string().optional(),
  // Sélection du client (optionnel)
  clientId: z.string().optional(),
  // Montants
  taxRate: z.number().min(0),
  discount: z.number().min(0),
  paidAmount: z.number().min(0),
  // Mode de paiement
  paymentMethod: z.enum(['cash', 'bank', 'mobile', 'credit']).optional(),
  // Date d'échéance
  dueDate: z.date().optional(),
  // Notes
  notes: z.string().optional(),
  // Mobile Money
  mobileNumber: z.string().optional(),
  // Paiement bancaire
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  transactionNumber: z.string().optional(),
}).refine((data) => {
  // Validation conditionnelle selon le mode de paiement
  if (data.paymentMethod === 'mobile') {
    return !!data.mobileNumber && data.mobileNumber.length >= 8;
  }
  if (data.paymentMethod === 'bank') {
    return !!data.bankName && !!data.accountNumber;
  }
  return true;
}, {
  message: 'Champs manquants pour le mode de paiement sélectionné',
  path: ['paymentMethod'],
});

// Type inféré pour le formulaire
export type InvoiceFormData = z.infer<typeof invoiceSchema>;

import { z } from 'zod';

// Liste des unités de mesure prédéfinies
export const PRODUCT_UNITS = [
  'pièce',
  'kg',
  'litre',
  'tonne',
  'gramme',
  'centilitre',
  'mètre',
  'mètre cube',
  'rouleau',
  'plaston',
  'bloc',
  'paquet',
  'douzaine',
  'balle',
  'sac',
  'sachet',
] as const;

export const productSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  description: z.string().optional(),
  purchasePrice: z.number().min(0, 'Le prix d\'achat doit être positif'),
  retailPrice: z.number().min(0, 'Le prix de vente doit être positif'),
  wholesalePrice: z.number().min(0, 'Le prix de gros doit être positif'),
  wholesaleThreshold: z.number().int().min(1, 'Le seuil de gros doit être d\'au moins 1'),
  currentStock: z.number().int().min(0, 'Le stock ne peut pas être négatif'),
  alertThreshold: z.number().int().min(0, 'Le seuil d\'alerte doit être positif'),
  unit: z.enum(PRODUCT_UNITS),
  isActive: z.boolean(),
}).refine(
  (data) => data.retailPrice >= data.purchasePrice,
  {
    message: 'Le prix de vente ne peut pas être inférieur au prix d\'achat',
    path: ['retailPrice'],
  }
).refine(
  (data) => data.wholesalePrice >= data.purchasePrice,
  {
    message: 'Le prix de gros ne peut pas être inférieur au prix d\'achat',
    path: ['wholesalePrice'],
  }
);

export type ProductFormData = z.infer<typeof productSchema>;

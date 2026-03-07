import { z } from 'zod';

export const clientSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  code: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  address: z.string().optional(),
  isActive: z.boolean(),
});

export type ClientFormData = z.infer<typeof clientSchema>;

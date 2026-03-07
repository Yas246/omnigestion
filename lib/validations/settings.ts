import { z } from 'zod';

// ==================== ENTREPRISE ====================

export const companySchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  slogan: z.string().optional(),
  description: z.string().optional(),
  taxId: z.string().optional(),
  businessRegister: z.string().optional(),
  ifu: z.string().optional(), // Identifiant Fiscal Unique
  rccm: z.string().optional(), // Registre du Commerce et des Crédits Mobiliers
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  website: z.string().url('URL invalide').optional().or(z.literal('')),
  currency: z.string(),
  invoiceFooter: z.string().optional(),
});

export type CompanyFormData = z.infer<typeof companySchema>;

// ==================== FACTURATION ====================

export const invoiceSettingsSchema = z.object({
  prefix: z.string(),
  nextNumber: z.number().int().min(1),
  showTax: z.boolean(),
  showUnitPrice: z.boolean(),
  defaultTerms: z.string().optional(),
  template: z.enum(['standard', 'detailed']),
});

export type InvoiceSettingsFormData = z.infer<typeof invoiceSettingsSchema>;

// ==================== STOCK ====================

export const stockSettingsSchema = z.object({
  defaultAlertThreshold: z.number().int().min(0),
  defaultWarehouseId: z.string().optional(),
});

export type StockSettingsFormData = z.infer<typeof stockSettingsSchema>;

// ==================== DÉPÔT ====================

export const warehouseSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  code: z.string().optional(),
  address: z.string().optional(),
  isMain: z.boolean(),
  isActive: z.boolean(),
});

export type WarehouseFormData = z.infer<typeof warehouseSchema>;

// ==================== SAUVEGARDE ====================

export const backupSettingsSchema = z.object({
  autoBackupEnabled: z.boolean(),
});

export type BackupSettingsFormData = z.infer<typeof backupSettingsSchema>;

// ==================== SYSTÈME ====================

export const systemSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  language: z.enum(['fr', 'en']),
});

export type SystemSettingsFormData = z.infer<typeof systemSettingsSchema>;

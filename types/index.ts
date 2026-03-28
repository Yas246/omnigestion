// Types de base pour Omnigestion

// ==================== UTILITAIRES ====================

export type UserRole = 'admin' | 'employee';

export type PaymentMode = 'cash' | 'card' | 'transfer' | 'mobile' | 'check' | 'bank';

export type CreditStatus = 'active' | 'partial' | 'paid' | 'overdue' | 'cancelled';

export type MovementType = 'in' | 'out' | 'transfer';

// ==================== USER & COMPANY ====================

export interface Permission {
  module: string;
  actions: string[];
}

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
}

export interface User {
  id: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  phone?: string;
  role: UserRole;
  companyIds: string[]; // Liste des entreprises accessibles
  currentCompanyId: string; // Entreprise actuellement sélectionnée
  permissions?: Permission[]; // Pour les employés avec permissions granulaires
  preferences?: UserPreferences; // Préférences personnelles de l'utilisateur
  fcmTokens?: FCMToken[]; // Tokens FCM pour les notifications push
  createdAt: Date;
  updatedAt: Date;
}

export interface Company {
  id: string;
  name: string;
  slogan?: string;
  description?: string;
  businessSector?: 'commerce' | 'commerce_and_services';

  // Identifiants fiscaux
  taxId?: string;
  businessRegister?: string;
  ifu?: string; // Identifiant Fiscal Unique (Afrique de l'Ouest)
  rccm?: string; // Registre du Commerce et des Crédits Mobiliers

  // Coordonnées
  address?: string;
  phone?: string;
  email?: string;
  website?: string;

  // Configuration
  currency: string; // ex: 'FCFA', 'EUR', 'USD'
  logoUrl?: string;

  // Footer facturation
  invoiceFooter?: string;

  createdAt: Date;
  updatedAt: Date;
}

// ==================== FCM NOTIFICATIONS ====================

export interface FCMToken {
  token: string;
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
    lastSeen?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationType = 'new_sale' | 'stock_alert' | 'stock_out' | 'test';

export interface PushNotification {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  companyId: string;
  targetRole: 'admin' | 'all';
}

// ==================== CLIENT & SUPPLIER ====================

export interface Client {
  id: string;
  companyId: string;

  // Informations de base
  name: string;
  code?: string; // Code client unique
  phone?: string;
  email?: string;
  address?: string;

  // Statistiques
  totalPurchases: number;
  totalAmount: number;
  currentCredit: number;
  lastPurchaseDate?: Date;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface Supplier {
  id: string;
  companyId: string;

  name: string;
  code?: string;
  phone?: string;
  email?: string;
  address?: string;

  totalPurchases: number;
  totalAmount: number;
  currentDebt: number;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// ==================== PRODUCT ====================

export type ProductStatus = 'ok' | 'low' | 'out';

export interface Product {
  id: string;
  companyId: string;

  name: string;
  code?: string; // Code produit / barcode
  category?: string;
  description?: string;

  // Prix
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  wholesaleThreshold: number; // Qté min pour prix gros

  // Stock
  currentStock: number;
  alertThreshold: number;
  status: ProductStatus; // Statut calculé du stock

  // Dépôt par défaut
  warehouseId?: string;

  // Unité
  unit?: string; // ex: 'pièce', 'kg', 'litre'

  isActive: boolean;

  // Champs calculés (non stockés dans Firestore)
  warehouseQuantities?: Array<{
    warehouseId: string;
    warehouseName: string;
    quantity: number;
  }>;
  displayQuantity?: number;

  createdAt: Date | any;
  updatedAt: Date | any;
}

// Stock par dépôt
export interface ProductStockLocation {
  productId: string;
  warehouseId: string;
  quantity: number;
  alertThreshold: number;
  updatedAt: Date;
}

// Mouvement de stock
export interface StockMovement {
  id: string;
  companyId: string;
  productId: string;
  warehouseId: string;

  type: 'in' | 'out' | 'transfer' | 'loss';
  quantity: number;
  reason?: string;

  referenceId?: string; // ID facture, approvisionnement, etc.
  referenceType?: string; // 'invoice', 'restock', 'adjustment', etc.

  userId: string;
  createdAt: Date;
}

// ==================== WAREHOUSE (DÉPÔT) ====================

export interface Warehouse {
  id: string;
  companyId: string;

  name: string;
  code?: string;
  address?: string;
  isMain: boolean;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// Alerte de stock
export interface StockAlert {
  id: string;
  companyId: string;
  productId: string;
  warehouseId: string;

  type: 'critical' | 'warning';
  currentStock: number;
  threshold: number;

  isResolved: boolean;
  createdAt: Date;
}

// ==================== INVOICE (VENTE) ====================

export type InvoiceStatus = 'draft' | 'validated' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'bank' | 'mobile' | 'credit';

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  productCode?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  purchasePrice?: number; // Pour validation anti-perte
  total: number;
  isWholesale: boolean; // Prix gros ou détail
}

export interface Invoice {
  id: string;
  companyId: string;

  // Numérotation
  invoiceNumber: string;

  // Client
  clientId?: string;
  clientName?: string;

  // Dates
  date: Date;
  dueDate?: Date;

  // Items
  items: InvoiceItem[];

  // Montants
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;

  // Paiement
  status: InvoiceStatus;
  paymentMethod?: PaymentMethod;
  paidAmount: number;
  remainingAmount: number;

  // Détails paiement
  mobileNumber?: string; // Pour Mobile Money
  bankName?: string; // Pour paiement bancaire
  accountNumber?: string; // Pour paiement bancaire
  transactionNumber?: string; // Pour paiement bancaire

  // Utilisateur
  userId: string;
  userName?: string;

  // Références
  referenceType?: string; // 'sale', 'credit', etc.
  referenceId?: string;

  // Validation
  validatedAt?: Date;
  validatedBy?: string;
  paidAt?: Date;
  paidBy?: string;

  // Notes
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

// ==================== CASH REGISTER ====================

export interface CashRegister {
  id: string;
  companyId: string;

  name: string;
  code?: string;
  isMain: boolean;

  isActive: boolean;

  currentBalance: number;  // Solde actuel de la caisse

  createdAt: Date;
  updatedAt: Date;
}

export interface CashMovement {
  id: string;
  companyId: string;
  cashRegisterId: string;

  type: 'in' | 'out' | 'transfer';
  amount: number;
  category: string; // 'sale', 'expense', 'supplier', 'transfer', 'adjustment', etc.

  description?: string;
  referenceId?: string;
  referenceType?: string;

  // Transfert
  targetCashRegisterId?: string;
  sourceCashRegisterId?: string;

  // Pièce jointe
  attachmentUrl?: string;

  userId: string;
  createdAt: Date;
}

// ==================== CREDIT CLIENT ====================

export interface ClientCredit {
  id: string;
  companyId: string;

  clientId?: string;
  clientName: string;

  invoiceId?: string;
  invoiceNumber?: string;

  amount: number;
  amountPaid: number;
  remainingAmount: number;

  status: CreditStatus;

  date: Date;
  dueDate?: Date;

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface ClientCreditPayment {
  id: string;
  creditId: string;

  amount: number;
  paymentMode: PaymentMode;
  notes?: string;

  userId: string;
  createdAt: Date;
}

// ==================== CREDIT FOURNISSEUR ====================

export interface SupplierCredit {
  id: string;
  companyId: string;

  supplierId?: string;
  supplierName: string;

  invoiceId?: string;
  invoiceNumber?: string;

  amount: number;
  amountPaid: number;
  remainingAmount: number;

  status: CreditStatus;

  date: Date;
  dueDate?: Date;

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierCreditPayment {
  id: string;
  creditId: string;

  amount: number;
  paymentMode: PaymentMode;
  notes?: string;

  userId: string;
  createdAt: Date;
}

// ==================== PURCHASES ====================

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface Purchase {
  id: string;
  companyId: string;
  supplierId: string;
  supplierName: string;
  purchaseNumber: string;
  items: PurchaseItem[];
  total: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'paid' | 'active' | 'partial';
  paymentMethod: 'cash' | 'bank' | 'mobile' | 'credit';
  notes?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== AUDIT LOG ====================

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'export'
  | 'import'
  | 'backup'
  | 'restore';

export type AuditEntity =
  | 'company'
  | 'user'
  | 'client'
  | 'supplier'
  | 'product'
  | 'invoice'
  | 'stock_movement'
  | 'cash_movement'
  | 'client_credit'
  | 'supplier_credit'
  | 'warehouse'
  | 'settings';

export interface AuditLog {
  id: string;
  companyId: string;

  action: AuditAction;
  entityType: AuditEntity;
  entityId?: string;

  description: string;
  metadata?: Record<string, any>;

  userId: string;
  userName?: string;

  // Info technique
  ipAddress?: string;
  userAgent?: string;

  createdAt: Date;
}

// ==================== DAILY STATS ====================

export interface DailyStats {
  id: string; // YYYY-MM-DD
  companyId: string;
  date: Date;

  // Ventes
  invoiceCount: number;
  revenue: number;
  profit: number;
  discount: number;

  // Paiements
  cashRevenue: number;
  cardRevenue: number;
  transferRevenue: number;
  mobileRevenue: number;

  // Crédits
  newCredits: number;
  creditsRepaid: number;

  updatedAt: Date;
}

// ==================== SETTINGS ====================

export interface InvoiceSettings {
  prefix: string;
  nextNumber: number;
  showTax: boolean;
  showUnitPrice: boolean;
  defaultTaxRate?: number;
  defaultTerms?: string;
  template: 'standard' | 'detailed';
}

export interface StockSettings {
  defaultAlertThreshold: number;
  defaultWarehouseId?: string;
}

export interface BackupSettings {
  autoBackupEnabled: boolean;
  lastBackupDate?: Date;
}

export interface SystemSettings {
  theme: 'light' | 'dark' | 'system';
  language: 'fr' | 'en';
}

export interface Settings {
  companyId: string;

  invoice?: InvoiceSettings;
  stock?: StockSettings;
  backup?: BackupSettings;
  system?: SystemSettings;

  updatedAt: Date;
}

// ==================== HELPERS ====================

export type WithId<T> = T & { id: string };

export interface DocumentData {
  [key: string]: any;
}

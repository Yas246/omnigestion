export type InvoiceStatus = 'draft' | 'validated' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'transfer' | 'mobile' | 'card' | 'credit';

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  purchasePrice?: number; // Pour validation anti-perte
}

export interface Invoice {
  id: string;
  companyId: string;
  clientId?: string;
  clientName?: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  paymentMethod?: PaymentMethod;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: Date;
  notes?: string;
  referenceType?: string; // 'sale', 'credit', etc.
  referenceId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  validatedAt?: Date;
  validatedBy?: string;
  paidAt?: Date;
  paidBy?: string;
}

export interface InvoiceFormData {
  clientId?: string;
  items: Omit<InvoiceItem, 'id' | 'total'>[];
  taxRate: number;
  discount: number;
  paymentMethod?: PaymentMethod;
  paidAmount: number;
  dueDate?: Date;
  notes?: string;
}

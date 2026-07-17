'use client';

/**
 * Invoices — API-backed.
 *  - useInvoicesRealtime() -> { invoices, isLoading }
 *  - useInvoices()         -> createInvoice / updateInvoice / deleteInvoice(cancel)
 *                             + checkStockBeforeInvoice / executeStockTransfers
 *                               (the "transfer-to-complete" UX: if the sale depot
 *                               lacks stock, let the user pick a source depot to
 *                               transfer from before the sale — backend
 *                               /stock/transfer is atomic; InvoiceService rechecks
 *                               availability at sale time, so a race fails safe 422).
 *                             + fetchInvoice (full invoice WITH items, for edit).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Invoice, InvoiceItemInput, Product } from '@/types';

interface InvoiceDto {
  id: number;
  companyId: number;
  invoiceNumber: string;
  clientId: number | null;
  clientName: string | null;
  saleDate: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  status: string;
  paymentMethod: string | null;
  paidAmount: number;
  remainingAmount: number;
  userId: number | null;
  userName: string | null;
  notes: string | null;
  mobileNumber: string | null;
  bankName: string | null;
  accountNumber: string | null;
  transactionNumber: string | null;
  createdAt: string;
  updatedAt: string | null;
  items?: any[];
}

function mapInvoice(i: InvoiceDto): Invoice {
  return {
    id: String(i.id),
    companyId: String(i.companyId),
    invoiceNumber: i.invoiceNumber,
    clientId: i.clientId ? String(i.clientId) : undefined,
    clientName: i.clientName ?? undefined,
    date: new Date(i.saleDate),
    items: (i.items ?? []).map((it: any) => ({
      productId: String(it.productId),
      productName: it.productName,
      productCode: it.productCode,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      total: Number(it.total),
      purchasePrice: Number(it.purchasePrice ?? 0),
      unit: it.unit,
      isWholesale: it.isWholesale,
    })),
    subtotal: Number(i.subtotal),
    taxRate: i.taxRate,
    taxAmount: Number(i.taxAmount),
    discount: Number(i.discount),
    total: Number(i.total),
    status: i.status as any,
    paymentMethod: (i.paymentMethod as any) ?? undefined,
    paidAmount: Number(i.paidAmount),
    remainingAmount: Number(i.remainingAmount),
    userId: i.userId ? String(i.userId) : '',
    userName: i.userName ?? undefined,
    notes: i.notes ?? undefined,
    mobileNumber: i.mobileNumber ?? undefined,
    bankName: i.bankName ?? undefined,
    accountNumber: i.accountNumber ?? undefined,
    transactionNumber: i.transactionNumber ?? undefined,
    createdAt: new Date(i.createdAt),
    updatedAt: i.updatedAt ? new Date(i.updatedAt) : new Date(),
  } as Invoice;
}

export function useInvoicesRealtime() {
  const q = useQuery({
    queryKey: ['invoices'] as const,
    queryFn: async () => {
      const res = await api.get<{ data: InvoiceDto[] } | InvoiceDto[]>('/invoices?limit=200');
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return (arr as InvoiceDto[]).map(mapInvoice);
    },
  });
  return { invoices: q.data ?? [], isLoading: q.isLoading, error: q.error as Error | null };
}

/** Shape consumed by <StockTransferModal>. */
export interface ProductNeedingTransfer {
  productId: string;
  productName: string;
  requiredQuantity: number;
  availableInPrimary: number;
  missingQuantity: number;
  availableInOtherWarehouses: Array<{
    warehouseId: string;
    warehouseName: string;
    availableQuantity: number;
  }>;
}

export function useInvoices() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['invoices'] });
    qc.invalidateQueries({ queryKey: ['client-credits'] });
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['cash-registers'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => api.post('/invoices', data),
    onSuccess: invalidate,
  });
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/invoices/${id}/cancel`),
    onSuccess: invalidate,
  });
  const updateMutation = useMutation({
    mutationFn: async (p: { id: string; data: any }) => api.put(`/invoices/${p.id}`, p.data),
    onSuccess: invalidate,
  });

  return {
    createInvoice: (data: any) =>
      createMutation.mutateAsync({
        ...data,
        clientId: data.clientId ? Number(data.clientId) : undefined,
        warehouseId: data.warehouseId ? Number(data.warehouseId) : undefined,
        items: (data.items || []).map((it: any) => ({
          productId: Number(it.productId),
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          isWholesale: it.isWholesale,
        })),
      }),
    updateInvoice: (id: string, data: any) =>
      updateMutation.mutateAsync({
        id,
        data: {
          ...data,
          clientId: data.clientId ? Number(data.clientId) : undefined,
          items: (data.items || []).map((it: any) => ({
            productId: Number(it.productId),
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            isWholesale: it.isWholesale,
          })),
        },
      }),
    deleteInvoice: (id: string) => cancelMutation.mutateAsync(id),

    /** Full invoice WITH items (for edit mode). */
    fetchInvoice: async (id: string): Promise<Invoice> => {
      const res = await api.get<InvoiceDto>(`/invoices/${id}`);
      return mapInvoice(res);
    },

    /**
     * Pre-check: for each item, is there enough stock in the sale warehouse?
     * Returns the items in deficit + candidate source depots (other depots
     * holding stock), shaped for <StockTransferModal>.
     *
     * The caller must pass the products array (the sales page already has it
     * loaded via useProductsRealtime, cached by React Query). We no longer
     * refetch /products here.
     */
    checkStockBeforeInvoice: async (
      items: Array<{ productId: string; quantity: number }>,
      warehouseId: string | null | undefined,
      products: Product[]
    ): Promise<{ productsNeedingTransfer: ProductNeedingTransfer[] }> => {
      if (!items?.length) return { productsNeedingTransfer: [] };
      const byId = new Map(products.map((p) => [String(p.id), p]));

      const out: ProductNeedingTransfer[] = [];
      for (const item of items) {
        const pid = String(item.productId);
        const p = byId.get(pid);
        if (!p) continue;
        const wq = p.warehouseQuantities ?? [];
        const availableInPrimary =
          wq.find((q) => q.warehouseId === String(warehouseId))?.quantity ?? 0;
        if (availableInPrimary >= item.quantity) continue;
        const missing = item.quantity - availableInPrimary;
        const other = wq
          .filter((q) => q.warehouseId !== String(warehouseId) && Number(q.quantity) > 0)
          .map((q) => ({
            warehouseId: q.warehouseId,
            warehouseName: q.warehouseName,
            availableQuantity: Number(q.quantity),
          }))
          .sort((a, b) => b.availableQuantity - a.availableQuantity);
        out.push({
          productId: pid,
          productName: p.name,
          requiredQuantity: item.quantity,
          availableInPrimary,
          missingQuantity: missing,
          availableInOtherWarehouses: other,
        });
      }
      return { productsNeedingTransfer: out };
    },

    /** Execute the user-chosen transfers (magasin → boutique), then invalidate. */
    executeStockTransfers: async (
      transfers: Array<{ productId: string; fromWarehouseId: string; quantity: number }>,
      toWarehouseId?: string | null
    ) => {
      if (!toWarehouseId) throw new Error('Aucun dépôt de destination configuré');
      for (const t of transfers) {
        await api.post('/stock/transfer', {
          productId: Number(t.productId),
          fromWarehouseId: Number(t.fromWarehouseId),
          toWarehouseId: Number(toWarehouseId),
          quantity: Number(t.quantity),
        });
      }
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
    },
  };
}

export type { InvoiceItemInput };

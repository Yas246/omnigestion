'use client';

/**
 * Purchases — API-backed.
 *  - usePurchasesRealtime() -> { purchases, isLoading }
 *  - usePurchases()         -> { createPurchase }
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Purchase } from '@/types';

interface PurchaseDto {
  id: number;
  companyId: number;
  purchaseNumber: string;
  supplierId: number | null;
  supplierName: string | null;
  purchaseDate: string;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

function mapPurchase(p: PurchaseDto): Purchase {
  return {
    id: String(p.id),
    companyId: String(p.companyId),
    purchaseNumber: p.purchaseNumber,
    supplierId: p.supplierId ? String(p.supplierId) : undefined,
    supplierName: p.supplierName ?? undefined,
    items: [],
    total: p.total,
    paidAmount: p.paidAmount,
    remainingAmount: p.remainingAmount,
    status: p.status as any,
    paymentMethod: (p.paymentMethod as any) ?? undefined,
    notes: p.notes ?? undefined,
    userId: '',
    createdAt: new Date(p.createdAt),
    updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
  } as Purchase;
}

export function usePurchasesRealtime() {
  const q = useQuery({
    queryKey: ['purchases'] as const,
    queryFn: async () => {
      const res = await api.get<{ data: PurchaseDto[] } | PurchaseDto[]>('/purchases?limit=200');
      const arr = Array.isArray(res) ? res : ((res as any).data ?? []);
      return (arr as PurchaseDto[]).map(mapPurchase);
    },
  });
  return { purchases: q.data ?? [], isLoading: q.isLoading, error: q.error as Error | null };
}

export function usePurchases() {
  const qc = useQueryClient();
  const createMutation = useMutation({
    mutationFn: async (data: any) => api.post('/purchases', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.invalidateQueries({ queryKey: ['cash-registers'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  return {
    createPurchase: (data: any) => createMutation.mutateAsync(data),
  };
}

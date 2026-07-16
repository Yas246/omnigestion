'use client';

/**
 * Supplier credits + payments — API-backed.
 *  - useSupplierCreditsRealtime() -> { credits, isLoading }
 *  - useSupplierCredits()         -> { addPayment }
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { SupplierCredit } from '@/types';

interface SupplierCreditDto {
  id: number;
  companyId: number;
  supplierId: number | null;
  supplierName: string;
  purchaseId: number | null;
  purchaseNumber: string | null;
  amount: number;
  amountPaid: number;
  remainingAmount: number;
  status: string;
  date: string;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

function mapCredit(c: SupplierCreditDto): SupplierCredit {
  return {
    id: String(c.id),
    companyId: String(c.companyId),
    supplierId: c.supplierId ? String(c.supplierId) : undefined,
    supplierName: c.supplierName,
    invoiceId: c.purchaseId ? String(c.purchaseId) : undefined,
    invoiceNumber: c.purchaseNumber ?? undefined,
    amount: c.amount,
    amountPaid: c.amountPaid,
    remainingAmount: c.remainingAmount,
    status: c.status as any,
    date: new Date(c.date),
    dueDate: c.dueDate ? new Date(c.dueDate) : undefined,
    notes: c.notes ?? undefined,
    createdAt: new Date(c.createdAt),
    updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
  };
}

const KEY = ['supplier-credits'] as const;

export function useSupplierCreditsRealtime() {
  const q = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api.get<SupplierCreditDto[] | { data: SupplierCreditDto[] }>('/supplier-credits?limit=200');
      const arr = Array.isArray(res) ? res : ((res as any).data ?? []);
      return (arr as SupplierCreditDto[]).map(mapCredit);
    },
  });
  return { credits: q.data ?? [], isLoading: q.isLoading, error: q.error as Error | null };
}

export function useSupplierCredits() {
  const qc = useQueryClient();
  const payMutation = useMutation({
    mutationFn: async (p: { creditId: string; input: { amount: number; paymentMode?: string; notes?: string } }) =>
      api.post(`/supplier-credits/${p.creditId}/payments`, p.input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
  const createMutation = useMutation({
    mutationFn: async (data: any) => api.post('/supplier-credits', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });

  return {
    addPayment: (creditId: string, input: { amount: number; paymentMode?: string; notes?: string }) =>
      payMutation.mutateAsync({ creditId, input }),
    createCredit: (data: any) => createMutation.mutateAsync(data),
  };
}

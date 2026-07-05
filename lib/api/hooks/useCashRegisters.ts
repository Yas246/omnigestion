'use client';

/**
 * Cash registers — API-backed.
 *  - useCashRegistersRealtime() -> { cashRegisters, isLoading }
 *  - useCashRegisters()         -> { cashRegisters, createCashRegister, updateCashRegister, deleteCashRegister, transfer }
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { CashRegister } from '@/types';

interface CashRegisterDto {
  id: number;
  companyId: number;
  name: string;
  code: string | null;
  isMain: boolean;
  isActive: boolean;
  currentBalance: number;
  createdAt: string;
  updatedAt: string | null;
}

function mapRegister(r: CashRegisterDto): CashRegister {
  return {
    id: String(r.id),
    companyId: String(r.companyId),
    name: r.name,
    code: r.code ?? undefined,
    isMain: r.isMain,
    isActive: r.isActive,
    currentBalance: Number(r.currentBalance),
    createdAt: new Date(r.createdAt),
    updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
  };
}

const KEY = ['cash-registers'] as const;

export function useCashRegistersRealtime() {
  const q = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api.get<CashRegisterDto[] | { data: CashRegisterDto[] }>('/cash-registers');
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return (arr as CashRegisterDto[]).map(mapRegister);
    },
  });
  return { cashRegisters: q.data ?? [], isLoading: q.isLoading, error: q.error as Error | null };
}

export function useCashRegisters() {
  const qc = useQueryClient();
  const { cashRegisters } = useCashRegistersRealtime();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ['cash-movements'] });
  };

  const createMutation = useMutation({ mutationFn: async (data: any) => api.post('/cash-registers', data), onSuccess: invalidate });
  const updateMutation = useMutation({
    mutationFn: async (p: { id: string; data: any }) => api.put(`/cash-registers/${p.id}`, p.data),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({ mutationFn: async (id: string) => api.del(`/cash-registers/${id}`), onSuccess: invalidate });
  const transferMutation = useMutation({ mutationFn: async (data: any) => api.post('/cash-registers/transfer', data), onSuccess: invalidate });

  return {
    cashRegisters,
    createCashRegister: (data: any) => createMutation.mutateAsync(data),
    updateCashRegister: (id: string, data: any) => updateMutation.mutateAsync({ id, data }),
    deleteCashRegister: (id: string) => deleteMutation.mutateAsync(id),
    transfer: (data: any) => transferMutation.mutateAsync(data),
  };
}

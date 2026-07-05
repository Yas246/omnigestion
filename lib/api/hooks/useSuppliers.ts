'use client';

/**
 * Suppliers — API-backed (mirrors the legacy Firebase hook interface).
 *  - useSuppliersRealtime() -> { suppliers, isLoading }
 *  - useSuppliers()         -> { createSupplier, updateSupplier, deleteSupplier }
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Supplier } from '@/types';

interface SupplierDto {
  id: number;
  companyId: number;
  name: string;
  code: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  totalPurchases: number;
  totalAmount: number;
  currentDebt: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

function mapSupplier(s: SupplierDto): Supplier {
  return {
    id: String(s.id),
    companyId: String(s.companyId),
    name: s.name,
    code: s.code ?? undefined,
    phone: s.phone ?? undefined,
    email: s.email ?? undefined,
    address: s.address ?? undefined,
    totalPurchases: Number(s.totalPurchases),
    totalAmount: Number(s.totalAmount),
    currentDebt: Number(s.currentDebt),
    isActive: s.isActive,
    createdAt: new Date(s.createdAt),
    updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
  };
}

const KEY = ['suppliers'] as const;

export function useSuppliersRealtime() {
  const q = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api.get<{ data: SupplierDto[] } | SupplierDto[]>('/suppliers?limit=200');
      const arr = Array.isArray(res) ? res : ((res as any).data ?? []);
      return (arr as SupplierDto[]).map(mapSupplier);
    },
  });
  return { suppliers: q.data ?? [], isLoading: q.isLoading, error: q.error as Error | null };
}

export function useSuppliers() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const createMutation = useMutation({
    mutationFn: async (data: any) => api.post('/suppliers', data),
    onSuccess: invalidate,
  });
  const updateMutation = useMutation({
    mutationFn: async (p: { id: string; data: any }) => api.put(`/suppliers/${p.id}`, p.data),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.del(`/suppliers/${id}`),
    onSuccess: invalidate,
  });

  return {
    createSupplier: (data: any) => createMutation.mutateAsync(data),
    updateSupplier: (id: string, data: any) => updateMutation.mutateAsync({ id, data }),
    deleteSupplier: (id: string) => deleteMutation.mutateAsync(id),
  };
}

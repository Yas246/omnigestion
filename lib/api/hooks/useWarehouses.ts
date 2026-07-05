'use client';

/** Warehouses — API-backed. */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Warehouse } from '@/types';

interface WarehouseDto {
  id: number;
  companyId: number;
  name: string;
  code: string | null;
  address: string | null;
  isMain: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

function mapWarehouse(w: WarehouseDto): Warehouse {
  return {
    id: String(w.id),
    companyId: String(w.companyId),
    name: w.name,
    code: w.code ?? undefined,
    address: w.address ?? undefined,
    isMain: w.isMain,
    isActive: w.isActive,
    createdAt: new Date(w.createdAt),
    updatedAt: w.updatedAt ? new Date(w.updatedAt) : new Date(),
  };
}

const KEY = ['warehouses'] as const;

export function useWarehousesRealtime() {
  const q = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api.get<WarehouseDto[] | { data: WarehouseDto[] }>('/warehouses');
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return (arr as WarehouseDto[]).map(mapWarehouse);
    },
  });
  return { warehouses: q.data ?? [], isLoading: q.isLoading, error: q.error as Error | null };
}

export function useWarehouses() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });
  const createMutation = useMutation({ mutationFn: async (data: any) => api.post('/warehouses', data), onSuccess: invalidate });
  const updateMutation = useMutation({
    mutationFn: async (p: { id: string; data: any }) => api.put(`/warehouses/${p.id}`, p.data),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({ mutationFn: async (id: string) => api.del(`/warehouses/${id}`), onSuccess: invalidate });
  return {
    createWarehouse: (data: any) => createMutation.mutateAsync(data),
    updateWarehouse: (id: string, data: any) => updateMutation.mutateAsync({ id, data }),
    deleteWarehouse: (id: string) => deleteMutation.mutateAsync(id),
  };
}

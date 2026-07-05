'use client';

/**
 * Clients — API-backed hooks (reference pattern for the data-layer rewire).
 *
 * Drop-in replacements for the old Firebase hooks, preserving the interface the
 * clients page expects:
 *  - `useClientsRealtime()` -> { clients, isLoading }  (React Query instead of onSnapshot)
 *  - `useClients()`         -> { createClient, updateClient, deleteClient }
 *
 * The API returns numeric ids; we map to the legacy `Client` type (string ids)
 * here so existing components (ClientsTable, dialogs) work unchanged.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Client } from '@/types';

interface ClientDto {
  id: number;
  name: string;
  code: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  totalPurchases: number;
  totalAmount: number;
  currentCredit: number;
  lastPurchaseDate: string | null;
  isActive: boolean;
  tenantId: number;
  companyId: number;
  createdAt: string;
  updatedAt: string | null;
}

function mapClient(c: ClientDto): Client {
  return {
    id: String(c.id),
    companyId: String(c.companyId),
    name: c.name,
    code: c.code ?? undefined,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    address: c.address ?? undefined,
    totalPurchases: Number(c.totalPurchases),
    totalAmount: Number(c.totalAmount),
    currentCredit: Number(c.currentCredit),
    lastPurchaseDate: c.lastPurchaseDate ? new Date(c.lastPurchaseDate) : undefined,
    isActive: c.isActive,
    createdAt: new Date(c.createdAt),
    updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
  };
}

const CLIENTS_KEY = ['clients'] as const;

export function useClientsRealtime() {
  const q = useQuery({
    queryKey: CLIENTS_KEY,
    queryFn: async () => {
      const res = await api.get<{ data: ClientDto[] } | ClientDto[]>('/clients?limit=200');
      const arr = Array.isArray(res) ? res : ((res as any).data ?? []);
      return (arr as ClientDto[]).map(mapClient);
    },
  });
  return {
    clients: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error as Error | null,
  };
}

export function useClients() {
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: any) => api.post('/clients', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; data: any }) => api.put(`/clients/${payload.id}`, payload.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.del(`/clients/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });

  return {
    createClient: (data: any) => createMutation.mutateAsync(data),
    updateClient: (id: string, data: any) => updateMutation.mutateAsync({ id, data }),
    deleteClient: (id: string) => deleteMutation.mutateAsync(id),
  };
}

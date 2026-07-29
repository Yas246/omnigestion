'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Deliveries — storefront order fulfilment. Mirrors useInvoices: a realtime
 * list hook + a mutations hook, backed by /api/v1/deliveries* (auth+tenancy).
 * Money (codAmount) is BIGINT FCFA returned as a JS number.
 */

export type DeliveryStatus =
  | 'pending'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export interface DeliveryDto {
  id: number;
  invoiceId: number | null;
  clientId: number | null;
  clientName: string | null;
  driverUserId: number | null;
  driverName: string | null;
  status: DeliveryStatus;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  scheduledAt: string | null;
  assignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  codAmount: number;
  codPaymentMethod: string | null;
  codCollected: boolean;
  qrToken: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface DriverDto {
  id: number;
  fullName: string;
  email: string;
  isOwner: boolean;
}

export interface PendingInvoiceDto {
  id: number;
  invoiceNumber: string;
  clientName: string | null;
  total: number;
  codAmount: number;
  status: string;
  date: string;
}

export interface SettlementDto {
  id: number;
  driverUserId: number | null;
  driverName: string | null;
  status: 'open' | 'submitted' | 'validated' | 'discrepancy';
  periodStart: string | null;
  periodEnd: string | null;
  deliveriesCount: number;
  expectedCod: number;
  actualCash: number;
  actualMobile: number;
  difference: number;
  validatedAt: string | null;
  notes: string | null;
  createdAt: string;
}

const mapDelivery = (d: any): DeliveryDto => ({
  id: Number(d.id),
  invoiceId: d.invoiceId ?? null,
  clientId: d.clientId ?? null,
  clientName: d.clientName ?? null,
  driverUserId: d.driverUserId ?? null,
  driverName: d.driverName ?? null,
  status: d.status,
  address: d.address ?? null,
  latitude: d.latitude != null ? Number(d.latitude) : null,
  longitude: d.longitude != null ? Number(d.longitude) : null,
  city: d.city ?? null,
  scheduledAt: d.scheduledAt ?? null,
  assignedAt: d.assignedAt ?? null,
  pickedUpAt: d.pickedUpAt ?? null,
  deliveredAt: d.deliveredAt ?? null,
  codAmount: Number(d.codAmount ?? 0),
  codPaymentMethod: d.codPaymentMethod ?? null,
  codCollected: !!d.codCollected,
  qrToken: d.qrToken ?? null,
  failureReason: d.failureReason ?? null,
  createdAt: d.createdAt,
});

/** Realtime list of deliveries (all statuses). */
export function useDeliveriesRealtime(status?: DeliveryStatus) {
  const q = useQuery({
    queryKey: status ? (['deliveries', status] as const) : (['deliveries'] as const),
    queryFn: async () => {
      const path = status ? `/deliveries?status=${status}&limit=300` : '/deliveries?limit=300';
      const res = await api.get<any>(path);
      const arr = Array.isArray(res) ? res : ((res as any)?.data ?? []);
      return (arr as any[]).map(mapDelivery);
    },
    refetchInterval: 15000,
  });
  return { deliveries: q.data ?? [], isLoading: q.isLoading, error: q.error as Error | null };
}

/** The current driver's own deliveries (for the /livreur app). */
export function useMyDeliveries() {
  const q = useQuery({
    queryKey: ['deliveries', 'mine'] as const,
    queryFn: async () => {
      const res = await api.get<any>('/deliveries/mine');
      const arr = Array.isArray(res) ? res : ((res as any)?.data ?? []);
      return (arr as any[]).map(mapDelivery);
    },
    refetchInterval: 10000,
  });
  return { deliveries: q.data ?? [], isLoading: q.isLoading, error: q.error as Error | null };
}

export function useDelivery(id: number | string | null) {
  const q = useQuery({
    queryKey: ['deliveries', String(id)] as const,
    queryFn: async () => {
      const res = await api.get<any>(`/deliveries/${id}`);
      return { ...mapDelivery(res), events: (res.events ?? []).map((e: any) => ({ ...e })) };
    },
    enabled: !!id,
    refetchInterval: 10000,
  });
  return { delivery: q.data ?? null, isLoading: q.isLoading, error: q.error as Error | null };
}

export function useDrivers() {
  const q = useQuery({
    queryKey: ['delivery-drivers'] as const,
    queryFn: async () => (await api.get<DriverDto[]>('/deliveries/drivers')) ?? [],
  });
  return { drivers: q.data ?? [], isLoading: q.isLoading };
}

export function usePendingInvoices() {
  const q = useQuery({
    queryKey: ['delivery-pending-invoices'] as const,
    queryFn: async () => (await api.get<PendingInvoiceDto[]>('/deliveries/pending-invoices')) ?? [],
    refetchInterval: 30000,
  });
  return { pendingInvoices: q.data ?? [], isLoading: q.isLoading };
}

/** Live positions of active deliveries (for the dispatch map). */
export function useDeliveryLive() {
  const q = useQuery({
    queryKey: ['deliveries', 'live'] as const,
    queryFn: async () => (await api.get<any[]>('/deliveries/live')) ?? [],
    refetchInterval: 10000,
  });
  return { live: q.data ?? [], isLoading: q.isLoading };
}

export function useDeliveryPerformance() {
  const q = useQuery({
    queryKey: ['deliveries', 'performance'] as const,
    queryFn: async () => (await api.get<any[]>('/deliveries/performance')) ?? [],
  });
  return { performance: q.data ?? [], isLoading: q.isLoading };
}

export function useSettlements() {
  const q = useQuery({
    queryKey: ['delivery-settlements'] as const,
    queryFn: async () => {
      const res = await api.get<any>('/deliveries/settlements');
      const arr = Array.isArray(res) ? res : ((res as any)?.data ?? []);
      return arr as SettlementDto[];
    },
    refetchInterval: 20000,
  });
  return { settlements: q.data ?? [], isLoading: q.isLoading };
}

export function useDeliveries() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['deliveries'] });
    qc.invalidateQueries({ queryKey: ['invoices'] });
    qc.invalidateQueries({ queryKey: ['delivery-pending-invoices'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['delivery-settlements'] });
  };

  const create = useMutation({
    mutationFn: async (data: { invoiceId: number; deliveryAddressId?: number; address?: string; latitude?: number; longitude?: number; city?: string }) =>
      api.post('/deliveries', data),
    onSuccess: invalidate,
  });
  const assign = useMutation({
    mutationFn: async ({ id, driverUserId }: { id: number; driverUserId: number }) =>
      api.post(`/deliveries/${id}/assign`, { driverUserId }),
    onSuccess: invalidate,
  });
  const pickup = useMutation({ mutationFn: async (id: number) => api.post(`/deliveries/${id}/pickup`), onSuccess: invalidate });
  const start = useMutation({ mutationFn: async (id: number) => api.post(`/deliveries/${id}/start`), onSuccess: invalidate });
  const fail = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => api.post(`/deliveries/${id}/fail`, { reason }),
    onSuccess: invalidate,
  });
  const cancel = useMutation({ mutationFn: async (id: number) => api.post(`/deliveries/${id}/cancel`), onSuccess: invalidate });
  const complete = useMutation({
    mutationFn: async ({ id, scannedQrToken, codPaymentMethod }: { id: number; scannedQrToken?: string; codPaymentMethod?: 'cash' | 'mobile' | 'bank' }) =>
      api.post(`/deliveries/${id}/complete`, { scannedQrToken, codPaymentMethod }),
    onSuccess: invalidate,
  });
  const updatePosition = useMutation({
    mutationFn: async ({ id, latitude, longitude }: { id: number; latitude: number; longitude: number }) =>
      api.post(`/deliveries/${id}/position`, { latitude, longitude }),
  });
  const createSettlement = useMutation({
    mutationFn: async (data: { driverUserId?: number; actualCash?: number; actualMobile?: number; notes?: string }) =>
      api.post('/deliveries/settlements', data),
    onSuccess: invalidate,
  });
  const validateSettlement = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; actualCash?: number; actualMobile?: number; notes?: string }) =>
      api.post(`/deliveries/settlements/${id}/validate`, data),
    onSuccess: invalidate,
  });

  return {
    createDelivery: create.mutateAsync,
    assignDelivery: assign.mutateAsync,
    pickupDelivery: pickup.mutateAsync,
    startDelivery: start.mutateAsync,
    failDelivery: fail.mutateAsync,
    cancelDelivery: cancel.mutateAsync,
    completeDelivery: complete.mutateAsync,
    updatePosition: updatePosition.mutateAsync,
    createSettlement: createSettlement.mutateAsync,
    validateSettlement: validateSettlement.mutateAsync,
  };
}

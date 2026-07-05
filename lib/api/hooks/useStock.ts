'use client';

/**
 * Stock operations — API-backed. Mirrors the legacy useStockMovements interface:
 *  - movements, loading, hasMore, loadMore, fetchMovements
 *  - recordInMovement (restock), recordOutMovement (loss), transferStock
 * Legacy ids are strings; converted to numbers for the API.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { StockMovement } from '@/types';

interface MovementDto {
  id: number;
  productId: number;
  warehouseId: number;
  type: string;
  quantity: number;
  reason: string | null;
  referenceType: string | null;
  referenceId: number | null;
  userId: number | null;
  userName: string | null;
  quantityBefore: number | null;
  quantityAfter: number | null;
  createdAt: string;
}

function mapMovement(m: MovementDto): StockMovement {
  return {
    id: String(m.id),
    productId: String(m.productId),
    warehouseId: String(m.warehouseId),
    type: m.type as any,
    quantity: m.quantity,
    reason: m.reason ?? undefined,
    referenceType: m.referenceType ?? undefined,
    referenceId: m.referenceId ? String(m.referenceId) : undefined,
    userId: m.userId ? String(m.userId) : '',
    userName: m.userName ?? undefined,
    quantityBefore: m.quantityBefore ?? undefined,
    quantityAfter: m.quantityAfter ?? undefined,
    createdAt: new Date(m.createdAt),
  } as StockMovement;
}

const KEY = ['stock-movements'] as const;

export function useStockMovements() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api.get<{ data: MovementDto[] } | MovementDto[]>('/stock/movements?limit=200');
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return (arr as MovementDto[]).map(mapMovement);
    },
  });
  const invalidate = () => {
    // Stock ops change per-warehouse quantities → the products list (which
    // derives its displayed stock from warehouseQuantities) must refetch too,
    // not just the movements history.
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ['products'] });
  };

  const inMutation = useMutation({
    mutationFn: async (p: any) =>
      api.post('/stock/restock', {
        productId: Number(p.productId),
        warehouseId: Number(p.warehouseId),
        quantity: p.quantity,
        reason: p.reason ?? null,
      }),
    onSuccess: invalidate,
  });
  const outMutation = useMutation({
    mutationFn: async (p: any) =>
      api.post('/stock/loss', {
        productId: Number(p.productId),
        warehouseId: Number(p.warehouseId),
        quantity: p.quantity,
        reason: p.reason ?? null,
      }),
    onSuccess: invalidate,
  });
  const transferMutation = useMutation({
    mutationFn: async (p: any) =>
      api.post('/stock/transfer', {
        productId: Number(p.productId),
        fromWarehouseId: Number(p.fromWarehouseId),
        toWarehouseId: Number(p.toWarehouseId),
        quantity: p.quantity,
        reason: p.reason ?? null,
      }),
    onSuccess: invalidate,
  });

  return {
    movements: q.data ?? [],
    allMovements: q.data ?? [],
    loading: q.isLoading,
    hasMore: false,
    loadMore: async () => {},
    fetchMovements: async () => invalidate(),
    recordInMovement: (p: any) => inMutation.mutateAsync(p),
    recordOutMovement: (p: any) => outMutation.mutateAsync(p),
    transferStock: (p: any) => transferMutation.mutateAsync(p),
  };
}

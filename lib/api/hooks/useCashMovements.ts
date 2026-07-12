'use client';

/**
 * Cash movements — API-backed.
 *  - useCashMovementsRealtime() -> { movements, isLoading, hasMore, loadMore }
 *  - useCashMovements()         -> { createMovement }
 *
 * createMovement routes transfers to /cash-registers/transfer (two-sided),
 * plain in/out to /cash-movements.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { CashMovement } from '@/types';

interface CashMovementDto {
  id: number;
  companyId: number;
  cashRegisterId: number;
  type: string;
  amount: number;
  category: string | null;
  description: string | null;
  referenceType: string | null;
  referenceId: number | null;
  targetCashRegisterId: number | null;
  userId: number | null;
  userName: string | null;
  createdAt: string;
}

function mapMovement(m: CashMovementDto): CashMovement {
  return {
    id: String(m.id),
    companyId: String(m.companyId),
    cashRegisterId: String(m.cashRegisterId),
    type: m.type as any,
    amount: Number(m.amount),
    category: m.category ?? undefined,
    description: m.description ?? undefined,
    referenceType: m.referenceType ?? undefined,
    referenceId: m.referenceId ? String(m.referenceId) : undefined,
    targetCashRegisterId: m.targetCashRegisterId ? String(m.targetCashRegisterId) : undefined,
    userId: m.userId ? String(m.userId) : '',
    createdAt: new Date(m.createdAt),
  } as CashMovement;
}

const KEY = ['cash-movements'] as const;

export function useCashMovementsRealtime() {
  const q = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api.get<{ data: CashMovementDto[] } | CashMovementDto[]>('/cash-movements?limit=200');
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return (arr as CashMovementDto[]).map(mapMovement);
    },
  });
  return {
    movements: q.data ?? [],
    isLoading: q.isLoading,
    hasMore: false,
    loadMore: async () => {},
    error: q.error as Error | null,
  };
}

export function useCashMovements() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ['cash-registers'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.type === 'transfer') {
        return api.post('/cash-registers/transfer', {
          fromRegisterId: data.cashRegisterId,
          toRegisterId: data.targetCashRegisterId,
          amount: data.amount,
          reason: data.description,
        });
      }
      return api.post('/cash-movements', {
        registerId: data.cashRegisterId,
        type: data.type,
        amount: data.amount,
        category: data.category,
        description: data.description,
      });
    },
    onSuccess: invalidate,
  });

  return {
    createMovement: (data: any, _companyId?: string) => createMutation.mutateAsync(data),
  };
}

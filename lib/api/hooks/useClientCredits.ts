'use client';

/**
 * Client credits + payments — API-backed.
 *  - useClientCreditsRealtime() -> { credits, payments, isLoading }
 *  - useClientCredits()         -> { addPayment }
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ClientCredit, ClientCreditPayment } from '@/types';

interface CreditDto {
  id: number;
  companyId: number;
  clientId: number | null;
  clientName: string;
  invoiceId: number | null;
  invoiceNumber: string | null;
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
interface PaymentDto {
  id: number;
  clientCreditId: number;
  amount: number;
  paymentMode: string | null;
  notes: string | null;
  userId: number | null;
  createdAt: string;
}

function mapCredit(c: CreditDto): ClientCredit {
  return {
    id: String(c.id),
    companyId: String(c.companyId),
    clientId: c.clientId ? String(c.clientId) : undefined,
    clientName: c.clientName,
    invoiceId: c.invoiceId ? String(c.invoiceId) : undefined,
    invoiceNumber: c.invoiceNumber ?? undefined,
    amount: Number(c.amount),
    amountPaid: Number(c.amountPaid),
    remainingAmount: Number(c.remainingAmount),
    status: c.status as any,
    date: new Date(c.date),
    dueDate: c.dueDate ? new Date(c.dueDate) : undefined,
    notes: c.notes ?? undefined,
    createdAt: new Date(c.createdAt),
    updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
  };
}
function mapPayment(p: PaymentDto): ClientCreditPayment {
  return {
    id: String(p.id),
    creditId: String(p.clientCreditId),
    amount: Number(p.amount),
    paymentMode: (p.paymentMode as any) ?? 'cash',
    notes: p.notes ?? undefined,
    userId: p.userId ? String(p.userId) : '',
    createdAt: new Date(p.createdAt),
  };
}

const KEY = ['client-credits'] as const;

export function useClientCreditsRealtime() {
  const q = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const [creditsRes, paymentsRes] = await Promise.all([
        api.get<CreditDto[] | { data: CreditDto[] }>('/client-credits?limit=200'),
        api.get<PaymentDto[] | { data: PaymentDto[] }>('/client-credit-payments?limit=200'),
      ]);
      const creditsArr = Array.isArray(creditsRes) ? creditsRes : (creditsRes as any).data ?? [];
      const paymentsArr = Array.isArray(paymentsRes) ? paymentsRes : (paymentsRes as any).data ?? [];
      return {
        credits: (creditsArr as CreditDto[]).map(mapCredit),
        payments: (paymentsArr as PaymentDto[]).map(mapPayment),
      };
    },
  });
  return {
    credits: q.data?.credits ?? [],
    payments: q.data?.payments ?? [],
    isLoading: q.isLoading,
    error: q.error as Error | null,
  };
}

export function useClientCredits() {
  const qc = useQueryClient();
  const payMutation = useMutation({
    mutationFn: async (p: { creditId: string; input: { amount: number; paymentMode?: string; notes?: string } }) =>
      api.post(`/client-credits/${p.creditId}/payments`, p.input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
  const createMutation = useMutation({
    mutationFn: async (data: any) =>
      api.post('/client-credits', {
        ...data,
        clientId: data.clientId ? Number(data.clientId) : undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  return {
    createCredit: (data: any) => createMutation.mutateAsync(data),
    addPayment: (creditId: string, input: { amount: number; paymentMode?: string; notes?: string }) =>
      payMutation.mutateAsync({ creditId, input }),
  };
}

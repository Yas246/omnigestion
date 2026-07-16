'use client';

/** Saved AI reports ( Analyse IA ) — API-backed. */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface AiReportDto {
  id: number;
  title: string;
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  content: string;
  model: string;
  createdAt: string;
}

const KEY = ['ai-reports'] as const;

export function useAiReports() {
  const q = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api.get<AiReportDto[] | { data: AiReportDto[] }>('/ai-reports');
      const arr = Array.isArray(res) ? res : ((res as any).data ?? []);
      return arr as AiReportDto[];
    },
  });
  return { reports: q.data ?? [], isLoading: q.isLoading };
}

export function useAiReportsMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const createMutation = useMutation({
    mutationFn: async (data: any) => api.post<AiReportDto>('/ai-reports', data),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.del(`/ai-reports/${id}`),
    onSuccess: invalidate,
  });

  return {
    saveReport: (data: any) => createMutation.mutateAsync(data),
    deleteReport: (id: number) => deleteMutation.mutateAsync(id),
    isSaving: createMutation.isPending,
  };
}

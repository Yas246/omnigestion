'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/useAuth';
import { realtimeService } from '@/lib/services/RealtimeService';
import type { Invoice } from '@/types';

/**
 * Hook pour les factures avec écoute temps réel GLOBAL
 */
export function useInvoicesRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEmployee = user?.role === 'employee';

  const { data: invoices = [], isLoading, error } = useQuery<Invoice[]>({
    queryKey: ['companies', user?.currentCompanyId, 'invoices', isEmployee ? 'today' : 'all'],
    queryFn: async () => [],
    enabled: !!user?.currentCompanyId,
    staleTime: Infinity,
  });

  // Démarrer l'écoute globale
  useEffect(() => {
    if (user?.currentCompanyId) {
      realtimeService.startInvoicesListener(queryClient, user.currentCompanyId, isEmployee);
    }
  }, [user?.currentCompanyId, isEmployee, queryClient]);

  return {
    invoices,
    isLoading,
    error,
  };
}

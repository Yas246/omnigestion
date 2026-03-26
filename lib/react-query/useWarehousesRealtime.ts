'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/useAuth';
import { realtimeService } from '@/lib/services/RealtimeService';
import type { Warehouse } from '@/types';

/**
 * Hook pour les entrepôts avec écoute temps réel GLOBAL
 */
export function useWarehousesRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: warehouses = [], isLoading, error } = useQuery<Warehouse[]>({
    queryKey: ['companies', user?.currentCompanyId, 'warehouses'],
    queryFn: async () => [],
    enabled: !!user?.currentCompanyId,
    staleTime: Infinity,
  });

  // Démarrer l'écoute globale
  useEffect(() => {
    if (user?.currentCompanyId) {
      realtimeService.startWarehousesListener(queryClient, user.currentCompanyId);
    }
  }, [user?.currentCompanyId, queryClient]);

  return {
    warehouses,
    isLoading,
    error,
  };
}

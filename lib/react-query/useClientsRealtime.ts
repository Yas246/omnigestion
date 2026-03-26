'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/useAuth';
import { realtimeService } from '@/lib/services/RealtimeService';
import type { Client } from '@/types';

/**
 * Hook pour les clients avec écoute temps réel GLOBAL
 */
export function useClientsRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading, error } = useQuery<Client[]>({
    queryKey: ['companies', user?.currentCompanyId, 'clients'],
    queryFn: async () => [],
    enabled: !!user?.currentCompanyId,
    staleTime: Infinity,
  });

  // Démarrer l'écoute globale
  useEffect(() => {
    if (user?.currentCompanyId) {
      realtimeService.startClientsListener(queryClient, user.currentCompanyId);
    }
  }, [user?.currentCompanyId, queryClient]);

  return {
    clients,
    isLoading,
    error,
  };
}

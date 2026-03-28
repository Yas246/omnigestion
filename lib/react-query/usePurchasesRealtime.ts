'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/useAuth';
import { realtimeService } from '@/lib/services/RealtimeService';
import type { Purchase } from '@/types';

/**
 * Hook pour les achats fournisseurs avec écoute temps réel GLOBAL
 *
 * Le service global maintient la connexion onSnapshot active en permanence,
 * permettant au cache React Query de persister entre les navigations.
 */
export function usePurchasesRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: purchases = [], isLoading, error } = useQuery<Purchase[]>({
    queryKey: ['companies', user?.currentCompanyId, 'purchases'],
    queryFn: async () => [],
    enabled: !!user?.currentCompanyId,
    staleTime: Infinity,
  });

  // Démarrer l'écoute globale (une seule fois pour toute l'application)
  useEffect(() => {
    if (user?.currentCompanyId) {
      realtimeService.startPurchasesListener(queryClient, user.currentCompanyId);
    }
    // NOTE: PAS de cleanup du cache ici! Le cache doit persister entre les navigations.
    // Le cache sera vidé uniquement lors d'un changement de compagnie (géré par RealtimeService)
  }, [user?.currentCompanyId, queryClient]);

  return {
    purchases,
    isLoading,
    error,
  };
}

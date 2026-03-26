'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/useAuth';
import { realtimeService } from '@/lib/services/RealtimeService';

/**
 * Hook pour les mouvements de caisse avec écoute temps réel GLOBAL
 *
 * Affiche les 20 derniers mouvements par défaut.
 * L'utilisateur peut charger plus de mouvements avec la fonction loadMore().
 *
 * @param options - Configuration optionnelle
 * @param options.limit - Nombre de mouvements à charger (défaut: 20)
 */
export function useCashMovementsRealtime(options?: { limit?: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(options?.limit || 20);

  const { data: movements = [], isLoading, error } = useQuery<any[]>({
    queryKey: ['companies', user?.currentCompanyId, 'cashMovements'],
    queryFn: async () => [],
    enabled: !!user?.currentCompanyId,
    staleTime: Infinity,
  });

  // Démarrer l'écoute globale (une seule fois pour toute l'application)
  useEffect(() => {
    if (user?.currentCompanyId) {
      realtimeService.startCashMovementsListener(queryClient, user.currentCompanyId, limit);
    }
    // NOTE: PAS de cleanup du cache ici! Le cache doit persister entre les navigations.
    // Le cache sera vidé uniquement lors d'un changement de compagnie (géré par RealtimeService)
  }, [user?.currentCompanyId, queryClient, limit]);

  // Fonction pour charger plus de mouvements
  const loadMore = () => {
    setLimit(prev => prev + 20);
  };

  // Afficher uniquement les mouvements jusqu'à la limite
  const limitedMovements = movements.slice(0, limit);
  const hasMore = movements.length > limit;

  return {
    movements: limitedMovements,
    allMovements: movements,
    loadMore,
    hasMore,
    isLoading,
    error,
  };
}
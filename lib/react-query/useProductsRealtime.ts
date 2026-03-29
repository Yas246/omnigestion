'use client';

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/useAuth';
import { realtimeService } from '@/lib/services/RealtimeService';
import type { Product } from '@/types';

/**
 * Hook pour les produits avec écoute temps réel GLOBAL
 *
 * Le service global maintient la connexion onSnapshot active en permanence,
 * permettant au cache React Query de persister entre les navigations.
 */
export function useProductsRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: rawProducts = [], isLoading, error } = useQuery<Product[]>({
    queryKey: ['companies', user?.currentCompanyId, 'products'],
    queryFn: async () => [],
    enabled: !!user?.currentCompanyId,
    staleTime: Infinity,
  });

  // Filtrer les produits soft-deleted (deletedAt défini)
  // Ce filtre est la sécurité finale : il fonctionne même si le listener
  // RealtimeService est une ancienne version sans filtre deletedAt
  const products = useMemo(
    () => rawProducts.filter(p => !p.deletedAt),
    [rawProducts]
  );

  // Démarrer l'écoute globale (une seule fois pour toute l'application)
  useEffect(() => {
    if (user?.currentCompanyId) {
      realtimeService.startProductsListener(queryClient, user.currentCompanyId);
      // 🔄 Activer l'écoute des warehouse quantities en temps réel
      realtimeService.startWarehouseQuantitiesListener(queryClient, user.currentCompanyId);
    }
    // NOTE: PAS de cleanup du cache ici! Le cache doit persister entre les navigations.
    // Le cache sera vidé uniquement lors d'un changement de compagnie (géré par RealtimeService)
  }, [user?.currentCompanyId, queryClient]);

  return {
    products,
    isLoading,
    error,
  };
}

/**
 * Hook pour obtenir le stock d'affichage d'un produit
 * Prend en compte le filtre d'entrepôt actif
 */
export function useProductDisplayStock() {
  const queryClient = useQueryClient();

  const getDisplayStock = (productId: string, companyId: string, warehouseId?: string | null): number => {
    // Récupérer le produit depuis le cache
    const products = queryClient.getQueryData<Product[]>(
      ['companies', companyId, 'products']
    );

    if (!products) return 0;

    const product = products.find(p => p.id === productId);
    if (!product) return 0;

    // Si un filtre d'entrepôt est actif, retourner le stock dans cet entrepôt
    if (warehouseId && product.warehouseQuantities) {
      const location = product.warehouseQuantities.find(
        (wq) => wq.warehouseId === warehouseId
      );
      return location?.quantity || 0;
    }

    // Sinon, retourner le stock total du produit (somme des dépôts)
    return product.currentStock || 0;
  };

  return { getDisplayStock };
}

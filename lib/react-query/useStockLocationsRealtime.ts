'use client';

import { useQueryClient } from '@tanstack/react-query';
import type { Product } from '@/types';

/**
 * Hook helper pour obtenir le stock d'affichage d'un produit
 * Prend en compte le filtre d'entrepôt actif
 *
 * NOTE: Avec la nouvelle architecture, les warehouseQuantities sont
 * directement inclus dans les produits du cache principal.
 */
export function useProductDisplayStock() {
  const queryClient = useQueryClient();

  const getDisplayStock = (productId: string, companyId: string, warehouseId?: string | null): number => {
    // Récupérer les produits depuis le cache principal (qui contient déjà warehouseQuantities)
    const products = queryClient.getQueryData<Product[]>(
      ['companies', companyId, 'products']
    ) || [];

    const product = products.find(p => p.id === productId);
    if (!product) return 0;

    // Si un filtre d'entrepôt est actif, retourner le stock dans cet entrepôt
    if (warehouseId && product.warehouseQuantities) {
      const location = product.warehouseQuantities.find(
        (wq) => wq.warehouseId === warehouseId
      );
      return location?.quantity || 0;
    }

    // Sinon, retourner le stock total du produit
    return product.currentStock || 0;
  };

  return { getDisplayStock };
}

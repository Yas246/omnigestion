'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/useAuth';
import { realtimeService } from '@/lib/services/RealtimeService';
import { collection, query, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

  const { data: products = [], isLoading, error } = useQuery<Product[]>({
    queryKey: ['companies', user?.currentCompanyId, 'products'],
    queryFn: async () => [],
    enabled: !!user?.currentCompanyId,
    staleTime: Infinity,
  });

  // Démarrer l'écoute globale (une seule fois pour toute l'application)
  useEffect(() => {
    if (user?.currentCompanyId) {
      realtimeService.startProductsListener(queryClient, user.currentCompanyId);
      // Charger les warehouseQuantities et recalculer currentStock (une seule fois par compagnie)
      loadWarehouseQuantities(queryClient, user.currentCompanyId);
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
 * Charge les warehouseQuantities pour tous les produits et recalcule currentStock
 */
async function loadWarehouseQuantities(queryClient: QueryClient, companyId: string) {
  try {
    // Récupérer tous les produits depuis le cache
    const products = queryClient.getQueryData<Product[]>(
      ['companies', companyId, 'products']
    ) || [];

    if (products.length === 0) {
      console.log('[useProductsRealtime] ⚠️ Aucun produit à traiter');
      return;
    }

    // Vérifier si les warehouseQuantities sont déjà chargés
    // (on vérifie le premier produit : s'il a warehouseQuantities, c'est que tout est chargé)
    const firstProduct = products[0];
    if (firstProduct?.warehouseQuantities && firstProduct.warehouseQuantities.length > 0) {
      console.log('[useProductsRealtime] ♻️ warehouseQuantities déjà chargés pour cette compagnie');
      return;
    }

    console.log('[useProductsRealtime] 🔨 Chargement des warehouseQuantities...');

    // Récupérer les entrepôts pour avoir leurs noms
    const warehousesSnapshot = await getDocs(
      query(collection(db, `companies/${companyId}/warehouses`))
    );

    const warehousesMap = new Map(
      warehousesSnapshot.docs.map(doc => [doc.id, doc.data()])
    );

    // Pour chaque produit, charger ses stock_locations
    const productsWithWarehouses = await Promise.all(
      products.map(async (product) => {
        try {
          const stockSnapshot = await getDocs(
            query(
              collection(db, `companies/${companyId}/products/${product.id}/stock_locations`)
            )
          );

          const warehouseQuantities = stockSnapshot.docs.map((doc) => {
            const warehouseData = warehousesMap.get(doc.data().warehouseId);
            return {
              warehouseId: doc.data().warehouseId,
              warehouseName: warehouseData?.name || 'Entrepôt inconnu',
              quantity: doc.data().quantity,
            };
          });

          // Calculer currentStock comme la SOMME des warehouseQuantities
          const calculatedStock = warehouseQuantities.reduce((sum, wq) => sum + wq.quantity, 0);

          console.log(`[useProductsRealtime] 📦 ${product.name}: ${warehouseQuantities.length} dépôts, stock total = ${calculatedStock}`);

          return {
            ...product,
            warehouseQuantities,
            currentStock: calculatedStock, // 🔄 IMPORTANT : Recalculé comme somme des dépôts
          };
        } catch (err) {
          console.error(`[useProductsRealtime] ❌ Erreur chargement stock_locations pour ${product.name}:`, err);
          // En cas d'erreur, garder le currentStock original
          return product;
        }
      })
    );

    // Mettre à jour le cache avec les produits enrichis
    queryClient.setQueryData(
      ['companies', companyId, 'products'],
      productsWithWarehouses
    );

    // Trier par nom alphabétique après mise à jour
    productsWithWarehouses.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

    // 🔄 IMPORTANT: Stocker les warehouseQuantities dans le cache RealtimeService
    // pour qu'elles soient préservées lors des mises à jour onSnapshot
    productsWithWarehouses.forEach((product) => {
      if (product.warehouseQuantities && product.warehouseQuantities.length > 0) {
        realtimeService.cacheWarehouseQuantities(product.id, product.warehouseQuantities);
      }
    });

    console.log(`[useProductsRealtime] ✅ ${productsWithWarehouses.length} produits mis à jour avec leurs dépôts (CACHEÉ)`);
  } catch (err) {
    console.error('[useProductsRealtime] ❌ Erreur chargement warehouseQuantities:', err);
  }
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

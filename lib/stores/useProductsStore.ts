import { create } from "zustand";
import {
  subscribeWithSelector,
  persist,
  createJSONStorage,
} from "zustand/middleware";
import type { Product } from "@/types";
import * as productsApi from "@/lib/firestore/products";
import { useAuthStore } from "./useAuthStore";

/**
 * Interface pour les stock_locations
 */
export interface StockLocation {
  warehouseId: string;
  warehouseName: string;
  quantity: number;
}

/**
 * Filtres pour les produits
 */
export interface ProductFilters {
  warehouseId: string | null;
  category: string | null;
  search: string;
  minPrice: number | null;
  maxPrice: number | null;
}

/**
 * État du store produits
 */
interface ProductsState {
  // Données
  products: Product[];
  stockLocationsMap: Record<string, StockLocation[]>;

  // État de chargement
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  lastLoadedAt: number | null;

  // Pagination
  currentPage: number;
  pageSize: number;
  lastDoc: any;

  // Filtres actuels
  filters: ProductFilters;

  // Actions de chargement
  fetchProducts: (
    companyId: string,
    options?: { reset?: boolean; pageSize?: number },
  ) => Promise<void>;
  loadMore: (companyId?: string) => Promise<void>;
  refreshProducts: () => Promise<void>;

  // Actions de filtres
  setWarehouseFilter: (warehouseId: string | null) => void;
  setCategoryFilter: (category: string | null) => void;
  setSearchQuery: (query: string) => void;
  setPriceRangeFilter: (min: number | null, max: number | null) => void;
  clearFilters: () => void;

  // Optimistic updates
  optimisticCreateProduct: (product: Product) => void;
  optimisticUpdateProduct: (
    productId: string,
    updates: Partial<Product>,
  ) => void;
  optimisticDeleteProduct: (productId: string) => void;

  // Synchronisation avec Firestore
  syncProduct: (productId: string) => Promise<void>;
  syncProductsStockLocations: (
    companyId: string,
    productIds: string[],
  ) => Promise<void>;

  // Getters
  getProductById: (productId: string) => Product | undefined;
  getFilteredProducts: () => Product[];
  getProductStockInWarehouse: (
    productId: string,
    warehouseId: string,
  ) => number;
  getProductDisplayStock: (productId: string) => number;
  clearProducts: () => void;

  // Chargement en arrière-plan
  loadAllRemainingProducts: (companyId?: string) => Promise<void>;
}

/**
 * Store produits avec pagination, filtres et optimistic updates
 *
 * C'est le store le plus critique pour réduire les lectures Firestore.
 * Il maintient les produits en cache et ne les recharge que quand nécessaire.
 */
export const useProductsStore = create<ProductsState>()(
  persist(
    subscribeWithSelector((set, get) => ({
      // État initial
      products: [],
      stockLocationsMap: {},
      loading: false,
      error: null,
      hasMore: true,
      lastLoadedAt: null,
      currentPage: 0,
      pageSize: 50,
      lastDoc: null,
      filters: {
        warehouseId: null,
        category: null,
        search: "",
        minPrice: null,
        maxPrice: null,
      },

      /**
       * Charger les produits depuis Firestore
       */
      fetchProducts: async (companyId, options = {}) => {
        const { reset = false, pageSize = 50 } = options;
        const { filters, currentPage, lastDoc } = get();

        if (!companyId) {
          console.error("[fetchProducts] Aucune compagnie sélectionnée");
          return;
        }

        set({ loading: true, error: null });

        const startTime = performance.now();
        console.log("[useProductsStore] Début chargement produits", {
          companyId,
          page: reset ? 0 : currentPage,
          pageSize,
          filters,
        });

        try {
          const {
            data: newProducts,
            hasMore,
            lastDoc: newLastDoc,
          } = await productsApi.fetchProducts(companyId, {
            limit: pageSize,
            startAfter: reset ? undefined : lastDoc,
            orderByField: "name",
            orderDirection: "asc",
            filters: {
              warehouseId: filters.warehouseId || undefined,
              category: filters.category || undefined,
              search: filters.search || undefined,
              minPrice: filters.minPrice || undefined,
              maxPrice: filters.maxPrice || undefined,
            },
          });

          const endTime = performance.now();
          console.log("[useProductsStore] Chargement terminé", {
            count: newProducts.length,
            hasMore,
            duration: `${(endTime - startTime).toFixed(0)}ms`,
          });

          set((state) => {
            // Fusionner en évitant les doublons (basé sur l'ID du produit)
            const existingIds = new Set(state.products.map((p) => p.id));
            const uniqueNewProducts = newProducts.filter(
              (p) => !existingIds.has(p.id),
            );

            const mergedProducts = reset
              ? newProducts
              : [...state.products, ...uniqueNewProducts];

            console.log("[fetchProducts] Fusion produits", {
              reset,
              existingCount: state.products.length,
              newCount: newProducts.length,
              uniqueNewCount: uniqueNewProducts.length,
              finalCount: mergedProducts.length,
              duplicatesRemoved: newProducts.length - uniqueNewProducts.length,
            });

            return {
              products: mergedProducts,
              hasMore,
              lastDoc: newLastDoc,
              loading: false,
              lastLoadedAt: Date.now(),
              currentPage: reset ? 0 : state.currentPage + 1,
            };
          });

          // Charger les stock_locations pour les nouveaux produits
          const productIds = newProducts.map((p) => p.id);
          if (productIds.length > 0) {
            get().syncProductsStockLocations(companyId, productIds);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Erreur inconnue lors du chargement";
          console.error("[useProductsStore] Erreur chargement:", error);

          set({
            error: errorMessage,
            loading: false,
          });
        }
      },

      /**
       * Charger plus de produits (pagination)
       */
      loadMore: async (companyId?: string) => {
        const { hasMore, loading } = get();

        if (!hasMore || loading) {
          console.log("[loadMore] Pas plus de produits ou chargement en cours");
          return;
        }

        // Utiliser le companyId passé ou celui du store
        const targetCompanyId =
          companyId || useAuthStore.getState().currentCompanyId;
        if (!targetCompanyId) {
          console.error("[loadMore] Aucune compagnie sélectionnée");
          return;
        }

        console.log("[loadMore] Chargement page suivante");
        await get().fetchProducts(targetCompanyId, { reset: false });
      },

      /**
       * Rafraîchir tous les produits (recharger depuis Firestore)
       */
      refreshProducts: async () => {
        const companyId = useAuthStore.getState().currentCompanyId;
        if (!companyId) {
          console.error("[refreshProducts] Aucune compagnie sélectionnée");
          return;
        }

        console.log("[refreshProducts] Rafraîchissement complet");
        await get().fetchProducts(companyId, { reset: true });
      },

      /**
       * Charger automatiquement tous les produits restants en arrière-plan
       * Cette fonction charge progressivement tous les produits pour que
       * la recherche fonctionne sur tous les produits, pas seulement les 50 premiers
       *
       * @param companyId - Optionnel, si non fourni sera récupéré depuis useAuthStore
       */
      loadAllRemainingProducts: async (companyId?: string) => {
        const { hasMore, loading } = get();

        // Si pas plus de produits ou déjà en chargement, ne rien faire
        if (!hasMore || loading) {
          console.log(
            "[loadAllRemainingProducts] Tous les produits sont déjà chargés ou chargement en cours",
          );
          return;
        }

        // Utiliser le companyId passé ou le récupérer depuis useAuthStore
        const targetCompanyId =
          companyId || useAuthStore.getState().currentCompanyId;
        if (!targetCompanyId) {
          console.error(
            "[loadAllRemainingProducts] Aucune compagnie sélectionnée",
          );
          return;
        }

        console.log(
          "[loadAllRemainingProducts] Début chargement automatique en arrière-plan",
        );

        let totalLoaded = 0;
        const startTime = performance.now();

        // Charger tant qu'il y a des produits
        while (get().hasMore && !get().loading) {
          const countBefore = get().products.length;
          await get().fetchProducts(targetCompanyId, { reset: false });
          const countAfter = get().products.length;
          totalLoaded += countAfter - countBefore;

          console.log(
            `[loadAllRemainingProducts] Progression: ${countAfter} produits chargés`,
          );
        }

        const endTime = performance.now();
        console.log(
          `[loadAllRemainingProducts] Terminé: ${get().products.length} produits chargés en ${((endTime - startTime) / 1000).toFixed(2)}s`,
        );
      },

      /**
       * Filtrer par entrepôt (filtre local, pas de rechargement)
       */
      setWarehouseFilter: (warehouseId) => {
        console.log("[setWarehouseFilter] Changement filtre entrepôt", {
          warehouseId,
        });
        set((state) => ({
          filters: { ...state.filters, warehouseId },
        }));
      },

      /**
       * Filtrer par catégorie (filtre local, pas de rechargement)
       */
      setCategoryFilter: (category) => {
        console.log("[setCategoryFilter] Changement filtre catégorie", {
          category,
        });
        set((state) => ({
          filters: { ...state.filters, category },
        }));
      },

      /**
       * Rechercher des produits (filtre local)
       */
      setSearchQuery: (query) => {
        console.log("[setSearchQuery] Changement recherche", { query });
        set((state) => ({
          filters: { ...state.filters, search: query },
        }));
      },

      /**
       * Filtrer par plage de prix
       */
      setPriceRangeFilter: (min, max) => {
        console.log("[setPriceRangeFilter] Changement filtre prix", {
          min,
          max,
        });
        set((state) => ({
          filters: { ...state.filters, minPrice: min, maxPrice: max },
        }));
      },

      /**
       * Effacer tous les filtres
       */
      clearFilters: () => {
        console.log("[clearFilters] Effacement filtres");
        set((state) => ({
          filters: {
            warehouseId: null,
            category: null,
            search: "",
            minPrice: null,
            maxPrice: null,
          },
        }));
      },

      /**
       * Optimistic CREATE - Ajouter un produit immédiatement
       */
      optimisticCreateProduct: (product) => {
        console.log("[optimisticCreateProduct] Ajout produit optimiste", {
          productId: product.id,
        });
        set((state) => ({
          products: [product, ...state.products],
        }));
      },

      /**
       * Optimistic UPDATE - Mettre à jour un produit immédiatement
       */
      optimisticUpdateProduct: (productId, updates) => {
        console.log("[optimisticUpdateProduct] Mise à jour optimiste", {
          productId,
          updates,
        });
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId ? { ...p, ...updates } : p,
          ),
        }));
      },

      /**
       * Optimistic DELETE - Supprimer un produit immédiatement
       */
      optimisticDeleteProduct: (productId) => {
        console.log("[optimisticDeleteProduct] Suppression optimiste", {
          productId,
        });
        set((state) => ({
          products: state.products.filter((p) => p.id !== productId),
        }));
      },

      /**
       * Synchroniser un produit avec Firestore (après optimistic update)
       */
      syncProduct: async (productId) => {
        const companyId = useAuthStore.getState().currentCompanyId;
        if (!companyId) {
          console.error("[syncProduct] Aucune compagnie sélectionnée");
          return;
        }

        console.log("[syncProduct] Synchronisation produit", { productId });

        try {
          const product = await productsApi.fetchProduct(companyId, productId);

          if (product) {
            set((state) => ({
              products: state.products.map((p) =>
                p.id === productId ? product : p,
              ),
            }));
            console.log("[syncProduct] Produit synchronisé", { productId });
          } else {
            // Produit supprimé, le retirer du store
            set((state) => ({
              products: state.products.filter((p) => p.id !== productId),
            }));
            console.log("[syncProduct] Produit retiré (supprimé)", {
              productId,
            });
          }
        } catch (error) {
          console.error("[syncProduct] Erreur synchronisation:", error);
        }
      },

      /**
       * Synchroniser les stock_locations pour plusieurs produits
       */
      syncProductsStockLocations: async (companyId, productIds) => {
        if (!companyId || productIds.length === 0) {
          return;
        }

        console.log(
          "[syncProductsStockLocations] Synchronisation stock_locations",
          {
            count: productIds.length,
          },
        );

        try {
          const locationsMap = await productsApi.fetchProductsStockLocations(
            companyId,
            productIds,
          );

          set((state) => ({
            stockLocationsMap: {
              ...state.stockLocationsMap,
              ...locationsMap,
            },
          }));

          console.log("[syncProductsStockLocations] Terminé", {
            productsUpdated: Object.keys(locationsMap).length,
          });
        } catch (error) {
          console.error("[syncProductsStockLocations] Erreur:", error);
        }
      },

      /**
       * Récupérer un produit par ID
       */
      getProductById: (productId) => {
        return get().products.find((p) => p.id === productId);
      },

      /**
       * Récupérer les produits filtrés (filtres locaux)
       */
      getFilteredProducts: () => {
        const { products, filters, stockLocationsMap } = get();
        let filtered = [...products];

        // Filtre par recherche (nom ou code)
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filtered = filtered.filter(
            (p) =>
              p.name.toLowerCase().includes(searchLower) ||
              p.code?.toLowerCase().includes(searchLower),
          );
        }

        // Filtre par catégorie
        if (filters.category) {
          filtered = filtered.filter((p) => p.category === filters.category);
        }

        // Filtre par plage de prix (utilise retailPrice comme prix de vente)
        if (filters.minPrice !== null) {
          filtered = filtered.filter((p) => p.retailPrice >= filters.minPrice!);
        }
        if (filters.maxPrice !== null) {
          filtered = filtered.filter((p) => p.retailPrice <= filters.maxPrice!);
        }

        // Filtre par entrepôt - C'est le filtre le plus complexe
        // On doit vérifier si le produit a du stock dans cet entrepôt
        if (filters.warehouseId) {
          filtered = filtered.filter((p) => {
            const locations = stockLocationsMap[p.id] || [];
            return locations.some(
              (l) => l.warehouseId === filters.warehouseId && l.quantity > 0,
            );
          });
        }

        return filtered;
      },

      /**
       * Récupérer le stock d'un produit dans un entrepôt spécifique
       */
      getProductStockInWarehouse: (productId, warehouseId) => {
        const { stockLocationsMap } = get();
        const locations = stockLocationsMap[productId] || [];
        const location = locations.find((l) => l.warehouseId === warehouseId);
        return location?.quantity || 0;
      },

      /**
       * Récupérer le stock à afficher pour un produit (tient compte du filtre d'entrepôt)
       * Si un filtre d'entrepôt est actif, retourne le stock dans cet entrepôt
       * Sinon, retourne le stock total du produit
       */
      getProductDisplayStock: (productId) => {
        const { filters, stockLocationsMap } = get();
        const product = get().products.find((p) => p.id === productId);

        if (!product) return 0;

        // Si un filtre d'entrepôt est actif, retourner le stock dans cet entrepôt
        if (filters.warehouseId) {
          const locations = stockLocationsMap[productId] || [];
          const location = locations.find(
            (l) => l.warehouseId === filters.warehouseId,
          );
          return location?.quantity || 0;
        }

        // Sinon, retourner le stock total du produit
        return product.currentStock;
      },

      /**
       * Vider tous les produits (déconnexion)
       */
      clearProducts: () => {
        console.log("[clearProducts] Vidage du store");
        set({
          products: [],
          stockLocationsMap: {},
          hasMore: true,
          lastLoadedAt: null,
          currentPage: 0,
          lastDoc: null,
        });
      },
    })),
    {
      name: "products-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        products: state.products,
        stockLocationsMap: state.stockLocationsMap,
        lastLoadedAt: state.lastLoadedAt,
      }),
    },
  ),
);

/**
 * Sélecteurs dérivés optimisés
 */
export const selectProducts = () =>
  useProductsStore.getState().getFilteredProducts();
export const selectProductById = (productId: string) =>
  useProductsStore.getState().getProductById(productId);

/**
 * Hooks pour utiliser le store avec des sélecteurs optimisés
 * NOTE: On utilise les produits bruts et on laisse le composant faire le filtrage
 * pour éviter les boucles infinies de re-render
 */
export const useProducts = () => useProductsStore((state) => state.products);
export const useProductsLoading = () =>
  useProductsStore((state) => state.loading);
export const useProductsError = () => useProductsStore((state) => state.error);
export const useProductsHasMore = () =>
  useProductsStore((state) => state.hasMore);
// NOTE: useProductsFilters supprimé car il cause des boucles infinies (objet qui change)

/**
 * Hook pour utiliser les actions du store sans provoquer de re-renders
 * ⚠️ IMPORTANT: Ne PAS utiliser de sélecteur qui retourne un objet!
 * On utilise getState() pour éviter les boucles infinies de re-render
 */
export const useProductsActions = () => {
  // Utiliser getState() au lieu d'un sélecteur pour éviter les boucles
  // Cela retourne le store complet sans s'abonner aux changements
  return useProductsStore.getState();
};

// Hook pour accéder à tout le store (actions + getters)
// ⚠️ ATTENTION: À utiliser avec précaution, peut causer des boucles infinies si utilisé dans useEffect/useMemo
export const useProductsStoreState = useProductsStore;

export default useProductsStore;

import { create } from "zustand";
import {
  subscribeWithSelector,
  persist,
  createJSONStorage,
} from "zustand/middleware";
import type { StockMovement } from "@/types";
import { useAuthStore } from "./useAuthStore";

/**
 * Filtres pour les mouvements de stock
 */
export interface StockMovementFilters {
  productId: string | null;
  warehouseId: string | null;
  type: string | null; // 'in', 'out', 'transfer' - renommé pour correspondre à StockMovement.type
  startDate: Date | null;
  endDate: Date | null;
}

/**
 * État du store mouvements de stock
 */
interface StockMovementsState {
  // Données
  movements: StockMovement[];

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
  filters: StockMovementFilters;

  // Actions de chargement
  fetchMovements: (options?: {
    reset?: boolean;
    pageSize?: number;
  }) => Promise<void>;
  loadMore: () => Promise<void>;
  refreshMovements: () => Promise<void>;

  // Actions de filtres
  setProductFilter: (productId: string | null) => void;
  setWarehouseFilter: (warehouseId: string | null) => void;
  setMovementTypeFilter: (type: string | null) => void;
  setDateRangeFilter: (startDate: Date | null, endDate: Date | null) => void;
  clearFilters: () => void;

  // Optimistic updates
  optimisticCreateMovement: (movement: StockMovement) => void;

  // Getters
  getMovementsByProduct: (productId: string) => StockMovement[];
  getMovementsByWarehouse: (warehouseId: string) => StockMovement[];
  getFilteredMovements: () => StockMovement[];
  clearMovements: () => void;
}

/**
 * Store mouvements de stock avec pagination et filtres
 *
 * Les mouvements de stock sont des données historiques qui ne changent jamais.
 * Une fois chargés, ils peuvent être mis en cache indéfiniment.
 */
export const useStockMovementsStore = create<StockMovementsState>()(
  persist(
    subscribeWithSelector((set, get) => ({
      // État initial
      movements: [],
      loading: false,
      error: null,
      hasMore: true,
      lastLoadedAt: null,
      currentPage: 0,
      pageSize: 50,
      lastDoc: null,
      filters: {
        productId: null,
        warehouseId: null,
        type: null,
        startDate: null,
        endDate: null,
      },

      /**
       * Charger les mouvements depuis Firestore
       */
      fetchMovements: async (options = {}) => {
        const { reset = false, pageSize = 50 } = options;
        const { filters, currentPage, lastDoc } = get();
        const companyId = useAuthStore.getState().currentCompanyId;

        if (!companyId) {
          console.error("[fetchMovements] Aucune compagnie sélectionnée");
          return;
        }

        set({ loading: true, error: null });

        const startTime = performance.now();
        console.log("[useStockMovementsStore] Début chargement mouvements", {
          companyId,
          page: reset ? 0 : currentPage,
          pageSize,
          filters,
        });

        try {
          // Note: Pour l'instant on n'a pas de couche d'abstraction pour les stock movements
          // TODO: Créer lib/firestore/stockMovements.ts
          // Pour l'instant, on simule avec un tableau vide

          const endTime = performance.now();
          console.log("[useStockMovementsStore] Chargement terminé", {
            count: 0,
            hasMore: false,
            duration: `${(endTime - startTime).toFixed(0)}ms`,
          });

          set({
            movements: [],
            hasMore: false,
            loading: false,
            lastLoadedAt: Date.now(),
            currentPage: reset ? 0 : currentPage + 1,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Erreur inconnue lors du chargement";
          console.error("[useStockMovementsStore] Erreur chargement:", error);

          set({
            error: errorMessage,
            loading: false,
          });
        }
      },

      /**
       * Charger plus de mouvements (pagination)
       */
      loadMore: async () => {
        const { hasMore, loading } = get();

        if (!hasMore || loading) {
          console.log(
            "[loadMore] Pas plus de mouvements ou chargement en cours",
          );
          return;
        }

        console.log("[loadMore] Chargement page suivante");
        await get().fetchMovements({ reset: false });
      },

      /**
       * Rafraîchir tous les mouvements
       */
      refreshMovements: async () => {
        console.log("[refreshMovements] Rafraîchissement complet");
        await get().fetchMovements({ reset: true });
      },

      /**
       * Filtrer par produit (filtre local)
       */
      setProductFilter: (productId) => {
        console.log("[setProductFilter] Changement filtre produit", {
          productId,
        });
        set((state) => ({
          filters: { ...state.filters, productId },
        }));
      },

      /**
       * Filtrer par entrepôt (filtre local)
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
       * Filtrer par type de mouvement (filtre local)
       */
      setMovementTypeFilter: (type) => {
        console.log("[setMovementTypeFilter] Changement filtre type", { type });
        set((state) => ({
          filters: { ...state.filters, type: type },
        }));
      },

      /**
       * Filtrer par plage de dates (filtre local)
       */
      setDateRangeFilter: (startDate, endDate) => {
        console.log("[setDateRangeFilter] Changement filtre dates", {
          startDate,
          endDate,
        });
        set((state) => ({
          filters: { ...state.filters, startDate, endDate },
        }));
      },

      /**
       * Effacer tous les filtres
       */
      clearFilters: () => {
        console.log("[clearFilters] Effacement filtres");
        set((state) => ({
          filters: {
            productId: null,
            warehouseId: null,
            type: null,
            startDate: null,
            endDate: null,
          },
        }));
      },

      /**
       * Optimistic CREATE - Ajouter un mouvement immédiatement
       */
      optimisticCreateMovement: (movement) => {
        console.log("[optimisticCreateMovement] Ajout mouvement optimiste", {
          movementId: movement.id,
        });
        set((state) => ({
          movements: [movement, ...state.movements],
        }));
      },

      /**
       * Récupérer les mouvements d'un produit
       */
      getMovementsByProduct: (productId) => {
        const { movements } = get();
        return movements.filter((m) => m.productId === productId);
      },

      /**
       * Récupérer les mouvements d'un entrepôt
       */
      getMovementsByWarehouse: (warehouseId) => {
        const { movements } = get();
        return movements.filter((m) => m.warehouseId === warehouseId);
      },

      /**
       * Récupérer les mouvements filtrés (filtres locaux)
       */
      getFilteredMovements: () => {
        const { movements, filters } = get();
        let filtered: StockMovement[] = [...movements];

        // Filtre par produit
        if (filters.productId) {
          filtered = filtered.filter((m) => m.productId === filters.productId);
        }

        // Filtre par entrepôt
        if (filters.warehouseId) {
          filtered = filtered.filter(
            (m) => m.warehouseId === filters.warehouseId,
          );
        }

        // Filtre par type de mouvement
        if (filters.type) {
          filtered = filtered.filter((m) => m.type === filters.type);
        }

        // Helper pour convertir createdAt en Date
        const getDate = (movement: StockMovement): Date => {
          const createdAt = movement.createdAt;
          if (createdAt instanceof Date) {
            return createdAt;
          }
          // Cast pour Timestamp Firebase qui a une méthode toDate()
          return (createdAt as any).toDate();
        };

        // Filtre par plage de dates
        if (filters.startDate) {
          filtered = filtered.filter(
            (movement: StockMovement) =>
              getDate(movement) >= filters.startDate!,
          );
        }

        if (filters.endDate) {
          filtered = filtered.filter(
            (movement: StockMovement) => getDate(movement) <= filters.endDate!,
          );
        }

        return filtered;
      },

      /**
       * Vider tous les mouvements
       */
      clearMovements: () => {
        console.log("[clearMovements] Vidage du store");
        set({
          movements: [],
          hasMore: true,
          lastLoadedAt: null,
          currentPage: 0,
          lastDoc: null,
        });
      },
    })),
    {
      name: "stock-movements-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        movements: state.movements,
        lastLoadedAt: state.lastLoadedAt,
      }),
    },
  ),
);

/**
 * Sélecteurs dérivés optimisés
 */
export const selectMovements = () =>
  useStockMovementsStore.getState().getFilteredMovements();

/**
 * Hooks pour utiliser le store
 */
export const useStockMovements = () =>
  useStockMovementsStore((state) => state.movements);
export const useStockMovementsLoading = () =>
  useStockMovementsStore((state) => state.loading);
export const useStockMovementsError = () =>
  useStockMovementsStore((state) => state.error);
export const useStockMovementsActions = () =>
  useStockMovementsStore((state) => ({
    fetchMovements: state.fetchMovements,
    loadMore: state.loadMore,
    refreshMovements: state.refreshMovements,
    setProductFilter: state.setProductFilter,
    setWarehouseFilter: state.setWarehouseFilter,
    setMovementTypeFilter: state.setMovementTypeFilter,
    setDateRangeFilter: state.setDateRangeFilter,
    clearFilters: state.clearFilters,
    optimisticCreateMovement: state.optimisticCreateMovement,
    getFilteredMovements: state.getFilteredMovements,
    clearMovements: state.clearMovements,
  }));

export default useStockMovementsStore;

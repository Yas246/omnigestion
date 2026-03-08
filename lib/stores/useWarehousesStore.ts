import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Warehouse } from '@/types';

/**
 * État du store dépôts
 *
 * Les dépôts sont des données relativement statiques,
 * on peut donc les mettre en cache plus longtemps.
 */
interface WarehousesState {
  // Données
  warehouses: Warehouse[];

  // État de chargement
  loading: boolean;
  error: string | null;
  lastLoadedAt: number | null;

  // Actions
  setWarehouses: (warehouses: Warehouse[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearWarehouses: () => void;

  // Getters
  getWarehouseById: (warehouseId: string) => Warehouse | undefined;
  getPrimaryWarehouse: () => Warehouse | undefined;
}

/**
 * Store dépôts avec persistance localStorage
 *
 * Les dépôts changent rarement, donc on peut les mettre en cache localement
 */
export const useWarehousesStore = create<WarehousesState>()(
  persist(
    (set, get) => ({
      // État initial
      warehouses: [],
      loading: false,
      error: null,
      lastLoadedAt: null,

      /**
       * Définir les dépôts
       */
      setWarehouses: (warehouses) => {
        console.log('[setWarehouses] Mise à jour dépôts', { count: warehouses.length });
        set({
          warehouses,
          lastLoadedAt: Date.now(),
        });
      },

      /**
       * Définir l'état de chargement
       */
      setLoading: (loading) => {
        set({ loading });
      },

      /**
       * Définir une erreur
       */
      setError: (error) => {
        set({ error });
      },

      /**
       * Vider tous les dépôts
       */
      clearWarehouses: () => {
        console.log('[clearWarehouses] Vidage du store');
        set({
          warehouses: [],
          lastLoadedAt: null,
        });
      },

      /**
       * Récupérer un dépôt par ID
       */
      getWarehouseById: (warehouseId) => {
        return get().warehouses.find((w) => w.id === warehouseId);
      },

      /**
       * Récupérer le dépôt principal (marqué comme isPrimary)
       */
      getPrimaryWarehouse: () => {
        return get().warehouses.find((w) => w.isPrimary);
      },
    }),
    {
      name: 'warehouses-storage', // Clé localStorage
      // Persister seulement les données, pas l'état de chargement
      partialize: (state) => ({
        warehouses: state.warehouses,
        lastLoadedAt: state.lastLoadedAt,
      }),
    }
  )
);

/**
 * Sélecteurs dérivés
 */
export const selectWarehouses = () => useWarehousesStore.getState().warehouses;
export const selectWarehouseById = (warehouseId: string) =>
  useWarehousesStore.getState().getWarehouseById(warehouseId);
export const selectPrimaryWarehouse = () => useWarehousesStore.getState().getPrimaryWarehouse();

/**
 * Hooks pour utiliser le store
 */
export const useWarehouses = () => useWarehousesStore((state) => state.warehouses);
export const useWarehousesLoading = () => useWarehousesStore((state) => state.loading);
export const usePrimaryWarehouse = () =>
  useWarehousesStore((state) => state.getPrimaryWarehouse());

export default useWarehousesStore;

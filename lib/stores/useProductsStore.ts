import { create } from "zustand";

/**
 * Product filters store (Zustand) — ONLY the filters slice survives the
 * Firebase purge. The old CRUD/data-fetch methods used Firestore; they're gone
 * (React Query hooks handle all data now). This store just holds the active
 * warehouse/category/search/price filters consumed by the stock page +
 * useProductDisplayStock.
 */

export interface ProductFilters {
  warehouseId: string | null;
  category: string | null;
  search: string;
  minPrice: number | null;
  maxPrice: number | null;
}

interface ProductStoreState {
  filters: ProductFilters;
  setWarehouseFilter: (warehouseId: string | null) => void;
  setCategoryFilter: (category: string | null) => void;
  setSearchQuery: (query: string) => void;
  setPriceRangeFilter: (min: number | null, max: number | null) => void;
  clearFilters: () => void;
}

export const useProductsStore = create<ProductStoreState>((set) => ({
  filters: {
    warehouseId: null,
    category: null,
    search: "",
    minPrice: null,
    maxPrice: null,
  },
  setWarehouseFilter: (warehouseId) =>
    set((state) => ({ filters: { ...state.filters, warehouseId } })),
  setCategoryFilter: (category) =>
    set((state) => ({ filters: { ...state.filters, category } })),
  setSearchQuery: (search) =>
    set((state) => ({ filters: { ...state.filters, search } })),
  setPriceRangeFilter: (minPrice, maxPrice) =>
    set((state) => ({ filters: { ...state.filters, minPrice, maxPrice } })),
  clearFilters: () =>
    set({
      filters: {
        warehouseId: null,
        category: null,
        search: "",
        minPrice: null,
        maxPrice: null,
      },
    }),
}));

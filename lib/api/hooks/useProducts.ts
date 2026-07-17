'use client';

/**
 * Products (catalog) — API-backed.
 *  - useProductsRealtime() -> { products, isLoading }
 *  - useProducts()         -> { createProduct, updateProduct, deleteProduct }
 * Prices are BIGINT -> Number().
 */
import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Product } from '@/types';
import { useProductsStore } from '@/lib/stores/useProductsStore';

interface ProductDto {
  id: number;
  companyId: number;
  name: string;
  code: string | null;
  category: string | null;
  description: string | null;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  wholesaleThreshold: number;
  currentStock: number;
  alertThreshold: number;
  status: string;
  warehouseId: number | null;
  unit: string | null;
  warehouseQuantities?: Array<{ warehouseId: string; warehouseName: string; quantity: number }>;
  displayQuantity?: number;
  isActive: boolean;
  published: boolean;
  mainImageUrl: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

function mapProduct(p: ProductDto): Product {
  return {
    id: String(p.id),
    companyId: String(p.companyId),
    name: p.name,
    code: p.code ?? undefined,
    category: p.category ?? undefined,
    description: p.description ?? undefined,
    purchasePrice: Number(p.purchasePrice),
    retailPrice: Number(p.retailPrice),
    wholesalePrice: Number(p.wholesalePrice),
    wholesaleThreshold: p.wholesaleThreshold,
    currentStock: p.currentStock,
    alertThreshold: p.alertThreshold,
    status: p.status as any,
    warehouseId: p.warehouseId ? String(p.warehouseId) : undefined,
    unit: p.unit ?? undefined,
    warehouseQuantities: p.warehouseQuantities ?? [],
    displayQuantity: p.displayQuantity ?? p.currentStock,
    isActive: p.isActive,
    published: p.published,
    mainImageUrl: p.mainImageUrl ?? undefined,
    createdAt: new Date(p.createdAt),
    updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
  } as Product;
}

const KEY = ['products'] as const;

export function useProductsRealtime() {
  const q = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api.get<{ data: ProductDto[] } | ProductDto[]>('/products?limit=500');
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return (arr as ProductDto[]).map(mapProduct);
    },
  });
  return { products: q.data ?? [], isLoading: q.isLoading, error: q.error as Error | null };
}

export function useProducts() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const createMutation = useMutation({
    mutationFn: async (data: any) =>
      api.post('/products', {
        ...data,
        purchasePrice: Number(data.purchasePrice),
        retailPrice: Number(data.retailPrice),
        wholesalePrice: data.wholesalePrice != null ? Number(data.wholesalePrice) : undefined,
        wholesaleThreshold: data.wholesaleThreshold != null ? Number(data.wholesaleThreshold) : undefined,
        alertThreshold: data.alertThreshold != null ? Number(data.alertThreshold) : undefined,
        warehouseId: data.warehouseId ? Number(data.warehouseId) : undefined,
      }),
    onSuccess: invalidate,
  });
  const updateMutation = useMutation({
    mutationFn: async (p: { id: string; data: any }) => api.put(`/products/${p.id}`, p.data),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({ mutationFn: async (id: string) => api.del(`/products/${id}`), onSuccess: invalidate });

  return {
    createProduct: (data: any) => createMutation.mutateAsync(data),
    updateProduct: (id: string, data: any) => updateMutation.mutateAsync({ id, data }),
    deleteProduct: (id: string) => deleteMutation.mutateAsync(id),
  };
}

/**
 * Computes the display stock for a product based on warehouseQuantities + the
 * active warehouse filter (from useProductsStore). Mirrors the old hook's logic.
 */
export function useProductDisplayStock() {
  const filters = useProductsStore((state: any) => state.filters);
  const getDisplayStock = useCallback((product: any): number => {
    const wq = product.warehouseQuantities;
    if (!wq || wq.length === 0) return Number(product.currentStock) ?? 0;
    if (filters.warehouseId) {
      const found = wq.find((q: any) => q.warehouseId === String(filters.warehouseId));
      return found ? Number(found.quantity) : 0;
    }
    return wq.reduce((sum: number, q: any) => sum + Number(q.quantity), 0);
  }, [filters.warehouseId]);
  return { getDisplayStock };
}

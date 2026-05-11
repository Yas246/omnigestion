'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase';
import { useAuth } from './useAuth';
import { useSettings } from './useSettings';
import { getStockStatus } from '@/lib/utils/stock';
import type { Product } from '@/types';

export function useProducts() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsWithStock, setProductsWithStock] = useState<Array<Product & { warehouseQuantities?: { warehouseId: string; quantity: number }[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCacheLoaded, setIsCacheLoaded] = useState(false);

  /**
   * Charge tous les produits depuis Firestore (sans pagination)
   */
  const fetchAllProducts = async (): Promise<Product[]> => {
    if (!user?.currentCompanyId) return [];

    console.log('[useProducts] fetchAllProducts: loading all products from Firestore');

    const q = query(
      collection(db, COLLECTIONS.companyProducts(user.currentCompanyId)),
      orderBy('name')
    );

    const snapshot = await getDocs(q);
    const productsData = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Product)
    );

    // Trier par nom pour garantir l'ordre alphabétique (même si orderBy est utilisé)
    productsData.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

    console.log('[useProducts] fetchAllProducts: loaded', productsData.length, 'products');

    return productsData;
  };

  /**
   * Charge les produits (toujours depuis Firestore)
   */
  const fetchProducts = useCallback(async (forceRefresh = false) => {
    if (!user?.currentCompanyId) return;

    setLoading(true);
    setError(null);

    try {
      // Toujours charger depuis Firestore (plus de cache)
      const productsData = await fetchAllProducts();

      setProducts(productsData);
    } catch (err) {
      console.error('Erreur lors du chargement des produits:', err);
      setError('Erreur lors du chargement des produits');
    } finally {
      setLoading(false);
    }
  }, [user?.currentCompanyId]);

  // Charger les produits au démarrage
  useEffect(() => {
    if (user?.currentCompanyId) {
      fetchProducts();
    }
  }, [user?.currentCompanyId, fetchProducts]);

  /**
   * Récupère un produit par ID (depuis Firestore)
   */
  const getProduct = async (id: string): Promise<Product | null> => {
    if (!user?.currentCompanyId) return null;

    try {
      // Charger depuis Firestore
      const docRef = doc(db, COLLECTIONS.companyProducts(user.currentCompanyId), id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Product;
      }
      return null;
    } catch (err) {
      console.error('Erreur lors du chargement du produit:', err);
      return null;
    }
  };

  /**
   * Crée un nouveau produit
   */
  const createProduct = async (data: Omit<Product, 'id' | 'companyId' | 'warehouseId' | 'status' | 'createdAt' | 'updatedAt'> & { stockAllocations?: Array<{ warehouseId: string; quantity: number }> }) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const { stockAllocations, ...productData } = data;

      // Récupérer le nombre de produits pour générer le code
      const productsSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.companyProducts(user.currentCompanyId)))
      );

      const productCount = productsSnapshot.size;
      const code = `PRD-${String(productCount + 1).padStart(3, '0')}`;

      const defaultWarehouseId = settings?.stock?.defaultWarehouseId || null;

      const status = getStockStatus(productData.currentStock, productData.alertThreshold);

      const docRef = await addDoc(collection(db, COLLECTIONS.companyProducts(user.currentCompanyId)), {
        ...productData,
        code,
        warehouseId: stockAllocations && stockAllocations.length > 0 ? stockAllocations[0].warehouseId : defaultWarehouseId,
        status,
        companyId: user.currentCompanyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const productId = docRef.id;

      // Créer les warehouse_quantities si en mode avancé
      if (stockAllocations && stockAllocations.length > 0) {
        await runTransaction(db, async (transaction) => {
          const warehouseQuantitiesRef = doc(
            db,
            `companies/${user.currentCompanyId}/warehouse_quantities`,
            productId
          );

          transaction.set(warehouseQuantitiesRef, {
            productId,
            quantities: stockAllocations.map(a => ({
              warehouseId: a.warehouseId,
              warehouseName: a.warehouseId,
              quantity: a.quantity,
            })),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      } else if (defaultWarehouseId) {
        await runTransaction(db, async (transaction) => {
          const warehouseQuantitiesRef = doc(
            db,
            `companies/${user.currentCompanyId}/warehouse_quantities`,
            productId
          );

          transaction.set(warehouseQuantitiesRef, {
            productId,
            quantities: [{
              warehouseId: defaultWarehouseId,
              warehouseName: defaultWarehouseId,
              quantity: productData.currentStock,
            }],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      }

      const newProduct: Product = {
        id: productId,
        ...productData,
        code,
        warehouseId: stockAllocations && stockAllocations.length > 0 ? stockAllocations[0].warehouseId : defaultWarehouseId || undefined,
        status,
        companyId: user.currentCompanyId,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };

      // Mettre à jour le state
      setProducts((prev) => [newProduct, ...prev]);

      return newProduct;
    } catch (err) {
      console.error('Erreur lors de la création du produit:', err);
      throw new Error('Erreur lors de la création du produit');
    }
  };

  /**
   * Met à jour un produit
   */
  const updateProduct = async (id: string, data: Partial<Product> & { stockAllocations?: Array<{ warehouseId: string; quantity: number }> }) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const { stockAllocations, ...productData } = data;

      let status: 'ok' | 'low' | 'out' | undefined;
      if (productData.currentStock !== undefined || productData.alertThreshold !== undefined) {
        const product = products.find((p) => p.id === id);
        if (product) {
          const currentStock = productData.currentStock ?? product.currentStock;
          const alertThreshold = productData.alertThreshold ?? product.alertThreshold;
          status = getStockStatus(currentStock, alertThreshold);
        }
      }

      const productRef = doc(db, COLLECTIONS.companyProducts(user.currentCompanyId), id);
      await updateDoc(productRef, {
        ...productData,
        ...(status && { status }),
        updatedAt: new Date(),
      });

      const updatedProduct = { ...products.find(p => p.id === id)!, ...productData, ...(status && { status }), updatedAt: new Date() as any };

      // Mettre à jour le state
      setProducts((prev) => prev.map((p) => (p.id === id ? updatedProduct : p)));

      // ===== NOUVEAU: Envoyer notification si stock faible ou épuisé =====
      if (status === 'out' || status === 'low') {
        try {
          const { notifyOutOfStock, notifyLowStock } = await import('@/lib/services/notifications');

          if (status === 'out') {
            await notifyOutOfStock({
              productId: id,
              productName: updatedProduct.name,
            }, user.currentCompanyId);
            console.log('[updateProduct] Alerte de rupture envoyée');
          } else {
            await notifyLowStock({
              productId: id,
              productName: updatedProduct.name,
              currentStock: updatedProduct.currentStock,
              threshold: updatedProduct.alertThreshold,
            }, user.currentCompanyId);
            console.log('[updateProduct] Alerte de stock faible envoyée');
          }
        } catch (notifError) {
          console.error('[updateProduct] Erreur lors de l\'envoi de la notification:', notifError);
          // Ne pas échouer la mise à jour si la notification échoue
        }
      }
    } catch (err) {
      console.error('Erreur lors de la mise à jour du produit:', err);
      throw new Error('Erreur lors de la mise à jour du produit');
    }
  };

  /**
   * Supprime un produit
   */
  const deleteProduct = async (id: string) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      await deleteDoc(doc(db, COLLECTIONS.companyProducts(user.currentCompanyId), id));

      // Mettre à jour le state
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Erreur lors de la suppression du produit:', err);
      throw new Error('Erreur lors de la suppression du produit');
    }
  };

  /**
   * Filtre les produits par dépôt avec leurs quantités
   */
  const filterByWarehouse = async (warehouseId: string | null) => {
    if (!user?.currentCompanyId) return products;

    if (!warehouseId) {
      const productsWithQuantities = await fetchProductStockLocations(products);
      setProductsWithStock(productsWithQuantities);

      const result = productsWithQuantities.map((p) => {
        // Calculer la somme des quantités par dépôt
        const totalFromStockLocations = p.warehouseQuantities?.reduce((sum: number, wq: any) => sum + wq.quantity, 0) || 0;

        // Utiliser la somme SI elle existe et est > 0, sinon utiliser currentStock
        const displayQuantity = totalFromStockLocations > 0 ? totalFromStockLocations : p.currentStock;

        console.log(`[filterByWarehouse] ${p.name}: currentStock=${p.currentStock}, totalFromStockLocations=${totalFromStockLocations}, displayQuantity=${displayQuantity}`);

        return {
          ...p,
          displayQuantity,
        };
      });

      return result;
    }

    const filtered = await Promise.all(
      products.map(async (product) => {
        try {
          const wqRef = doc(db, `companies/${user.currentCompanyId}/warehouse_quantities`, product.id);
          const wqSnap = await getDoc(wqRef);

          if (wqSnap.exists()) {
            const quantities = wqSnap.data().quantities || [];
            const entry = quantities.find((q: any) => q.warehouseId === warehouseId);
            if (entry && entry.quantity > 0) {
              return {
                ...product,
                displayQuantity: entry.quantity,
              };
            }
          }

          return null;
        } catch {
          return product.warehouseId === warehouseId ? product : null;
        }
      })
    );

    return filtered.filter((p) => p !== null) as Array<Product & { displayQuantity: number }>;
  };

  /**
   * Recherche côté client (depuis les produits en mémoire)
   */
  const searchProducts = async (searchTerm: string) => {
    if (!user?.currentCompanyId) return;

    if (!searchTerm.trim()) {
      // Recherche vide, ne rien faire (les produits sont déjà là)
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = products.filter(
      (p) =>
        p.name.toLowerCase().includes(searchLower) ||
        (p.code && p.code.toLowerCase().includes(searchLower)) ||
        (p.category && p.category.toLowerCase().includes(searchLower))
    );

    // Mettre à jour l'affichage mais pas le state principal
    return filtered;
  };

  /**
   * Recharge tous les produits depuis Firestore
   */
  const resetSearch = async () => {
    await fetchProducts(true);
  };

  /**
   * Charge les répartitions de stock pour les produits
   */
  const fetchProductStockLocations = async (productsToLoad: Product[]) => {
    if (!user?.currentCompanyId || productsToLoad.length === 0) return productsToLoad;

    try {
      console.log('[fetchProductStockLocations] Chargement pour', productsToLoad.length, 'produits');

      const productWithStock = await Promise.all(
        productsToLoad.map(async (product) => {
          try {
            const wqRef = doc(db, `companies/${user.currentCompanyId}/warehouse_quantities`, product.id);
            const wqSnap = await getDoc(wqRef);

            const warehouseQuantities = wqSnap.exists()
              ? (wqSnap.data().quantities || [])
              : [];

            const totalQuantity = warehouseQuantities.reduce((sum: number, wq: any) => sum + wq.quantity, 0);
            console.log(`[fetchProductStockLocations] ${product.name}: Somme = ${totalQuantity} (${warehouseQuantities.map((w: any) => `${w.warehouseName}: ${w.quantity}`).join(', ')})`);

            return { ...product, warehouseQuantities };
          } catch (err) {
            console.error(`[fetchProductStockLocations] Erreur pour ${product.name}:`, err);
            return { ...product, warehouseQuantities: [] };
          }
        })
      );

      return productWithStock;
    } catch (err) {
      console.error('[fetchProductStockLocations] Erreur globale:', err);
      return productsToLoad.map(p => ({ ...p, warehouseQuantities: [] }));
    }
  };

  return {
    products,
    productsWithStock,
    loading,
    error,
    hasMore: false, // Plus de pagination côté serveur
    fetchProducts,
    loadMore: () => {}, // Plus de pagination
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    searchProducts,
    resetSearch,
    filterByWarehouse,
  };
}

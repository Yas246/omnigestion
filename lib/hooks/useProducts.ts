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
} from 'firebase/firestore';
import { db, COLLECTIONS, SUB_COLLECTIONS } from '@/lib/firebase';
import { useAuth } from './useAuth';
import { useSettings } from './useSettings';
import { productsCache } from '@/lib/indexeddb/db';
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

    console.log('[useProducts] fetchAllProducts: loaded', productsData.length, 'products');

    // Sauvegarder dans IndexedDB
    await productsCache.setProducts(productsData);

    return productsData;
  };

  /**
   * Charge les produits depuis IndexedDB
   */
  const loadFromCache = async (): Promise<Product[] | null> => {
    if (!user?.currentCompanyId) return null;

    console.log('[useProducts] loadFromCache: loading from IndexedDB');

    const cachedProducts = await productsCache.getProductsByCompany(user.currentCompanyId);

    if (cachedProducts.length === 0) {
      console.log('[useProducts] loadFromCache: cache empty');
      return null;
    }

    console.log('[useProducts] loadFromCache: loaded', cachedProducts.length, 'products from cache');
    return cachedProducts;
  };

  /**
   * Charge les produits (avec gestion du cache)
   */
  const fetchProducts = useCallback(async (forceRefresh = false) => {
    if (!user?.currentCompanyId) return;

    setLoading(true);
    setError(null);

    try {
      let productsData: Product[];

      if (!forceRefresh) {
        // Essayer de charger depuis le cache
        const cached = await loadFromCache();

        // Vérifier si le cache est périmé
        const isExpired = await productsCache.isCacheExpired(user.currentCompanyId);

        if (cached && !isExpired) {
          // Cache valide, l'utiliser
          productsData = cached;
          console.log('[useProducts] fetchProducts: using cache (', productsData.length, 'products)');
        } else {
          // Cache périmé ou vide, recharger depuis Firestore
          productsData = await fetchAllProducts();
        }
      } else {
        // Force refresh, charger depuis Firestore
        productsData = await fetchAllProducts();
      }

      setProducts(productsData);
      setIsCacheLoaded(true);
    } catch (err) {
      console.error('Erreur lors du chargement des produits:', err);
      setError('Erreur lors du chargement des produits');
    } finally {
      setLoading(false);
    }
  }, [user?.currentCompanyId]);

  // Charger les produits au démarrage
  useEffect(() => {
    if (user?.currentCompanyId && !isCacheLoaded) {
      fetchProducts();
    }
  }, [user?.currentCompanyId, isCacheLoaded, fetchProducts]);

  // ===== NOUVEAU: Écouter les mises à jour du cache IndexedDB =====
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `products_updated_${user?.currentCompanyId}`) {
        console.log('[useProducts] Cache updated event received, reloading from cache');
        // Recharger depuis le cache IndexedDB qui vient d'être mis à jour
        loadFromCache().then((cached) => {
          if (cached) {
            setProducts(cached);
          }
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user?.currentCompanyId]);

  /**
   * Récupère un produit par ID (depuis le cache ou Firestore)
   */
  const getProduct = async (id: string): Promise<Product | null> => {
    if (!user?.currentCompanyId) return null;

    try {
      // Essayer le cache d'abord
      const cached = await productsCache.getProductById(id);
      if (cached) {
        return cached;
      }

      // Sinon, charger depuis Firestore
      const docRef = doc(db, COLLECTIONS.companyProducts(user.currentCompanyId), id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const product = { id: docSnap.id, ...docSnap.data() } as Product;
        // Mettre en cache
        await productsCache.upsertProduct(product);
        return product;
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

      const status: 'ok' | 'low' | 'out' =
        productData.currentStock === 0 ? 'out' :
        productData.currentStock <= productData.alertThreshold ? 'low' : 'ok';

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

      // Créer les répartitions de stock si en mode avancé
      if (stockAllocations && stockAllocations.length > 0) {
        for (const allocation of stockAllocations) {
          await addDoc(
            collection(db, SUB_COLLECTIONS.productStockLocations(user.currentCompanyId, productId)),
            {
              productId,
              warehouseId: allocation.warehouseId,
              quantity: allocation.quantity,
              alertThreshold: productData.alertThreshold,
              updatedAt: new Date(),
            }
          );
        }
      } else if (defaultWarehouseId) {
        await addDoc(
          collection(db, SUB_COLLECTIONS.productStockLocations(user.currentCompanyId, productId)),
          {
            productId,
            warehouseId: defaultWarehouseId,
            quantity: productData.currentStock,
            alertThreshold: productData.alertThreshold,
            updatedAt: new Date(),
          }
        );
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

      // Mettre à jour le state et le cache
      setProducts((prev) => [newProduct, ...prev]);
      await productsCache.upsertProduct(newProduct);

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
          status =
            currentStock === 0 ? 'out' :
            currentStock <= alertThreshold ? 'low' : 'ok';
        }
      }

      const productRef = doc(db, COLLECTIONS.companyProducts(user.currentCompanyId), id);
      await updateDoc(productRef, {
        ...productData,
        ...(status && { status }),
        updatedAt: new Date(),
      });

      const updatedProduct = { ...products.find(p => p.id === id)!, ...productData, ...(status && { status }), updatedAt: new Date() as any };

      // Mettre à jour le state et le cache
      setProducts((prev) => prev.map((p) => (p.id === id ? updatedProduct : p)));
      await productsCache.upsertProduct(updatedProduct);

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

      // Mettre à jour le state et le cache
      setProducts((prev) => prev.filter((p) => p.id !== id));
      await productsCache.deleteProduct(id);
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
      return productsWithQuantities.map((p, index) => ({
        ...p,
        displayQuantity: p.warehouseQuantities?.reduce((sum, wq) => sum + wq.quantity, 0) || p.currentStock,
      }));
    }

    const filtered = await Promise.all(
      products.map(async (product) => {
        try {
          const stockSnapshot = await getDocs(
            query(
              collection(db, SUB_COLLECTIONS.productStockLocations(user.currentCompanyId, product.id)),
              where('warehouseId', '==', warehouseId)
            )
          );

          if (!stockSnapshot.empty) {
            const quantity = stockSnapshot.docs.reduce((sum, doc) => sum + doc.data().quantity, 0);
            return {
              ...product,
              displayQuantity: quantity,
            };
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
      const warehousesSnapshot = await getDocs(
        collection(db, COLLECTIONS.companyWarehouses(user.currentCompanyId))
      );
      const warehousesMap = new Map(
        warehousesSnapshot.docs.map(doc => [doc.id, doc.data()])
      );

      const productWithStock = await Promise.all(
        productsToLoad.map(async (product) => {
          try {
            const stockSnapshot = await getDocs(
              query(
                collection(db, SUB_COLLECTIONS.productStockLocations(user.currentCompanyId, product.id))
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

            return { ...product, warehouseQuantities };
          } catch {
            return { ...product, warehouseQuantities: [] };
          }
        })
      );

      return productWithStock;
    } catch (err) {
      console.error('Erreur lors du chargement des répartitions:', err);
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

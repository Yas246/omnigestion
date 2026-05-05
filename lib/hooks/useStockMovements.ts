'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase';
import { useAuth } from './useAuth';
import { productsCache } from '@/lib/indexeddb/db';
import type { StockMovement, Product } from '@/types';

const MOVEMENTS_PER_PAGE = 50;

export function useStockMovements() {
  const { user } = useAuth();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);

  useEffect(() => {
    if (user?.currentCompanyId) {
      fetchMovements();
    }
  }, [user]);

  const fetchMovements = async (reset = true) => {
    if (!user?.currentCompanyId) return;

    if (reset) {
      setLoading(true);
      setLastDoc(null);
    }

    setError(null);

    try {
      let q = query(
        collection(db, COLLECTIONS.companyStockMovements(user.currentCompanyId)),
        orderBy('createdAt', 'desc'),
        limit(MOVEMENTS_PER_PAGE)
      );

      if (!reset && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      const movementsData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() || new Date() } as StockMovement)
      );

      if (reset) {
        setMovements(movementsData);
      } else {
        setMovements((prev) => [...prev, ...movementsData]);
      }

      setHasMore(movementsData.length === MOVEMENTS_PER_PAGE);
      if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
    } catch (err) {
      console.error('Erreur lors du chargement des mouvements:', err);
      setError('Erreur lors du chargement des mouvements');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchMovements(false);
    }
  };

  /**
   * Transférer du stock d'un dépôt à un autre
   */
  const transferStock = async (params: {
    productId: string;
    product: Product;
    fromWarehouseId: string;
    toWarehouseId: string;
    quantity: number;
    reason?: string;
  }) => {
    const { productId, product, fromWarehouseId, toWarehouseId, quantity, reason } = params;

    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');
    if (quantity <= 0) throw new Error('La quantité doit être supérieure à 0');
    if (fromWarehouseId === toWarehouseId) throw new Error('Les dépôts source et destination doivent être différents');

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Lire warehouse_quantities pour le produit
        const warehouseQuantitiesRef = doc(
          db,
          `companies/${user.currentCompanyId}/warehouse_quantities`,
          productId
        );
        const warehouseQuantitiesDoc = await getDoc(warehouseQuantitiesRef);

        let quantities: any[] = [];
        if (warehouseQuantitiesDoc.exists()) {
          quantities = warehouseQuantitiesDoc.data().quantities || [];
        }

        // 2. Vérifier stock source
        const fromEntry = quantities.find((q: any) => q.warehouseId === fromWarehouseId);
        const fromQuantity = fromEntry?.quantity || 0;

        if (fromQuantity < quantity) {
          throw new Error(`Stock insuffisant dans le dépôt source (${fromQuantity} ${product.unit} disponibles)`);
        }

        const newFromQuantity = fromQuantity - quantity;

        // 3. Calculer nouvelle quantité destination
        const toEntry = quantities.find((q: any) => q.warehouseId === toWarehouseId);
        const newToQuantity = (toEntry?.quantity || 0) + quantity;

        // Stock total (ne change pas pour un transfert)
        const transferTotal = quantities.reduce((sum: number, q: any) => sum + q.quantity, 0);

        // 4. Mettre à jour les quantités pour les deux dépôts
        const updatedQuantities = quantities.map((q: any) => {
          if (q.warehouseId === fromWarehouseId) {
            return { ...q, quantity: newFromQuantity };
          }
          if (q.warehouseId === toWarehouseId) {
            return { ...q, quantity: newToQuantity };
          }
          return q;
        });

        if (!updatedQuantities.some((q: any) => q.warehouseId === fromWarehouseId)) {
          updatedQuantities.push({
            warehouseId: fromWarehouseId,
            warehouseName: fromWarehouseId,
            quantity: newFromQuantity,
          });
        }

        if (!updatedQuantities.some((q: any) => q.warehouseId === toWarehouseId)) {
          updatedQuantities.push({
            warehouseId: toWarehouseId,
            warehouseName: toWarehouseId,
            quantity: newToQuantity,
          });
        }

        transaction.set(warehouseQuantitiesRef, {
          productId: productId,
          quantities: updatedQuantities,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // 3. Mettre à jour le stock total du produit
        const productRef = doc(db, COLLECTIONS.companyProducts(user.currentCompanyId), productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const productData = productSnap.data();
          const alertThreshold = productData.alertThreshold || 0;

          // Calculer le stock total depuis warehouse_quantities (le total ne change pas lors d'un transfert)
          const totalStock = updatedQuantities.reduce((sum: number, q: any) => sum + q.quantity, 0);
          const status: 'ok' | 'low' | 'out' =
            totalStock === 0 ? 'out' :
            totalStock <= alertThreshold ? 'low' : 'ok';

          transaction.update(productRef, {
            status,
            updatedAt: new Date(),
          });
        }

        // 4. Créer les mouvements de stock
        const movementsCollection = collection(db, COLLECTIONS.companyStockMovements(user.currentCompanyId));

        // Mouvement de sortie du dépôt source
        const fromMovementRef = doc(movementsCollection);
        transaction.set(fromMovementRef, {
          companyId: user.currentCompanyId,
          productId,
          warehouseId: fromWarehouseId,
          type: 'transfer',
          quantity: -quantity, // Négatif pour indiquer une sortie
          reason: reason || `Transfert vers dépôt ${toWarehouseId}`,
          referenceType: 'transfer',
          userId: user.id,
          userName: user.displayName || user.email,
          quantityBefore: transferTotal,
          quantityAfter: transferTotal,
          createdAt: new Date(),
        });

        // Mouvement d'entrée dans le dépôt destination
        const toMovementRef = doc(movementsCollection);
        transaction.set(toMovementRef, {
          companyId: user.currentCompanyId,
          productId,
          warehouseId: toWarehouseId,
          type: 'transfer',
          quantity: quantity, // Positif pour indiquer une entrée
          reason: reason || `Transfert depuis dépôt ${fromWarehouseId}`,
          referenceType: 'transfer',
          userId: user.id,
          userName: user.displayName || user.email,
          quantityBefore: transferTotal,
          quantityAfter: transferTotal,
          createdAt: new Date(),
        });
      });

      return { success: true };
    } catch (err: any) {
      console.error('Erreur lors du transfert:', err);
      throw new Error(err.message || 'Erreur lors du transfert de stock');
    }
  };

  /**
   * Enregistrer un mouvement d'entrée (approvisionnement)
   */
  const recordInMovement = async (params: {
    productId: string;
    warehouseId: string;
    quantity: number;
    reason?: string;
    referenceId?: string;
    referenceType?: string;
  }) => {
    const { productId, warehouseId, quantity, reason, referenceId, referenceType } = params;

    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Lire warehouse_quantities pour calculer la nouvelle quantité
        const warehouseQuantitiesRef = doc(
          db,
          `companies/${user.currentCompanyId}/warehouse_quantities`,
          productId
        );

        const warehouseQuantitiesDoc = await getDoc(warehouseQuantitiesRef);

        let quantities: any[] = [];
        if (warehouseQuantitiesDoc.exists()) {
          quantities = warehouseQuantitiesDoc.data().quantities || [];
        }

        const existingEntry = quantities.find((q: any) => q.warehouseId === warehouseId);
        const newQuantity = (existingEntry?.quantity || 0) + quantity;
        const totalStockBefore = quantities.reduce((sum: number, q: any) => sum + q.quantity, 0);

        const updatedQuantities = quantities.map((q: any) =>
          q.warehouseId === warehouseId
            ? { ...q, quantity: newQuantity }
            : q
        );

        if (!updatedQuantities.some((q: any) => q.warehouseId === warehouseId)) {
          updatedQuantities.push({
            warehouseId: warehouseId,
            warehouseName: warehouseId,
            quantity: newQuantity,
          });
        }

        transaction.set(warehouseQuantitiesRef, {
          productId: productId,
          quantities: updatedQuantities,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // 2. Calculer le stock total depuis warehouse_quantities (source de vérité)
        const productRef = doc(db, COLLECTIONS.companyProducts(user.currentCompanyId), productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const productData = productSnap.data();
          const alertThreshold = productData.alertThreshold || 0;
          const newTotalStock = updatedQuantities.reduce((sum: number, q: any) => sum + q.quantity, 0);

          const status: 'ok' | 'low' | 'out' =
            newTotalStock === 0 ? 'out' :
            newTotalStock <= alertThreshold ? 'low' : 'ok';

          transaction.update(productRef, {
            status,
            updatedAt: new Date(),
          });
        }

        // 3. Créer le mouvement
        const movementsCollection = collection(db, COLLECTIONS.companyStockMovements(user.currentCompanyId));
        const movementRef = doc(movementsCollection);

        // Construire l'objet de mouvement sans champs undefined
        const movementData: any = {
          companyId: user.currentCompanyId,
          productId,
          warehouseId,
          type: 'in',
          quantity,
          userId: user.id,
          userName: user.displayName || user.email,
          quantityBefore: totalStockBefore,
          quantityAfter: totalStockBefore + quantity,
          createdAt: new Date(),
        };

        if (reason) movementData.reason = reason;
        if (referenceId) movementData.referenceId = referenceId;
        if (referenceType) movementData.referenceType = referenceType;

        transaction.set(movementRef, movementData);
      });

      // Mettre à jour le cache IndexedDB avec le nouveau stock
      console.log('[recordInMovement] Mise à jour du cache pour le produit:', productId);
      try {
        const cachedProduct = await productsCache.getProductById(productId);
        if (cachedProduct) {
          const newTotalStock = (cachedProduct.currentStock || 0) + quantity;
          const alertThreshold = cachedProduct.alertThreshold || 0;
          const status: 'ok' | 'low' | 'out' = newTotalStock === 0 ? 'out' : newTotalStock <= alertThreshold ? 'low' : 'ok';
          const updatedProduct = {
            ...cachedProduct,
            currentStock: newTotalStock,
            status,
            updatedAt: new Date(),
          };
          await productsCache.upsertProduct(updatedProduct);
          console.log('[recordInMovement] Cache mis à jour:', cachedProduct.name, `${cachedProduct.currentStock} → ${newTotalStock}`);
        }
      } catch (cacheError) {
        console.error('[recordInMovement] Erreur lors de la mise à jour du cache:', cacheError);
      }

      return { success: true };
    } catch (err) {
      console.error('Erreur lors de l\'enregistrement du mouvement:', err);
      throw new Error('Erreur lors de l\'enregistrement du mouvement');
    }
  };

  /**
   * Enregistrer un mouvement de sortie (perte, casse, etc.)
   */
  const recordOutMovement = async (params: {
    productId: string;
    warehouseId: string;
    quantity: number;
    reason: string;
    referenceType?: string;
  }) => {
    const { productId, warehouseId, quantity, reason, referenceType } = params;

    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Lire warehouse_quantities
        const warehouseQuantitiesRef = doc(
          db,
          `companies/${user.currentCompanyId}/warehouse_quantities`,
          productId
        );

        const warehouseQuantitiesDoc = await getDoc(warehouseQuantitiesRef);

        let quantities: any[] = [];
        if (warehouseQuantitiesDoc.exists()) {
          quantities = warehouseQuantitiesDoc.data().quantities || [];
        }

        const existingEntry = quantities.find((q: any) => q.warehouseId === warehouseId);
        const currentQty = existingEntry?.quantity || 0;

        if (currentQty < quantity) {
          throw new Error(`Stock insuffisant (${currentQty} disponibles pour ${quantity} demandés)`);
        }

        const newQuantity = currentQty - quantity;
        const totalStockBefore = quantities.reduce((sum: number, q: any) => sum + q.quantity, 0);

        // Mettre à jour la quantité pour ce dépôt
        const updatedQuantities = quantities.map((q: any) =>
          q.warehouseId === warehouseId
            ? { ...q, quantity: newQuantity }
            : q
        );

        if (!updatedQuantities.some((q: any) => q.warehouseId === warehouseId)) {
          updatedQuantities.push({
            warehouseId: warehouseId,
            warehouseName: warehouseId,
            quantity: newQuantity,
          });
        }

        transaction.set(warehouseQuantitiesRef, {
          productId: productId,
          quantities: updatedQuantities,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // 2. Calculer le stock total depuis warehouse_quantities (source de vérité)
        const productRef = doc(db, COLLECTIONS.companyProducts(user.currentCompanyId), productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const productData = productSnap.data();
          const alertThreshold = productData.alertThreshold || 0;
          const newTotalStock = updatedQuantities.reduce((sum: number, q: any) => sum + q.quantity, 0);

          const status: 'ok' | 'low' | 'out' =
            newTotalStock === 0 ? 'out' :
            newTotalStock <= alertThreshold ? 'low' : 'ok';

          transaction.update(productRef, {
            status,
            updatedAt: new Date(),
          });
        }

        // 3. Créer le mouvement
        const movementsCollection = collection(db, COLLECTIONS.companyStockMovements(user.currentCompanyId));
        const movementRef = doc(movementsCollection);
        const movementData: any = {
          companyId: user.currentCompanyId,
          productId,
          warehouseId,
          type: 'loss',
          quantity: -quantity,
          reason,
          userId: user.id,
          userName: user.displayName || user.email,
          quantityBefore: totalStockBefore,
          quantityAfter: totalStockBefore - quantity,
          createdAt: new Date(),
        };
        if (referenceType) movementData.referenceType = referenceType;
        transaction.set(movementRef, movementData);
      });

      // Mettre à jour le cache IndexedDB avec le nouveau stock
      console.log('[recordOutMovement] Mise à jour du cache pour le produit:', productId);
      try {
        const cachedProduct = await productsCache.getProductById(productId);
        if (cachedProduct) {
          const newTotalStock = (cachedProduct.currentStock || 0) - quantity;
          const alertThreshold = cachedProduct.alertThreshold || 0;
          const status: 'ok' | 'low' | 'out' = newTotalStock === 0 ? 'out' : newTotalStock <= alertThreshold ? 'low' : 'ok';
          const updatedProduct = {
            ...cachedProduct,
            currentStock: newTotalStock,
            status,
            updatedAt: new Date(),
          };
          await productsCache.upsertProduct(updatedProduct);
          console.log('[recordOutMovement] Cache mis à jour:', cachedProduct.name, `${cachedProduct.currentStock} → ${newTotalStock}`);
        }
      } catch (cacheError) {
        console.error('[recordOutMovement] Erreur lors de la mise à jour du cache:', cacheError);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Erreur lors de l\'enregistrement du mouvement:', err);
      throw new Error(err.message || 'Erreur lors de l\'enregistrement du mouvement');
    }
  };

  return {
    movements,
    loading,
    error,
    hasMore,
    fetchMovements,
    loadMore,
    transferStock,
    recordInMovement,
    recordOutMovement,
  };
}

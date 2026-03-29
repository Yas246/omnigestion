import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  runTransaction,
  serverTimestamp,
  getDocFromCache,
  getDocsFromCache,
} from 'firebase/firestore';
import type { Product } from '@/types';

/**
 * Types pour la création et mise à jour de produits
 */
export interface CreateProductData {
  name: string;
  code?: string;
  description?: string;
  category?: string;
  price: number;
  cost?: number;
  currentStock: number;
  alertThreshold?: number;
  unit?: string;
  warehouseQuantities?: Array<{
    warehouseId: string;
    warehouseName: string;
    quantity: number;
  }>;
  stockAllocations?: Array<{
    warehouseId: string;
    quantity: number;
  }>;
}

export interface UpdateProductData {
  name?: string;
  code?: string;
  description?: string;
  category?: string;
  price?: number;
  cost?: number;
  currentStock?: number;
  alertThreshold?: number;
  unit?: string;
  warehouseQuantities?: Array<{
    warehouseId: string;
    warehouseName: string;
    quantity: number;
  }>;
}

export interface FetchProductsOptions {
  limit?: number;
  startAfter?: any;
  orderByField?: 'name' | 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
  filters?: {
    warehouseId?: string;
    category?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  hasMore: boolean;
  lastDoc?: any;
}

/**
 * CREATE - Créer un nouveau produit
 */
export async function createProduct(
  companyId: string,
  data: CreateProductData
): Promise<Product> {
  const productsRef = collection(db, `companies/${companyId}/products`);
  const { stockAllocations, warehouseQuantities, ...productData } = data;
  const docRef = await addDoc(productsRef, {
    ...productData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  });

  const productId = docRef.id;

  // Déterminer les quantités par dépôt
  let quantitiesToSave: Array<{ warehouseId: string; warehouseName: string; quantity: number }> = [];

  if (stockAllocations && stockAllocations.length > 0) {
    // Mode avancé : stockAllocations fournis par le dialogue
    // Récupérer les noms des dépôts
    for (const alloc of stockAllocations) {
      let warehouseName = alloc.warehouseId;
      try {
        const warehouseDoc = await getDoc(doc(db, `companies/${companyId}/warehouses`, alloc.warehouseId));
        if (warehouseDoc.exists()) {
          warehouseName = warehouseDoc.data().name;
        }
      } catch {}
      quantitiesToSave.push({
        warehouseId: alloc.warehouseId,
        warehouseName,
        quantity: alloc.quantity,
      });
    }
  } else if (warehouseQuantities && warehouseQuantities.length > 0) {
    // Déjà au bon format
    quantitiesToSave = warehouseQuantities.map(wq => ({
      warehouseId: wq.warehouseId,
      warehouseName: wq.warehouseName,
      quantity: wq.quantity,
    }));
  } else if ((productData.currentStock || 0) > 0) {
    // Mode simple : pas d'allocations mais du stock → tout mettre dans le dépôt par défaut
    try {
      const settingsDoc = await getDoc(doc(db, `companies/${companyId}`));
      const defaultWarehouseId = settingsDoc.data()?.stock?.defaultWarehouseId;
      if (defaultWarehouseId) {
        let warehouseName = defaultWarehouseId;
        try {
          const warehouseDoc = await getDoc(doc(db, `companies/${companyId}/warehouses`, defaultWarehouseId));
          if (warehouseDoc.exists()) {
            warehouseName = warehouseDoc.data().name;
          }
        } catch {}
        quantitiesToSave = [{
          warehouseId: defaultWarehouseId,
          warehouseName,
          quantity: productData.currentStock || 0,
        }];
      }
    } catch (err) {
      console.warn('[createProduct] Impossible de récupérer le dépôt par défaut:', err);
    }
  }

  // Créer le document warehouse_quantities
  if (quantitiesToSave.length > 0) {
    await runTransaction(db, async (transaction) => {
      const warehouseQuantitiesRef = doc(
        db,
        `companies/${companyId}/warehouse_quantities`,
        productId
      );

      transaction.set(warehouseQuantitiesRef, {
        productId: productId,
        quantities: quantitiesToSave,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log(`[createProduct] ✅ Créé warehouse_quantities pour ${productId} avec ${quantitiesToSave.length} dépôts`);
    });
  }

  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error('Failed to create product');
  }

  return {
    id: docRef.id,
    ...docSnap.data(),
    createdAt: docSnap.data().createdAt?.toDate() || new Date(),
    updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
  } as Product;
}

/**
 * READ - Récupérer un produit par ID
 */
export async function fetchProduct(
  companyId: string,
  productId: string,
  useCache = false
): Promise<Product | null> {
  const productRef = doc(db, `companies/${companyId}/products`, productId);
  const docSnap = useCache ? await getDocFromCache(productRef) : await getDoc(productRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as Product;
}

/**
 * READ - Récupérer tous les produits avec pagination et filtres
 */
export async function fetchProducts(
  companyId: string,
  options: FetchProductsOptions = {}
): Promise<PaginatedResult<Product>> {
  const {
    limit: limitCount = 50,
    startAfter: startAfterDoc,
    orderByField = 'name',
    orderDirection = 'asc',
    filters,
  } = options;

  console.log('[fetchProducts] Début chargement', {
    companyId,
    limit: limitCount,
    filters,
  });

  // Construire la requête de base
  let q = query(
    collection(db, `companies/${companyId}/products`),
    orderBy(orderByField, orderDirection)
  );

  // NOTE: Pour le moment, on ne filtre pas par deletedAt
  // car tous les produits n'ont pas ce champ
  // TODO: Ajouter le filtre une fois tous les produits migrés avec deletedAt

  // Ajouter pagination
  if (startAfterDoc) {
    q = query(q, startAfter(startAfterDoc));
  }

  if (limitCount) {
    q = query(q, limit(limitCount + 1)); // +1 pour détecter s'il y a plus de résultats
  }

  const snap = await getDocs(q);
  const products = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Product;
  });

  const hasMore = products.length > limitCount;
  const result = hasMore ? products.slice(0, -1) : products;
  const lastDoc = hasMore ? snap.docs[snap.docs.length - 2] : snap.docs[snap.docs.length - 1];

  console.log('[fetchProducts] Chargement terminé', {
    count: result.length,
    hasMore,
    lastDoc: lastDoc?.id,
  });

  return {
    data: result,
    hasMore,
    lastDoc,
  };
}

/**
 * READ - Récupérer les warehouse_quantities pour plusieurs produits
 * Lit depuis la collection centralisée warehouse_quantities
 */
export async function fetchProductsStockLocations(
  companyId: string,
  productIds: string[]
): Promise<Record<string, Array<{ warehouseId: string; warehouseName: string; quantity: number }>>> {
  console.log('[fetchProductsStockLocations] Début', { productIds: productIds.length });

  const result: Record<string, any[]> = {};
  let successCount = 0;

  // Traiter par lots de 10 pour les requêtes Firestore 'in'
  const batchSize = 10;
  const batches = [];
  for (let i = 0; i < productIds.length; i += batchSize) {
    batches.push(productIds.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    await Promise.all(
      batch.map(async (productId) => {
        try {
          const wqRef = doc(db, `companies/${companyId}/warehouse_quantities`, productId);
          const wqSnap = await getDoc(wqRef);

          if (wqSnap.exists()) {
            result[productId] = wqSnap.data().quantities || [];
          } else {
            result[productId] = [];
          }

          successCount++;
        } catch (error) {
          console.error(`[fetchProductsStockLocations] Erreur pour produit ${productId}:`, error);
          result[productId] = [];
        }
      })
    );
  }

  console.log('[fetchProductsStockLocations] Terminé', {
    productsLoaded: successCount,
  });

  return result;
}

/**
 * READ - Récupérer les warehouse_quantities pour un seul produit
 */
export async function fetchProductStockLocations(
  companyId: string,
  productId: string
): Promise<Array<{ warehouseId: string; warehouseName: string; quantity: number }>> {
  const wqRef = doc(db, `companies/${companyId}/warehouse_quantities`, productId);
  const wqSnap = await getDoc(wqRef);

  if (!wqSnap.exists()) {
    return [];
  }

  return wqSnap.data().quantities || [];
}

/**
 * UPDATE - Mettre à jour un produit
 */
export async function updateProduct(
  companyId: string,
  productId: string,
  data: UpdateProductData
): Promise<void> {
  const productRef = doc(db, `companies/${companyId}/products`, productId);

  console.log('[updateProduct] Mise à jour produit', { productId, data });

  await updateDoc(productRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });

  console.log('[updateProduct] Produit mis à jour', { productId });
}

/**
 * DELETE - Supprimer un produit (soft delete)
 */
export async function deleteProduct(companyId: string, productId: string): Promise<void> {
  const productRef = doc(db, `companies/${companyId}/products`, productId);

  console.log('[deleteProduct] Soft delete produit', { productId });

  await updateDoc(productRef, {
    deletedAt: serverTimestamp(),
  });

  console.log('[deleteProduct] Produit supprimé', { productId });
}

/**
 * TRANSACTION - Mettre à jour le stock d'un produit dans un entrepôt spécifique
 * Utilise uniquement warehouse_quantities (collection centralisée)
 */
export async function updateProductStockInWarehouse(
  companyId: string,
  productId: string,
  warehouseId: string,
  quantityChange: number,
  transaction?: any
): Promise<void> {
  const warehouseQuantitiesRef = doc(
    db,
    `companies/${companyId}/warehouse_quantities`,
    productId
  );

  const doUpdate = async (txn: any) => {
    const wqDoc = await getDoc(warehouseQuantitiesRef);

    let quantities: any[] = [];
    if (wqDoc.exists()) {
      quantities = wqDoc.data().quantities || [];
    }

    const entry = quantities.find((q: any) => q.warehouseId === warehouseId);
    const currentQuantity = entry?.quantity || 0;
    const newQuantity = currentQuantity + quantityChange;

    const updatedQuantities = quantities.map((q: any) =>
      q.warehouseId === warehouseId
        ? { ...q, quantity: newQuantity }
        : q
    );

    if (!updatedQuantities.some((q: any) => q.warehouseId === warehouseId)) {
      updatedQuantities.push({
        warehouseId,
        warehouseName: warehouseId,
        quantity: newQuantity,
      });
    }

    txn.set(warehouseQuantitiesRef, {
      productId,
      quantities: updatedQuantities,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  };

  if (transaction) {
    await doUpdate(transaction);
  } else {
    await runTransaction(db, doUpdate);
  }
}

/**
 * BULK OPERATION - Récupérer plusieurs produits par IDs
 */
export async function fetchProductsByIds(
  companyId: string,
  productIds: string[]
): Promise<Product[]> {
  if (productIds.length === 0) return [];

  console.log('[fetchProductsByIds] Chargement par IDs', { count: productIds.length });

  // Firestore limite les requêtes 'in' à 10 éléments
  const chunks = [];
  for (let i = 0; i < productIds.length; i += 10) {
    chunks.push(productIds.slice(i, i + 10));
  }

  const products: Product[] = [];

  for (const chunk of chunks) {
    const q = query(
      collection(db, `companies/${companyId}/products`),
      where('__name__', 'in', chunk)
    );

    const snap = await getDocs(q);
    const chunkProducts = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Product;
    });

    products.push(...chunkProducts);
  }

  console.log('[fetchProductsByIds] Terminé', { loaded: products.length });

  return products;
}

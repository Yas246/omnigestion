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
  const docRef = await addDoc(productsRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  });

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
 * READ - Récupérer les stock_locations pour plusieurs produits
 * Optimisé pour éviter N+1 queries avec gestion d'erreurs robuste
 */
export async function fetchProductsStockLocations(
  companyId: string,
  productIds: string[]
): Promise<Record<string, Array<{ warehouseId: string; warehouseName: string; quantity: number }>>> {
  console.log('[fetchProductsStockLocations] Début', { productIds: productIds.length });

  const result: Record<string, any[]> = {};
  const errors: string[] = [];
  let successCount = 0;

  // Traiter par lots de 10 pour éviter les timeouts
  const batchSize = 10;
  const batches = [];

  for (let i = 0; i < productIds.length; i += batchSize) {
    batches.push(productIds.slice(i, i + batchSize));
  }

  console.log('[fetchProductsStockLocations] Traitement par lots', {
    totalProducts: productIds.length,
    numberOfBatches: batches.length,
    batchSize,
  });

  // Traiter chaque lot
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    console.log(`[fetchProductsStockLocations] Lot ${batchIndex + 1}/${batches.length}`, {
      productsInBatch: batch.length,
    });

    // Traiter les produits du lot en parallèle
    await Promise.all(
      batch.map(async (productId) => {
        try {
          const snap = await getDocs(
            query(collection(db, `companies/${companyId}/products/${productId}/stock_locations`))
          );

          result[productId] = snap.docs.map((doc) => {
            const data = doc.data();
            return {
              warehouseId: data.warehouseId,
              warehouseName: data.warehouseName || '',
              quantity: data.quantity || 0,
            };
          });

          successCount++;

          if (successCount % 10 === 0) {
            console.log(`[fetchProductsStockLocations] Progression: ${successCount}/${productIds.length} produits chargés`);
          }
        } catch (error) {
          const errorMsg = `Erreur chargement stock_locations pour produit ${productId}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`;
          console.error(`[fetchProductsStockLocations] ${errorMsg}`);
          errors.push(errorMsg);

          // Mettre un tableau vide pour ce produit pour éviter les erreurs de filtrage
          result[productId] = [];
        }
      })
    );
  }

  console.log('[fetchProductsStockLocations] Terminé', {
    productsLoaded: Object.keys(result).length,
    successCount,
    errorsCount: errors.length,
    errors: errors.length > 0 ? errors : undefined,
  });

  return result;
}

/**
 * READ - Récupérer les stock_locations pour un seul produit
 */
export async function fetchProductStockLocations(
  companyId: string,
  productId: string
): Promise<Array<{ warehouseId: string; warehouseName: string; quantity: number }>> {
  const snap = await getDocs(
    query(collection(db, `companies/${companyId}/products/${productId}/stock_locations`))
  );

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      warehouseId: data.warehouseId,
      warehouseName: data.warehouseName || '',
      quantity: data.quantity || 0,
    };
  });
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
 */
export async function updateProductStockInWarehouse(
  companyId: string,
  productId: string,
  warehouseId: string,
  quantityChange: number,
  transaction?: any
): Promise<void> {
  const stockLocationsRef = collection(
    db,
    `companies/${companyId}/products/${productId}/stock_locations`
  );

  const q = query(stockLocationsRef, where('warehouseId', '==', warehouseId));

  if (transaction) {
    // À l'intérieur d'une transaction existante
    const snap = await getDocs(q);
    if (!snap.empty) {
      const stockDoc = snap.docs[0];
      const currentQuantity = stockDoc.data().quantity || 0;
      const newQuantity = currentQuantity + quantityChange;

      transaction.update(stockDoc.ref, {
        quantity: newQuantity,
        updatedAt: serverTimestamp(),
      });
    }
  } else {
    // Nouvelle transaction
    await runTransaction(db, async (txn) => {
      const snap = await getDocs(q);
      if (!snap.empty) {
        const stockDoc = snap.docs[0];
        const currentQuantity = stockDoc.data().quantity || 0;
        const newQuantity = currentQuantity + quantityChange;

        txn.update(stockDoc.ref, {
          quantity: newQuantity,
          updatedAt: serverTimestamp(),
        });
      }
    });
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

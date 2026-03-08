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
} from 'firebase/firestore';
import type { Invoice, InvoiceItem } from '@/types';

/**
 * Types pour la création et mise à jour de factures
 */
export interface CreateInvoiceData {
  invoiceNumber: string;
  clientId: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  paymentMethod: string;
  status: 'draft' | 'validated' | 'paid' | 'cancelled';
  notes?: string;
  saleDate?: Date;
  dueDate?: Date;
}

export interface UpdateInvoiceData {
  invoiceNumber?: string;
  clientId?: string;
  items?: InvoiceItem[];
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  discount?: number;
  total?: number;
  paymentMethod?: string;
  status?: 'draft' | 'validated' | 'paid' | 'cancelled';
  notes?: string;
  saleDate?: Date;
  dueDate?: Date;
}

export interface FetchInvoicesOptions {
  limit?: number;
  startAfter?: any;
  orderByField?: 'createdAt' | 'updatedAt' | 'invoiceNumber' | 'total' | 'saleDate';
  orderDirection?: 'asc' | 'desc';
  filters?: {
    clientId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    minAmount?: number;
    maxAmount?: number;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  hasMore: boolean;
  lastDoc?: any;
}

/**
 * CREATE - Créer une nouvelle facture avec transaction
 * Gère automatiquement la déduction de stock
 */
export async function createInvoice(
  companyId: string,
  userId: string,
  data: CreateInvoiceData
): Promise<Invoice> {
  console.log('[createInvoice] Début création facture', {
    companyId,
    userId,
    itemCount: data.items.length,
    total: data.total,
  });

  try {
    const result = await runTransaction(db, async (transaction) => {
      // 1. Créer la facture
      const invoicesRef = collection(db, `companies/${companyId}/invoices`);
      const invoiceRef = doc(invoicesRef);

      // 2. Préparer les données de la facture
      const invoiceData = {
        ...data,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
      };

      transaction.set(invoiceRef, invoiceData);

      // 3. Déduire le stock pour chaque article
      for (const item of data.items) {
        const productRef = doc(db, `companies/${companyId}/products`, item.productId);

        const productSnap = await getDoc(productRef);
        if (!productSnap.exists()) {
          throw new Error(`Produit ${item.productId} non trouvé`);
        }

        const productData = productSnap.data();

        // Vérifier si le stock est suffisant
        const currentStock = productData.currentStock || 0;
        if (currentStock < item.quantity) {
          throw new Error(
            `Stock insuffisant pour ${productData.name}. Disponible: ${currentStock}, Requis: ${item.quantity}`
          );
        }

        // Mettre à jour le stock du produit
        const newStock = currentStock - item.quantity;
        transaction.update(productRef, {
          currentStock: newStock,
          updatedAt: serverTimestamp(),
        });

        // Mettre à jour stock_locations du dépôt principal (Boutique)
        // TODO: Récupérer le dépôt principal depuis les settings de la compagnie
        const primaryWarehouseId = 'boutique'; // Pour l'instant hardcoded

        const stockLocationsRef = collection(
          db,
          `companies/${companyId}/products/${item.productId}/stock_locations`
        );
        const stockQuery = query(stockLocationsRef, where('warehouseId', '==', primaryWarehouseId));
        const stockSnap = await getDocs(stockQuery);

        if (!stockSnap.empty) {
          const stockDoc = stockSnap.docs[0];
          const primaryStock = stockDoc.data().quantity || 0;
          const newPrimaryStock = primaryStock - item.quantity;

          transaction.update(stockDoc.ref, {
            quantity: newPrimaryStock,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // 4. Retourner les données de la facture créée
      // Calculer paidAmount et remainingAmount basé sur le status
      const isPaid = data.status === 'paid';
      const paidAmount = isPaid ? data.total : 0;
      const remainingAmount = data.total - paidAmount;

      return {
        id: invoiceRef.id,
        companyId,
        invoiceNumber: data.invoiceNumber,
        date: data.saleDate || new Date(), // Utiliser saleDate comme date
        clientId: data.clientId,
        items: data.items,
        subtotal: data.subtotal,
        taxRate: data.taxRate,
        taxAmount: data.taxAmount,
        discount: data.discount,
        total: data.total,
        status: data.status,
        paymentMethod: data.paymentMethod as any, // Cast string -> PaymentMethod
        paidAmount,
        remainingAmount,
        userId,
        dueDate: data.dueDate,
        createdAt: new Date(), // Sera remplacé par serverTimestamp
        updatedAt: new Date(),
      };
    });

    console.log('[createInvoice] Facture créée avec succès', {
      invoiceId: result.id,
      invoiceNumber: result.invoiceNumber,
    });

    return result;
  } catch (error) {
    console.error('[createInvoice] Erreur lors de la création:', error);
    throw error;
  }
}

/**
 * READ - Récupérer une facture par ID
 */
export async function fetchInvoice(
  companyId: string,
  invoiceId: string,
  useCache = false
): Promise<Invoice | null> {
  const invoiceRef = doc(db, `companies/${companyId}/invoices`, invoiceId);
  const docSnap = useCache ? await getDocFromCache(invoiceRef) : await getDoc(invoiceRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data();
  return {
    id: docSnap.id,
    companyId,
    invoiceNumber: data.invoiceNumber || '',
    clientId: data.clientId,
    clientName: data.clientName,
    date: data.saleDate?.toDate() || data.date?.toDate() || new Date(),
    dueDate: data.dueDate?.toDate(),
    items: data.items || [],
    subtotal: data.subtotal || 0,
    taxRate: data.taxRate || 0,
    taxAmount: data.taxAmount || 0,
    discount: data.discount || 0,
    total: data.total || 0,
    status: data.status || 'draft',
    paymentMethod: data.paymentMethod,
    paidAmount: data.paidAmount || 0,
    remainingAmount: data.remainingAmount || 0,
    mobileNumber: data.mobileNumber,
    bankName: data.bankName,
    accountNumber: data.accountNumber,
    transactionNumber: data.transactionNumber,
    userId: data.userId || '',
    userName: data.userName,
    referenceType: data.referenceType,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
}

/**
 * READ - Récupérer les factures avec pagination et filtres
 * IMPORTANT: Corrige le bug ligne 76 useDashboard qui charge TOUTES les factures
 */
export async function fetchInvoices(
  companyId: string,
  options: FetchInvoicesOptions = {}
): Promise<PaginatedResult<Invoice>> {
  const {
    limit: limitCount = 20, // Pagination par défaut de 20
    startAfter: startAfterDoc,
    orderByField = 'createdAt',
    orderDirection = 'desc',
    filters,
  } = options;

  console.log('[fetchInvoices] Début chargement', {
    companyId,
    limit: limitCount,
    filters,
  });

  // Construire la requête de base
  let q = query(
    collection(db, `companies/${companyId}/invoices`),
    orderBy(orderByField, orderDirection)
  );

  // Ajouter les filtres de date si fournis
  if (filters?.startDate) {
    const startTimestamp = filters.startDate;
    q = query(q, where(orderByField, '>=', startTimestamp));
  }

  if (filters?.endDate) {
    const endTimestamp = filters.endDate;
    q = query(q, where(orderByField, '<=', endTimestamp));
  }

  // Filtre par client
  if (filters?.clientId) {
    q = query(q, where('clientId', '==', filters.clientId));
  }

  // Filtre par statut
  if (filters?.status) {
    q = query(q, where('status', '==', filters.status));
  }

  // Ajouter pagination
  if (startAfterDoc) {
    q = query(q, startAfter(startAfterDoc));
  }

  if (limitCount) {
    q = query(q, limit(limitCount + 1)); // +1 pour détecter s'il y a plus de résultats
  }

  const snap = await getDocs(q);
  const invoices = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      companyId,
      invoiceNumber: data.invoiceNumber || '',
      clientId: data.clientId,
      clientName: data.clientName,
      date: data.saleDate?.toDate() || data.date?.toDate() || new Date(), // Champ critique pour l'affichage
      dueDate: data.dueDate?.toDate(),
      items: data.items || [],
      subtotal: data.subtotal || 0,
      taxRate: data.taxRate || 0,
      taxAmount: data.taxAmount || 0,
      discount: data.discount || 0,
      total: data.total || 0,
      status: data.status || 'draft',
      paymentMethod: data.paymentMethod,
      paidAmount: data.paidAmount || 0,
      remainingAmount: data.remainingAmount || 0,
      mobileNumber: data.mobileNumber,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      transactionNumber: data.transactionNumber,
      userId: data.userId || '',
      userName: data.userName,
      referenceType: data.referenceType,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  });

  const hasMore = invoices.length > limitCount;
  const result = hasMore ? invoices.slice(0, -1) : invoices;
  const lastDoc = hasMore ? snap.docs[snap.docs.length - 2] : snap.docs[snap.docs.length - 1];

  console.log('[fetchInvoices] Chargement terminé', {
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
 * UPDATE - Mettre à jour une facture
 */
export async function updateInvoice(
  companyId: string,
  invoiceId: string,
  data: UpdateInvoiceData
): Promise<void> {
  const invoiceRef = doc(db, `companies/${companyId}/invoices`, invoiceId);

  console.log('[updateInvoice] Mise à jour facture', { invoiceId, data });

  await updateDoc(invoiceRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });

  console.log('[updateInvoice] Facture mise à jour', { invoiceId });
}

/**
 * DELETE - Supprimer une facture (soft delete)
 */
export async function deleteInvoice(companyId: string, invoiceId: string): Promise<void> {
  const invoiceRef = doc(db, `companies/${companyId}/invoices`, invoiceId);

  console.log('[deleteInvoice] Soft delete facture', { invoiceId });

  await updateDoc(invoiceRef, {
    deletedAt: serverTimestamp(),
  });

  console.log('[deleteInvoice] Facture supprimée', { invoiceId });
}

/**
 * STATS - Récupérer les statistiques de ventes pour une période
 */
export async function fetchSalesStats(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalSales: number;
  totalRevenue: number;
  invoiceCount: number;
  averageInvoiceAmount: number;
}> {
  console.log('[fetchSalesStats] Calcul des stats', { companyId, startDate, endDate });

  const q = query(
    collection(db, `companies/${companyId}/invoices`),
    where('createdAt', '>=', startDate),
    where('createdAt', '<=', endDate),
    orderBy('createdAt', 'desc')
  );

  const snap = await getDocs(q);
  const invoices = snap.docs.map((doc) => doc.data());

  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const invoiceCount = invoices.length;
  const averageInvoiceAmount = invoiceCount > 0 ? totalRevenue / invoiceCount : 0;

  console.log('[fetchSalesStats] Stats calculées', {
    totalRevenue,
    invoiceCount,
    averageInvoiceAmount,
  });

  return {
    totalSales: invoiceCount,
    totalRevenue,
    invoiceCount,
    averageInvoiceAmount,
  };
}

/**
 * BULK OPERATION - Récupérer plusieurs factures par IDs
 */
export async function fetchInvoicesByIds(
  companyId: string,
  invoiceIds: string[]
): Promise<Invoice[]> {
  if (invoiceIds.length === 0) return [];

  console.log('[fetchInvoicesByIds] Chargement par IDs', { count: invoiceIds.length });

  // Firestore limite les requêtes 'in' à 10 éléments
  const chunks = [];
  for (let i = 0; i < invoiceIds.length; i += 10) {
    chunks.push(invoiceIds.slice(i, i + 10));
  }

  const invoices: Invoice[] = [];

  for (const chunk of chunks) {
    const q = query(
      collection(db, `companies/${companyId}/invoices`),
      where('__name__', 'in', chunk)
    );

    const snap = await getDocs(q);
    const chunkInvoices = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        companyId,
        invoiceNumber: data.invoiceNumber || '',
        clientId: data.clientId,
        clientName: data.clientName,
        date: data.saleDate?.toDate() || data.date?.toDate() || new Date(),
        dueDate: data.dueDate?.toDate(),
        items: data.items || [],
        subtotal: data.subtotal || 0,
        taxRate: data.taxRate || 0,
        taxAmount: data.taxAmount || 0,
        discount: data.discount || 0,
        total: data.total || 0,
        status: data.status || 'draft',
        paymentMethod: data.paymentMethod,
        paidAmount: data.paidAmount || 0,
        remainingAmount: data.remainingAmount || 0,
        mobileNumber: data.mobileNumber,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        transactionNumber: data.transactionNumber,
        userId: data.userId || '',
        userName: data.userName,
        referenceType: data.referenceType,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    });

    invoices.push(...chunkInvoices);
  }

  console.log('[fetchInvoicesByIds] Terminé', { loaded: invoices.length });

  return invoices;
}

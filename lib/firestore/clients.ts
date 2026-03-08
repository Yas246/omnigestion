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
  serverTimestamp,
  getDocFromCache,
} from 'firebase/firestore';
import type { Client } from '@/types';

/**
 * Types pour la création et mise à jour de clients
 */
export interface CreateClientData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  notes?: string;
  creditLimit?: number;
  currentBalance?: number;
}

export interface UpdateClientData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  notes?: string;
  creditLimit?: number;
  currentBalance?: number;
}

export interface FetchClientsOptions {
  limit?: number;
  startAfter?: any;
  orderByField?: 'name' | 'createdAt' | 'updatedAt' | 'currentBalance';
  orderDirection?: 'asc' | 'desc';
  filters?: {
    search?: string;
    city?: string;
    country?: string;
    minBalance?: number;
    maxBalance?: number;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  hasMore: boolean;
  lastDoc?: any;
}

/**
 * CREATE - Créer un nouveau client
 */
export async function createClient(
  companyId: string,
  data: CreateClientData
): Promise<Client> {
  const clientsRef = collection(db, `companies/${companyId}/clients`);
  const docRef = await addDoc(clientsRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  });

  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error('Failed to create client');
  }

  return {
    id: docRef.id,
    ...docSnap.data(),
    createdAt: docSnap.data().createdAt?.toDate() || new Date(),
    updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
  } as Client;
}

/**
 * READ - Récupérer un client par ID
 */
export async function fetchClient(
  companyId: string,
  clientId: string,
  useCache = false
): Promise<Client | null> {
  const clientRef = doc(db, `companies/${companyId}/clients`, clientId);
  const docSnap = useCache ? await getDocFromCache(clientRef) : await getDoc(clientRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as Client;
}

/**
 * READ - Récupérer tous les clients avec pagination et filtres
 */
export async function fetchClients(
  companyId: string,
  options: FetchClientsOptions = {}
): Promise<PaginatedResult<Client>> {
  const {
    limit: limitCount = 50,
    startAfter: startAfterDoc,
    orderByField = 'name',
    orderDirection = 'asc',
    filters,
  } = options;

  console.log('[fetchClients] Début chargement', {
    companyId,
    limit: limitCount,
    filters,
  });

  // Construire la requête de base
  let q = query(
    collection(db, `companies/${companyId}/clients`),
    orderBy(orderByField, orderDirection)
  );

  // Ajouter pagination
  if (startAfterDoc) {
    q = query(q, startAfter(startAfterDoc));
  }

  if (limitCount) {
    q = query(q, limit(limitCount + 1)); // +1 pour détecter s'il y a plus de résultats
  }

  const snap = await getDocs(q);
  const clients = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Client;
  });

  const hasMore = clients.length > limitCount;
  const result = hasMore ? clients.slice(0, -1) : clients;
  const lastDoc = hasMore ? snap.docs[snap.docs.length - 2] : snap.docs[snap.docs.length - 1];

  console.log('[fetchClients] Chargement terminé', {
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
 * READ - Rechercher des clients par nom ou email
 */
export async function searchClients(
  companyId: string,
  searchTerm: string,
  maxResults = 10
): Promise<Client[]> {
  console.log('[searchClients] Recherche', { companyId, searchTerm, maxResults });

  // Note: Firestore ne supporte pas la recherche full-text native
  // On va faire une simple recherche par préfixe sur le nom
  const endValue = searchTerm + '\uf8ff'; // Caractère Unicode maximal

  const q = query(
    collection(db, `companies/${companyId}/clients`),
    where('name', '>=', searchTerm),
    where('name', '<=', endValue),
    orderBy('name'),
    limit(maxResults)
  );

  const snap = await getDocs(q);
  const clients = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Client;
  });

  console.log('[searchClients] Résultats', { count: clients.length });

  return clients;
}

/**
 * UPDATE - Mettre à jour un client
 */
export async function updateClient(
  companyId: string,
  clientId: string,
  data: UpdateClientData
): Promise<void> {
  const clientRef = doc(db, `companies/${companyId}/clients`, clientId);

  console.log('[updateClient] Mise à jour client', { clientId, data });

  await updateDoc(clientRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });

  console.log('[updateClient] Client mis à jour', { clientId });
}

/**
 * DELETE - Supprimer un client (soft delete)
 */
export async function deleteClient(companyId: string, clientId: string): Promise<void> {
  const clientRef = doc(db, `companies/${companyId}/clients`, clientId);

  console.log('[deleteClient] Soft delete client', { clientId });

  await updateDoc(clientRef, {
    deletedAt: serverTimestamp(),
  });

  console.log('[deleteClient] Client supprimé', { clientId });
}

/**
 * BULK OPERATION - Récupérer plusieurs clients par IDs
 */
export async function fetchClientsByIds(
  companyId: string,
  clientIds: string[]
): Promise<Client[]> {
  if (clientIds.length === 0) return [];

  console.log('[fetchClientsByIds] Chargement par IDs', { count: clientIds.length });

  // Firestore limite les requêtes 'in' à 10 éléments
  const chunks = [];
  for (let i = 0; i < clientIds.length; i += 10) {
    chunks.push(clientIds.slice(i, i + 10));
  }

  const clients: Client[] = [];

  for (const chunk of chunks) {
    const q = query(
      collection(db, `companies/${companyId}/clients`),
      where('__name__', 'in', chunk)
    );

    const snap = await getDocs(q);
    const chunkClients = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Client;
    });

    clients.push(...chunkClients);
  }

  console.log('[fetchClientsByIds] Terminé', { loaded: clients.length });

  return clients;
}

/**
 * STATS - Récupérer le solde total des clients
 */
export async function fetchClientsBalance(
  companyId: string
): Promise<{ totalBalance: number; clientCount: number }> {
  console.log('[fetchClientsBalance] Calcul du solde total', { companyId });

  const q = query(
    collection(db, `companies/${companyId}/clients`)
  );

  const snap = await getDocs(q);
  const clients = snap.docs.map((doc) => doc.data());

  const totalBalance = clients.reduce((sum, client) => sum + (client.currentBalance || 0), 0);
  const clientCount = clients.length;

  console.log('[fetchClientsBalance] Solde calculé', {
    totalBalance,
    clientCount,
  });

  return {
    totalBalance,
    clientCount,
  };
}

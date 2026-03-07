'use client';

import { useState, useEffect } from 'react';
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
  limit,
  startAfter,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase';
import { useAuth } from './useAuth';
import type { Client } from '@/types';

const CLIENTS_PER_PAGE = 10;

export function useClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);

  useEffect(() => {
    if (user?.currentCompanyId) {
      fetchClients();
    }
  }, [user]);

  const fetchClients = async (reset = true) => {
    if (!user?.currentCompanyId) return;

    if (reset) {
      setLoading(true);
      setLastDoc(null);
    }

    setError(null);

    try {
      let q = query(
        collection(db, COLLECTIONS.companyClients(user.currentCompanyId)),
        orderBy('name'),
        limit(CLIENTS_PER_PAGE)
      );

      if (!reset && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      const clientsData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Client)
      );

      if (reset) {
        setClients(clientsData);
      } else {
        setClients((prev) => [...prev, ...clientsData]);
      }

      setHasMore(clientsData.length === CLIENTS_PER_PAGE);
      if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
    } catch (err) {
      console.error('Erreur lors du chargement des clients:', err);
      setError('Erreur lors du chargement des clients');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchClients(false);
    }
  };

  const getClient = async (id: string) => {
    if (!user?.currentCompanyId) return null;

    try {
      const docRef = doc(db, COLLECTIONS.companyClients(user.currentCompanyId), id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Client;
      }
      return null;
    } catch (err) {
      console.error('Erreur lors du chargement du client:', err);
      return null;
    }
  };

  const createClient = async (data: Omit<Client, 'id' | 'companyId' | 'totalPurchases' | 'totalAmount' | 'currentCredit' | 'createdAt' | 'updatedAt'>) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      // Récupérer le nombre de clients pour générer le code
      const clientsSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.companyClients(user.currentCompanyId)))
      );

      const clientCount = clientsSnapshot.size;
      const code = `CLI-${String(clientCount + 1).padStart(3, '0')}`;

      const docRef = await addDoc(collection(db, COLLECTIONS.companyClients(user.currentCompanyId)), {
        ...data,
        code,
        totalPurchases: 0,
        totalAmount: 0,
        currentCredit: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const newClient: Client = {
        id: docRef.id,
        ...data,
        code,
        companyId: user.currentCompanyId,
        totalPurchases: 0,
        totalAmount: 0,
        currentCredit: 0,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };

      setClients((prev) => [newClient, ...prev]);

      return newClient;
    } catch (err) {
      console.error('Erreur lors de la création du client:', err);
      throw new Error('Erreur lors de la création du client');
    }
  };

  const updateClient = async (id: string, data: Partial<Client>) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const clientRef = doc(db, COLLECTIONS.companyClients(user.currentCompanyId), id);
      await updateDoc(clientRef, {
        ...data,
        updatedAt: new Date(),
      });

      setClients((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...data, updatedAt: new Date() as any } : c))
      );
    } catch (err) {
      console.error('Erreur lors de la mise à jour du client:', err);
      throw new Error('Erreur lors de la mise à jour du client');
    }
  };

  const deleteClient = async (id: string) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      await deleteDoc(doc(db, COLLECTIONS.companyClients(user.currentCompanyId), id));
      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Erreur lors de la suppression du client:', err);
      throw new Error('Erreur lors de la suppression du client');
    }
  };

  return {
    clients,
    loading,
    error,
    hasMore,
    fetchClients,
    loadMore,
    getClient,
    createClient,
    updateClient,
    deleteClient,
  };
}

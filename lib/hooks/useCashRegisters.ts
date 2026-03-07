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
  deleteDoc,
  runTransaction,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase';
import { useAuth } from './useAuth';
import type { CashRegister, CashMovement } from '@/types';

const CASH_REGISTERS_PER_PAGE = 50;

export interface CashMovementInput {
  cashRegisterId: string;
  type: 'in' | 'out' | 'transfer';
  amount: number;
  category: string;
  description?: string;
  targetCashRegisterId?: string; // Pour les transferts
  attachmentUrl?: string;
}

export function useCashRegisters() {
  const { user } = useAuth();
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);

  useEffect(() => {
    if (user?.currentCompanyId) {
      fetchCashRegisters();
      fetchMovements();
    }
  }, [user]);

  // Récupérer les caisses
  const fetchCashRegisters = async () => {
    if (!user?.currentCompanyId) return;

    try {
      const q = query(
        collection(db, COLLECTIONS.companyCashRegisters(user.currentCompanyId)),
        orderBy('name')
      );

      const snapshot = await getDocs(q);
      const registersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      } as CashRegister));

      setCashRegisters(registersData);
    } catch (err) {
      console.error('Erreur lors du chargement des caisses:', err);
      setError('Erreur lors du chargement des caisses');
    }
  };

  // Récupérer les mouvements de caisse
  const fetchMovements = async (reset = true) => {
    if (!user?.currentCompanyId) return;

    if (reset) {
      setLoading(true);
      setLastDoc(null);
    }

    try {
      let q = query(
        collection(db, COLLECTIONS.companyCashMovements(user.currentCompanyId)),
        orderBy('createdAt', 'desc'),
        limit(CASH_REGISTERS_PER_PAGE)
      );

      if (!reset && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      const movementsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      } as CashMovement));

      if (reset) {
        setMovements(movementsData);
      } else {
        setMovements(prev => [...prev, ...movementsData]);
      }

      setHasMore(movementsData.length === CASH_REGISTERS_PER_PAGE);
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

  const loadMoreMovements = () => {
    if (!loading && hasMore) {
      fetchMovements(false);
    }
  };

  // Calculer le solde actuel d'une caisse
  const calculateBalance = async (cashRegisterId: string): Promise<number> => {
    if (!user?.currentCompanyId) return 0;

    try {
      const movementsRef = collection(db, COLLECTIONS.companyCashMovements(user.currentCompanyId));
      const q = query(
        movementsRef,
        where('cashRegisterId', '==', cashRegisterId)
      );
      const snapshot = await getDocs(q);

      let balance = 0;
      snapshot.forEach(doc => {
        const movement = doc.data();
        if (movement.type === 'in') {
          balance += movement.amount;
        } else if (movement.type === 'out') {
          balance -= movement.amount;
        }
        // Les transferts sont gérés avec une entrée et une sortie
      });

      return balance;
    } catch (err) {
      console.error('Erreur lors du calcul du solde:', err);
      return 0;
    }
  };

  // Créer une nouvelle caisse
  const createCashRegister = async (data: Omit<CashRegister, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      // Si la nouvelle caisse est principale, retirer le statut principal des autres
      if (data.isMain) {
        const q = query(
          collection(db, COLLECTIONS.companyCashRegisters(user.currentCompanyId)),
          where('isMain', '==', true)
        );
        const snapshot = await getDocs(q);
        const batch = snapshot.docs.map(docSnap =>
          updateDoc(docSnap.ref, { isMain: false, updatedAt: new Date() })
        );
        await Promise.all(batch);
      }

      const docRef = await addDoc(collection(db, COLLECTIONS.companyCashRegisters(user.currentCompanyId)), {
        ...data,
        companyId: user.currentCompanyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await fetchCashRegisters();
      return { success: true, id: docRef.id };
    } catch (err) {
      console.error('Erreur lors de la création de la caisse:', err);
      throw new Error('Erreur lors de la création de la caisse');
    }
  };

  // Mettre à jour une caisse
  const updateCashRegister = async (id: string, data: Partial<CashRegister>) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      // Si on met cette caisse à principale, retirer le statut principal des autres
      if (data.isMain === true) {
        const q = query(
          collection(db, COLLECTIONS.companyCashRegisters(user.currentCompanyId)),
          where('isMain', '==', true)
        );
        const snapshot = await getDocs(q);
        const batch = snapshot.docs
          .filter(docSnap => docSnap.id !== id) // Ne pas mettre à jour la caisse courante
          .map(docSnap =>
            updateDoc(docSnap.ref, { isMain: false, updatedAt: new Date() })
          );
        await Promise.all(batch);
      }

      const docRef = doc(db, COLLECTIONS.companyCashRegisters(user.currentCompanyId), id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date(),
      });

      await fetchCashRegisters();
      return { success: true };
    } catch (err) {
      console.error('Erreur lors de la mise à jour de la caisse:', err);
      throw new Error('Erreur lors de la mise à jour de la caisse');
    }
  };

  // Supprimer une caisse
  const deleteCashRegister = async (id: string) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const docRef = doc(db, COLLECTIONS.companyCashRegisters(user.currentCompanyId), id);
      await deleteDoc(docRef);
      await fetchCashRegisters();
      return { success: true };
    } catch (err) {
      console.error('Erreur lors de la suppression de la caisse:', err);
      throw new Error('Erreur lors de la suppression de la caisse');
    }
  };

  // Créer un mouvement de caisse
  const createMovement = async (data: CashMovementInput) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      await runTransaction(db, async (transaction) => {
        // Créer le mouvement principal
        const movementsRef = collection(db, COLLECTIONS.companyCashMovements(user.currentCompanyId));
        const movementRef = doc(movementsRef);

        // Construire les données du mouvement sans inclure les champs undefined
        const movementData: any = {
          companyId: user.currentCompanyId,
          cashRegisterId: data.cashRegisterId,
          type: data.type,
          amount: data.amount,
          category: data.category,
          userId: user.id,
          createdAt: new Date(),
        };

        // N'ajouter la description que si elle est définie et non vide
        if (data.description && data.description.trim() !== '') {
          movementData.description = data.description.trim();
        }

        // Pour les transferts, créer aussi le mouvement inverse
        if (data.type === 'transfer' && data.targetCashRegisterId) {
          // Mouvement de sortie (caisse source)
          transaction.set(movementRef, {
            ...movementData,
            targetCashRegisterId: data.targetCashRegisterId,
          });

          // Mouvement d'entrée (caisse cible)
          const targetMovementRef = doc(movementsRef);
          transaction.set(targetMovementRef, {
            companyId: user.currentCompanyId,
            cashRegisterId: data.targetCashRegisterId,
            type: 'in',
            amount: data.amount,
            category: 'transfer',
            sourceCashRegisterId: data.cashRegisterId,
            userId: user.id,
            createdAt: new Date(),
          });
        } else {
          // Mouvement simple (entrée ou sortie)
          transaction.set(movementRef, movementData);
        }
      });

      await fetchMovements(true);
      return { success: true };
    } catch (err) {
      console.error('Erreur lors de la création du mouvement:', err);
      throw new Error('Erreur lors de la création du mouvement');
    }
  };

  // Supprimer un mouvement
  const deleteMovement = async (id: string) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const docRef = doc(db, COLLECTIONS.companyCashMovements(user.currentCompanyId), id);
      await deleteDoc(docRef);
      await fetchMovements(true);
      return { success: true };
    } catch (err) {
      console.error('Erreur lors de la suppression du mouvement:', err);
      throw new Error('Erreur lors de la suppression du mouvement');
    }
  };

  // Obtenir les statistiques d'une caisse pour une période
  const getCashRegisterStats = async (cashRegisterId: string, startDate: Date, endDate: Date) => {
    if (!user?.currentCompanyId) return null;

    try {
      const movementsRef = collection(db, COLLECTIONS.companyCashMovements(user.currentCompanyId));
      const snapshot = await getDocs(
        query(
          movementsRef,
          where('cashRegisterId', '==', cashRegisterId)
        )
      );

      let totalIn = 0;
      let totalOut = 0;
      let transferIn = 0;
      let transferOut = 0;

      snapshot.forEach(doc => {
        const movement = doc.data();
        const movementDate = movement.createdAt?.toDate() || new Date();

        // Filtrer par date
        if (movementDate >= startDate && movementDate <= endDate) {
          if (movement.type === 'in') {
            totalIn += movement.amount;
          } else if (movement.type === 'out') {
            totalOut += movement.amount;
          } else if (movement.type === 'transfer') {
            if (movement.sourceCashRegisterId) {
              // Transfert entrant
              transferIn += movement.amount;
            } else {
              // Transfert sortant
              transferOut += movement.amount;
            }
          }
        }
      });

      return {
        totalIn,
        totalOut,
        transferIn,
        transferOut,
        netChange: totalIn - totalOut + transferIn - transferOut,
      };
    } catch (err) {
      console.error('Erreur lors du calcul des statistiques:', err);
      return null;
    }
  };

  return {
    cashRegisters,
    movements,
    loading,
    error,
    hasMore,
    fetchCashRegisters,
    fetchMovements,
    loadMoreMovements,
    calculateBalance,
    createCashRegister,
    updateCashRegister,
    deleteCashRegister,
    createMovement,
    deleteMovement,
    getCashRegisterStats,
  };
}

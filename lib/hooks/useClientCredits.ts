'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  limit,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase';
import { useAuth } from './useAuth';
import { useCashRegistersStore } from '@/lib/stores/useCashRegistersStore';
import type { ClientCredit, ClientCreditPayment, PaymentMode } from '@/types';

export interface ClientCreditInput {
  clientId?: string;
  clientName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  amount: number;
  dueDate?: Date;
  notes?: string;
}

export interface PaymentInput {
  amount: number;
  paymentMode: PaymentMode;
  notes?: string;
}

export function useClientCredits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<ClientCredit[]>([]);
  const [payments, setPayments] = useState<Record<string, ClientCreditPayment[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.currentCompanyId) {
      fetchCredits();
    }
  }, [user]);

  const fetchCredits = async () => {
    if (!user?.currentCompanyId) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, COLLECTIONS.companyClientCredits(user.currentCompanyId)),
        orderBy('date', 'desc')
      );

      const snapshot = await getDocs(q);
      const creditsData = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          date: data.date?.toDate() || new Date(),
          dueDate: data.dueDate?.toDate(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as ClientCredit;
      });

      setCredits(creditsData);

      // Récupérer les paiements pour chaque crédit
      const paymentsMap: Record<string, ClientCreditPayment[]> = {};
      await Promise.all(
        creditsData.map(async (credit) => {
          const paymentsQuery = query(
            collection(db, COLLECTIONS.companyClientCreditPayments(user.currentCompanyId)),
            where('creditId', '==', credit.id),
            orderBy('createdAt', 'desc')
          );
          const paymentsSnap = await getDocs(paymentsQuery);
          paymentsMap[credit.id] = paymentsSnap.docs.map(p => ({
            id: p.id,
            ...p.data(),
            createdAt: p.data().createdAt?.toDate() || new Date(),
          } as ClientCreditPayment));
        })
      );
      setPayments(paymentsMap);
    } catch (err) {
      console.error('Erreur lors du chargement des crédits:', err);
      setError('Erreur lors du chargement des crédits');
    } finally {
      setLoading(false);
    }
  };

  const createCredit = async (data: ClientCreditInput) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const remainingAmount = data.amount;

      const docRef = await addDoc(collection(db, COLLECTIONS.companyClientCredits(user.currentCompanyId)), {
        ...data,
        amountPaid: 0,
        remainingAmount,
        status: 'active',
        companyId: user.currentCompanyId,
        date: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await fetchCredits();
      return { success: true, id: docRef.id };
    } catch (err) {
      console.error('Erreur lors de la création du crédit:', err);
      throw new Error('Erreur lors de la création du crédit');
    }
  };

  const addPayment = async (creditId: string, data: PaymentInput) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      await runTransaction(db, async (transaction) => {
        // Récupérer le crédit
        const creditRef = doc(db, COLLECTIONS.companyClientCredits(user.currentCompanyId), creditId);
        const creditSnap = await getDoc(creditRef);

        if (!creditSnap.exists()) {
          throw new Error('Crédit non trouvé');
        }

        const credit = creditSnap.data() as ClientCredit;

        // Vérifier que le paiement ne dépasse pas le reste
        if (data.amount > credit.remainingAmount) {
          throw new Error('Le paiement dépasse le montant restant');
        }

        // Créer le paiement
        const paymentsRef = collection(db, COLLECTIONS.companyClientCreditPayments(user.currentCompanyId));
        const paymentRef = doc(paymentsRef);
        transaction.set(paymentRef, {
          creditId,
          amount: data.amount,
          paymentMode: data.paymentMode,
          notes: data.notes,
          userId: user.id,
          createdAt: new Date(),
        });

        // Mettre à jour le crédit
        const newAmountPaid = credit.amountPaid + data.amount;
        const newRemainingAmount = credit.remainingAmount - data.amount;
        const newStatus = newRemainingAmount === 0 ? 'paid' : 'partial';

        transaction.update(creditRef, {
          amountPaid: newAmountPaid,
          remainingAmount: newRemainingAmount,
          status: newStatus,
          updatedAt: new Date(),
        });

        // Créer un mouvement de caisse pour le paiement
        const cashRegistersRef = collection(db, COLLECTIONS.companyCashRegisters(user.currentCompanyId));
        const cashRegistersSnap = await getDocs(query(cashRegistersRef, where('isMain', '==', true)));

        let cashRegisterId: string | null = null;
        if (!cashRegistersSnap.empty) {
          cashRegisterId = cashRegistersSnap.docs[0].id;
        } else {
          const allCashRegistersSnap = await getDocs(query(cashRegistersRef, limit(1)));
          if (!allCashRegistersSnap.empty) {
            cashRegisterId = allCashRegistersSnap.docs[0].id;
          }
        }

        if (cashRegisterId) {
          const movementsRef = collection(db, COLLECTIONS.companyCashMovements(user.currentCompanyId));
          const movementRef = doc(movementsRef);

          let category = 'sale';
          if (data.paymentMode === 'mobile') category = 'mobile_money';
          else if (data.paymentMode === 'bank') category = 'bank';
          else if (data.paymentMode === 'cash') category = 'cash';

          transaction.set(movementRef, {
            companyId: user.currentCompanyId,
            cashRegisterId,
            type: 'in',
            amount: data.amount,
            category,
            description: `Paiement crédit - ${credit.clientName}`,
            referenceId: creditId,
            referenceType: 'client_credit_payment',
            userId: user.id,
            createdAt: new Date(),
          });
        }
      });

      await fetchCredits();

      // Rafraîchir les soldes des caisses après création du mouvement
      try {
        const cashStore = useCashRegistersStore.getState();
        await cashStore.refreshBalances(false, user.currentCompanyId);
      } catch (error) {
        console.error('[addPayment] Erreur lors du rafraîchissement des soldes:', error);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Erreur lors de l\'ajout du paiement:', err);
      throw new Error(err.message || 'Erreur lors de l\'ajout du paiement');
    }
  };

  const updateCredit = async (id: string, data: Partial<ClientCredit>) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const docRef = doc(db, COLLECTIONS.companyClientCredits(user.currentCompanyId), id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date(),
      });

      await fetchCredits();
      return { success: true };
    } catch (err) {
      console.error('Erreur lors de la mise à jour du crédit:', err);
      throw new Error('Erreur lors de la mise à jour du crédit');
    }
  };

  const deleteCredit = async (id: string) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const docRef = doc(db, COLLECTIONS.companyClientCredits(user.currentCompanyId), id);
      await deleteDoc(docRef);

      await fetchCredits();
      return { success: true };
    } catch (err) {
      console.error('Erreur lors de la suppression du crédit:', err);
      throw new Error('Erreur lors de la suppression du crédit');
    }
  };

  const getClientCredits = (clientId: string) => {
    return credits.filter(c => c.clientId === clientId && c.status !== 'paid' && c.status !== 'cancelled');
  };

  const getClientBalance = (clientId: string) => {
    const clientCredits = getClientCredits(clientId);
    return clientCredits.reduce((sum, c) => sum + c.remainingAmount, 0);
  };

  return {
    credits,
    payments,
    loading,
    error,
    fetchCredits,
    createCredit,
    addPayment,
    updateCredit,
    deleteCredit,
    getClientCredits,
    getClientBalance,
  };
}

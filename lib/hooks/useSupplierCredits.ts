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
  increment,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase';
import { useAuth } from './useAuth';
import { useCashRegistersStore } from '@/lib/stores/useCashRegistersStore';
import type { SupplierCredit, SupplierCreditPayment, PaymentMode } from '@/types';

export interface SupplierCreditInput {
  supplierId?: string;
  supplierName: string;
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

export function useSupplierCredits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<SupplierCredit[]>([]);
  const [payments, setPayments] = useState<Record<string, SupplierCreditPayment[]>>({});
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
        collection(db, COLLECTIONS.companySupplierCredits(user.currentCompanyId)),
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
        } as SupplierCredit;
      });

      setCredits(creditsData);

      // Récupérer les paiements pour chaque crédit
      const paymentsMap: Record<string, SupplierCreditPayment[]> = {};
      await Promise.all(
        creditsData.map(async (credit) => {
          const paymentsQuery = query(
            collection(db, COLLECTIONS.companySupplierCreditPayments(user.currentCompanyId)),
            where('creditId', '==', credit.id),
            orderBy('createdAt', 'desc')
          );
          const paymentsSnap = await getDocs(paymentsQuery);
          paymentsMap[credit.id] = paymentsSnap.docs.map(p => ({
            id: p.id,
            ...p.data(),
            createdAt: p.data().createdAt?.toDate() || new Date(),
          } as SupplierCreditPayment));
        })
      );
      setPayments(paymentsMap);
    } catch (err) {
      console.error('Erreur lors du chargement des crédits fournisseurs:', err);
      setError('Erreur lors du chargement des crédits fournisseurs');
    } finally {
      setLoading(false);
    }
  };

  const createCredit = async (data: SupplierCreditInput) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const remainingAmount = data.amount;

      const docRef = await addDoc(collection(db, COLLECTIONS.companySupplierCredits(user.currentCompanyId)), {
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
      console.error('Erreur lors de la création du crédit fournisseur:', err);
      throw new Error('Erreur lors de la création du crédit fournisseur');
    }
  };

  const addPayment = async (creditId: string, data: PaymentInput) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      await runTransaction(db, async (transaction) => {
        // Récupérer le crédit
        const creditRef = doc(db, COLLECTIONS.companySupplierCredits(user.currentCompanyId), creditId);
        const creditSnap = await getDoc(creditRef);

        if (!creditSnap.exists()) {
          throw new Error('Crédit non trouvé');
        }

        const credit = creditSnap.data() as SupplierCredit;

        // Vérifier que le paiement ne dépasse pas le reste
        if (data.amount > credit.remainingAmount) {
          throw new Error('Le paiement dépasse le montant restant');
        }

        // Créer le paiement
        const paymentsRef = collection(db, COLLECTIONS.companySupplierCreditPayments(user.currentCompanyId));
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

        // Créer un mouvement de caisse (sortie d'argent)
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

          let category = 'supplier';
          if (data.paymentMode === 'mobile') category = 'mobile_money';
          else if (data.paymentMode === 'bank') category = 'bank';
          else if (data.paymentMode === 'cash') category = 'cash';

          transaction.set(movementRef, {
            companyId: user.currentCompanyId,
            cashRegisterId,
            type: 'out',
            amount: data.amount,
            category,
            description: `Paiement fournisseur - ${credit.supplierName}`,
            referenceId: creditId,
            referenceType: 'supplier_credit_payment',
            userId: user.id,
            createdAt: new Date(),
          });

          // Mettre à jour le solde de la caisse atomiquement (sortie = débit)
          const cashRegisterRef = doc(db, COLLECTIONS.companyCashRegisters(user.currentCompanyId), cashRegisterId);
          transaction.update(cashRegisterRef, {
            currentBalance: increment(-data.amount),
            updatedAt: new Date(),
          });
        }
      });

      await fetchCredits();

      return { success: true };
    } catch (err: any) {
      console.error('Erreur lors de l\'ajout du paiement:', err);
      throw new Error(err.message || 'Erreur lors de l\'ajout du paiement');
    }
  };

  const updateCredit = async (id: string, data: Partial<SupplierCredit>) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const docRef = doc(db, COLLECTIONS.companySupplierCredits(user.currentCompanyId), id);
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
      const docRef = doc(db, COLLECTIONS.companySupplierCredits(user.currentCompanyId), id);
      await deleteDoc(docRef);

      await fetchCredits();
      return { success: true };
    } catch (err) {
      console.error('Erreur lors de la suppression du crédit:', err);
      throw new Error('Erreur lors de la suppression du crédit');
    }
  };

  const getSupplierCredits = (supplierId: string) => {
    return credits.filter(c => c.supplierId === supplierId && c.status !== 'paid' && c.status !== 'cancelled');
  };

  const getSupplierDebt = (supplierId: string) => {
    const supplierCredits = getSupplierCredits(supplierId);
    return supplierCredits.reduce((sum, c) => sum + c.remainingAmount, 0);
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
    getSupplierCredits,
    getSupplierDebt,
  };
}

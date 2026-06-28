'use client';

import {
  collection,
  addDoc,
  runTransaction,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  increment,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase';
import { useAuth } from './useAuth';
import { getMainCashRegisterId } from '@/lib/utils/cash-register';
import type { SupplierCredit, SupplierCreditPayment, PaymentMode } from '@/types';

export interface SupplierCreditInput {
  supplierId?: string;
  supplierName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  amount: number;
  date?: Date;
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

  const createCredit = async (data: SupplierCreditInput) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const remainingAmount = data.amount;
      const creditDate = data.date || new Date();

      // Construire l'objet sans champs undefined
      const creditData: Record<string, any> = {
        supplierId: data.supplierId,
        supplierName: data.supplierName,
        amount: data.amount,
        date: creditDate,
        amountPaid: 0,
        remainingAmount,
        status: 'active',
        companyId: user.currentCompanyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      if (data.invoiceId) creditData.invoiceId = data.invoiceId;
      if (data.invoiceNumber) creditData.invoiceNumber = data.invoiceNumber;
      if (data.dueDate) creditData.dueDate = data.dueDate;
      if (data.notes) creditData.notes = data.notes;

      const docRef = await addDoc(collection(db, COLLECTIONS.companySupplierCredits(user.currentCompanyId)), creditData);

      // Mettre à jour le currentDebt du fournisseur
      if (data.supplierId) {
        const supplierRef = doc(db, COLLECTIONS.companySuppliers(user.currentCompanyId), data.supplierId);
        const supplierSnap = await getDoc(supplierRef);
        if (supplierSnap.exists()) {
          const supplierData = supplierSnap.data();
          await updateDoc(supplierRef, {
            currentDebt: (supplierData.currentDebt || 0) + remainingAmount,
            updatedAt: new Date(),
          });
        }
      }

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

        // Créer le paiement (dénormalisé dans le doc crédit)
        const newPayment: SupplierCreditPayment = {
          id: doc(collection(db, COLLECTIONS.companySupplierCreditPayments(user.currentCompanyId))).id,
          creditId,
          amount: data.amount,
          paymentMode: data.paymentMode,
          notes: data.notes,
          userId: user.id,
          createdAt: new Date(),
        };

        const existingPayments: SupplierCreditPayment[] = Array.isArray((credit as any).payments)
          ? (credit as any).payments
          : [];

        // Mettre à jour le crédit (paiements dénormalisés)
        const newAmountPaid = credit.amountPaid + data.amount;
        const newRemainingAmount = credit.remainingAmount - data.amount;
        const newStatus = newRemainingAmount === 0 ? 'paid' : 'partial';

        transaction.update(creditRef, {
          payments: [newPayment, ...existingPayments],
          amountPaid: newAmountPaid,
          remainingAmount: newRemainingAmount,
          status: newStatus,
          updatedAt: new Date(),
        });

        // Créer un mouvement de caisse (sortie d'argent)
        const cashRegisterId = await getMainCashRegisterId(user.currentCompanyId);

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

      return { success: true };
    } catch (err) {
      console.error('Erreur lors de la suppression du crédit:', err);
      throw new Error('Erreur lors de la suppression du crédit');
    }
  };

  return {
    createCredit,
    addPayment,
    updateCredit,
    deleteCredit,
  };
}

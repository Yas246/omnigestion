'use client';

import { runTransaction, doc, getDoc, collection, addDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase';
import { useAuth } from './useAuth';
import { useCashRegistersStore } from '@/lib/stores/useCashRegistersStore';

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number; // Prix d'achat
}

export interface PurchaseInput {
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  paymentMethod: 'cash' | 'bank' | 'mobile' | 'credit';
  paidAmount: number;
  addToStockNow: boolean;
  warehouseId?: string;
  notes?: string;
}

export function useSupplierPurchases() {
  const { user } = useAuth();

  const createPurchase = async (data: PurchaseInput) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    // Variable pour stocker l'ID de la caisse utilisée (pour refreshBalances après transaction)
    let cashRegisterId: string | null = null;

    try {
      const result = await runTransaction(db, async (transaction) => {
        const total = data.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        const remainingAmount = total - data.paidAmount;
        const status = remainingAmount === 0 ? 'paid' : data.paidAmount === 0 ? 'active' : 'partial';

        // Générer un numéro de bon
        const purchaseNumber = `ACH-${Date.now().toString().slice(-8)}`;

        // 1. Créer le bon d'achat
        const purchasesRef = collection(db, COLLECTIONS.companyPurchases(user.currentCompanyId));
        const purchaseRef = doc(purchasesRef);
        transaction.set(purchaseRef, {
          companyId: user.currentCompanyId,
          supplierId: data.supplierId,
          supplierName: data.supplierName,
          purchaseNumber,
          items: data.items,
          total,
          paidAmount: data.paidAmount,
          remainingAmount,
          status,
          paymentMethod: data.paymentMethod,
          notes: data.notes,
          userId: user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // 2. Mettre à jour le prix d'achat de chaque produit si changé et créer mouvements de stock si demandé
        for (const item of data.items) {
          const productRef = doc(db, COLLECTIONS.companyProducts(user.currentCompanyId), item.productId);
          const productSnap = await getDoc(productRef);

          if (productSnap.exists()) {
            const productData = productSnap.data();
            const currentPurchasePrice = productData.purchasePrice || 0;

            // Mettre à jour le prix d'achat SEULEMENT si différent du prix actuel
            if (currentPurchasePrice !== item.unitPrice) {
              transaction.update(productRef, {
                purchasePrice: item.unitPrice,
                updatedAt: new Date(),
              });
            }

            // Si on ajoute au stock maintenant
            if (data.addToStockNow && data.warehouseId) {
              const currentStock = productData.currentStock || 0;
              const newStock = currentStock + item.quantity;

              transaction.update(productRef, {
                currentStock: newStock,
                status: newStock === 0 ? 'out' : newStock <= (productData.alertThreshold || 10) ? 'low' : 'ok',
                updatedAt: new Date(),
              });

              // Créer un mouvement de stock
              const stockMovementsRef = collection(db, COLLECTIONS.companyStockMovements(user.currentCompanyId));
              const movementRef = doc(stockMovementsRef);
              transaction.set(movementRef, {
                companyId: user.currentCompanyId,
                productId: item.productId,
                warehouseId: data.warehouseId,
                type: 'in',
                quantity: item.quantity,
                reason: `Achat fournisseur - ${data.supplierName}`,
                referenceId: purchaseRef.id,
                referenceType: 'purchase',
                userId: user.id,
                createdAt: new Date(),
              });
            }
          }
        }

        // 3. Créer un mouvement de caisse (sortie) si payé
        if (data.paidAmount > 0 && data.paymentMethod !== 'credit') {
          const cashRegistersRef = collection(db, COLLECTIONS.companyCashRegisters(user.currentCompanyId));
          const cashRegistersSnap = await getDocs(query(cashRegistersRef, where('isMain', '==', true)));

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
            if (data.paymentMethod === 'mobile') category = 'mobile_money';
            else if (data.paymentMethod === 'bank') category = 'bank';
            else if (data.paymentMethod === 'cash') category = 'cash';

            transaction.set(movementRef, {
              companyId: user.currentCompanyId,
              cashRegisterId,
              type: 'out',
              amount: data.paidAmount,
              category,
              description: `Achat fournisseur - ${data.supplierName}`,
              referenceId: purchaseRef.id,
              referenceType: 'purchase',
              userId: user.id,
              createdAt: new Date(),
            });
          }
        }

        // 4. Créer un crédit fournisseur si reste à payer
        if (remainingAmount > 0) {
          const creditsRef = collection(db, COLLECTIONS.companySupplierCredits(user.currentCompanyId));
          const creditRef = doc(creditsRef);

          transaction.set(creditRef, {
            companyId: user.currentCompanyId,
            supplierId: data.supplierId,
            supplierName: data.supplierName,
            invoiceId: purchaseRef.id,
            invoiceNumber: purchaseNumber,
            amount: total,
            amountPaid: data.paidAmount,
            remainingAmount,
            status,
            date: new Date(),
            notes: `Achat fournisseur ${purchaseNumber}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        return {
          id: purchaseRef.id,
          purchaseNumber,
          total,
          remainingAmount,
        };
      });

      // Rafraîchir les soldes des caisses après création du mouvement
      if (cashRegisterId) {
        try {
          const cashStore = useCashRegistersStore.getState();
          await cashStore.refreshBalances(false, user.currentCompanyId);
        } catch (error) {
          console.error('[addPurchase] Erreur lors du rafraîchissement des soldes:', error);
        }
      }

      return result;
    } catch (err: any) {
      console.error('Erreur lors de la création de l\'achat:', err);
      throw new Error(err.message || 'Erreur lors de la création de l\'achat');
    }
  };

  return {
    createPurchase,
  };
}

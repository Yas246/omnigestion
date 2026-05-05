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
  setDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase';
import { useAuth } from './useAuth';
import { useSettings } from './useSettings';
import { offlineInvoices } from '@/lib/indexeddb/offline-invoices';
import { invoiceSync, type SyncOptions } from '@/lib/services/invoice-sync';
import { useCashRegistersStore } from '@/lib/stores/useCashRegistersStore';
import type { Invoice, InvoiceItem, Warehouse } from '@/types';

const INVOICES_PER_PAGE = 50;

export interface InvoiceItemInput {
  productId: string;
  productName: string;
  productCode?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  purchasePrice?: number;
  isWholesale: boolean;
}

export interface InvoiceCreateInput {
  clientId?: string;
  clientName?: string;
  items: InvoiceItemInput[];
  taxRate: number;
  discount: number;
  paymentMethod?: 'cash' | 'bank' | 'mobile' | 'credit';
  paidAmount: number;
  saleDate?: Date; // Date de la vente (optionnel, défaut: aujourd'hui)
  dueDate?: Date;
  notes?: string;
  // Mobile Money
  mobileNumber?: string;
  // Paiement bancaire
  bankName?: string;
  accountNumber?: string;
  transactionNumber?: string;
}

export function useInvoices() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // États pour la gestion offline
  const [isOnline, setIsOnline] = useState(true);
  const [pendingInvoicesCount, setPendingInvoicesCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    if (user?.currentCompanyId) {
      fetchInvoices();
    }
  }, [user]);

  // Écouter les événements de connexion
  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);

      if (online && pendingInvoicesCount > 0) {
        // Tentative de synchronisation automatique quand on passe en ligne
        syncPendingInvoices();
      }
    };

    // Initialiser le statut
    updateOnlineStatus();

    // Écouter les événements
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Mettre à jour le compteur de factures en attente
    updatePendingCount();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [pendingInvoicesCount]);

  // Filtrer les factures en fonction de la recherche
  useEffect(() => {
    if (!searchQuery || searchQuery.trim() === '') {
      setInvoices(allInvoices);
    } else {
      const query = searchQuery.toLowerCase().trim();
      const filtered = allInvoices.filter((invoice) => {
        const matchesNumber = invoice.invoiceNumber?.toLowerCase().includes(query);
        const matchesClient = invoice.clientName?.toLowerCase().includes(query);
        return matchesNumber || matchesClient;
      });
      setInvoices(filtered);
    }
  }, [searchQuery, allInvoices]);

  const fetchInvoices = async (reset = true) => {
    if (!user?.currentCompanyId) return;

    if (reset) {
      setLoading(true);
      setLastDoc(null);
    }

    setError(null);

    try {
      let q = query(
        collection(db, COLLECTIONS.companyInvoices(user.currentCompanyId)),
        orderBy('date', 'desc'),
        limit(INVOICES_PER_PAGE)
      );

      if (!reset && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      const invoicesData = snapshot.docs.map(
        (doc) => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate() || new Date(),
          dueDate: doc.data().dueDate?.toDate(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          validatedAt: doc.data().validatedAt?.toDate(),
          paidAt: doc.data().paidAt?.toDate(),
        } as Invoice)
      );

      if (reset) {
        setAllInvoices(invoicesData);
        setInvoices(invoicesData);
      } else {
        setAllInvoices((prev) => [...prev, ...invoicesData]);
        setInvoices((prev) => [...prev, ...invoicesData]);
      }

      setHasMore(invoicesData.length === INVOICES_PER_PAGE);
      if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
    } catch (err) {
      console.error('Erreur lors du chargement des factures:', err);
      setError('Erreur lors du chargement des factures');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchInvoices(false);
    }
  };

  /**
   * Vérifier le stock avant création/modification de facture et retourner les produits nécessitant un transfert.
   *
   * En mode modification (oldItems fourni), ne vérifie le stock que pour le DIFF :
   * - Produits nouveaux (pas dans oldItems) → vérifier stock complet
   * - Produits existants avec qty augmentée → vérifier stock pour la différence
   * - Produits inchangés ou diminués → SKIP (pas besoin de vérifier)
   */
  const checkStockBeforeInvoice = async (
    items: InvoiceItem[],
    primaryWarehouseId: string | undefined,
    oldItems?: InvoiceItem[]
  ): Promise<{
    canCreateInvoice: boolean;
    productsNeedingTransfer: Array<{
      productId: string;
      productName: string;
      requiredQuantity: number;
      availableInPrimary: number;
      missingQuantity: number;
      availableInOtherWarehouses: Array<{
        warehouseId: string;
        warehouseName: string;
        availableQuantity: number;
      }>;
    }>;
  }> => {
    if (!user?.currentCompanyId) {
      throw new Error('Utilisateur non connecté');
    }

    const productsNeedingTransfer: Array<{
      productId: string;
      productName: string;
      requiredQuantity: number;
      availableInPrimary: number;
      missingQuantity: number;
      availableInOtherWarehouses: Array<{
        warehouseId: string;
        warehouseName: string;
        availableQuantity: number;
      }>;
    }> = [];

    // Récupérer tous les entrepôts
    const warehousesSnapshot = await getDocs(
      query(collection(db, COLLECTIONS.companyWarehouses(user.currentCompanyId)))
    );
    const warehouses = warehousesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Warehouse));

    console.log(`[checkStockBeforeInvoice] Dépôt principal: ${primaryWarehouseId}`);
    console.log(`[checkStockBeforeInvoice] ${warehouses.length} dépôts trouvés:`, warehouses.map(w => `${w.name} (${w.id})`).join(', '));

    // Construire le map des quantités anciennes si en mode modification
    const oldQtyMap = new Map<string, number>();
    if (oldItems) {
      for (const item of oldItems) {
        oldQtyMap.set(item.productId, (oldQtyMap.get(item.productId) || 0) + item.quantity);
      }
      console.log(`[checkStockBeforeInvoice] MODE MODIFICATION — oldQtyMap:`, Object.fromEntries(oldQtyMap));
    }

    // Construire le map des quantités nouvelles
    const newQtyMap = new Map<string, number>();
    for (const item of items) {
      newQtyMap.set(item.productId, (newQtyMap.get(item.productId) || 0) + item.quantity);
    }

    // Ne vérifier que les produits dont la quantité augmente (diff > 0)
    for (const [productId, newQty] of newQtyMap) {
      const oldQty = oldQtyMap.get(productId) || 0;
      const diff = newQty - oldQty;

      console.log(`[checkStockBeforeInvoice] Produit ${productId}: oldQty=${oldQty}, newQty=${newQty}, diff=${diff}`);

      if (diff <= 0) {
        console.log(`[checkStockBeforeInvoice] → SKIP ${productId} (diff=${diff}, stock ${diff < 0 ? 'sera restauré' : 'inchangé'})`);
        continue;
      }

      // Trouver le nom du produit
      const item = items.find(i => i.productId === productId);
      const productName = item?.productName || productId;

      // Récupérer le stock depuis warehouse_quantities
      const warehouseQuantitiesRef = doc(
        db,
        `companies/${user.currentCompanyId}/warehouse_quantities`,
        productId
      );
      const warehouseQuantitiesDoc = await getDoc(warehouseQuantitiesRef);

      let quantities: any[] = [];
      if (warehouseQuantitiesDoc.exists()) {
        quantities = warehouseQuantitiesDoc.data().quantities || [];
      }

      const primaryEntry = quantities.find((q: any) => q.warehouseId === primaryWarehouseId);
      let availableInPrimary = primaryEntry?.quantity || 0;

      console.log(`[checkStockBeforeInvoice] Stock pour ${productName}: dépôt principal (${primaryWarehouseId}): ${availableInPrimary}, besoin de ${diff}`);

      // Vérifier si le stock est insuffisant dans le dépôt principal pour le diff
      if (availableInPrimary < diff) {
        const missingQuantity = diff - availableInPrimary;

        // Chercher dans les autres dépôts
        const otherWarehousesStock: Array<{
          warehouseId: string;
          warehouseName: string;
          availableQuantity: number;
        }> = [];

        for (const warehouse of warehouses) {
          if (warehouse.id === primaryWarehouseId) continue;

          const entry = quantities.find((q: any) => q.warehouseId === warehouse.id);
          const availableQuantity = entry?.quantity || 0;

          if (availableQuantity > 0) {
            otherWarehousesStock.push({
              warehouseId: warehouse.id,
              warehouseName: warehouse.name,
              availableQuantity,
            });
          }
        }

        otherWarehousesStock.sort((a, b) => b.availableQuantity - a.availableQuantity);

        productsNeedingTransfer.push({
          productId,
          productName,
          requiredQuantity: diff,
          availableInPrimary,
          missingQuantity,
          availableInOtherWarehouses: otherWarehousesStock,
        });
      }
    }

    // Vérifier si tous les produits ont un stock suffisant (même avec transferts)
    const allProductsHaveStock = productsNeedingTransfer.every(
      p => p.availableInOtherWarehouses.reduce((sum, w) => sum + w.availableQuantity, 0) >= p.missingQuantity
    );

    return {
      canCreateInvoice: allProductsHaveStock,
      productsNeedingTransfer,
    };
  };

  /**
   * Effectuer les transferts de stock automatiquement
   */
  const executeStockTransfers = async (
    transfers: Array<{ productId: string; fromWarehouseId: string; quantity: number }>,
    primaryWarehouseId: string
  ): Promise<void> => {
    if (!user?.currentCompanyId) {
      throw new Error('Utilisateur non connecté');
    }

    await runTransaction(db, async (transaction) => {
      for (const transfer of transfers) {
        const { productId, fromWarehouseId, quantity } = transfer;

        // 1. Lire warehouse_quantities pour le produit
        const warehouseQuantitiesRef = doc(
          db,
          `companies/${user.currentCompanyId}/warehouse_quantities`,
          productId
        );
        const warehouseQuantitiesDoc = await getDoc(warehouseQuantitiesRef);

        let quantities: any[] = [];
        if (warehouseQuantitiesDoc.exists()) {
          quantities = warehouseQuantitiesDoc.data().quantities || [];
        }

        // 2. Vérifier stock source
        const fromEntry = quantities.find((q: any) => q.warehouseId === fromWarehouseId);
        const fromQuantity = fromEntry?.quantity || 0;

        if (fromQuantity < quantity) {
          throw new Error(`Stock insuffisant dans le dépôt source (${fromQuantity} < ${quantity})`);
        }

        const newFromQuantity = fromQuantity - quantity;

        // 3. Calculer nouvelle quantité destination
        const toEntry = quantities.find((q: any) => q.warehouseId === primaryWarehouseId);
        const newToQuantity = (toEntry?.quantity || 0) + quantity;

        // Stock total (ne change pas pour un transfert)
        const transferTotal = quantities.reduce((sum: number, q: any) => sum + q.quantity, 0);

        // 4. Mettre à jour les quantités pour les deux dépôts
        const updatedQuantities = quantities.map((q: any) => {
          if (q.warehouseId === fromWarehouseId) {
            return { ...q, quantity: newFromQuantity };
          }
          if (q.warehouseId === primaryWarehouseId) {
            return { ...q, quantity: newToQuantity };
          }
          return q;
        });

        if (!updatedQuantities.some((q: any) => q.warehouseId === fromWarehouseId)) {
          updatedQuantities.push({
            warehouseId: fromWarehouseId,
            warehouseName: fromWarehouseId,
            quantity: newFromQuantity,
          });
        }

        if (!updatedQuantities.some((q: any) => q.warehouseId === primaryWarehouseId)) {
          updatedQuantities.push({
            warehouseId: primaryWarehouseId,
            warehouseName: primaryWarehouseId,
            quantity: newToQuantity,
          });
        }

        transaction.set(warehouseQuantitiesRef, {
          productId: productId,
          quantities: updatedQuantities,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // 3. Créer le mouvement de transfert
        const movementsCollection = collection(db, COLLECTIONS.companyStockMovements(user.currentCompanyId));

        // Mouvement de sortie
        const fromMovementRef = doc(movementsCollection);
        transaction.set(fromMovementRef, {
          companyId: user.currentCompanyId,
          productId,
          warehouseId: fromWarehouseId,
          type: 'transfer',
          quantity: -quantity,
          reason: 'Transfert automatique pour vente',
          referenceType: 'auto_transfer_for_sale',
          userId: user.id,
          userName: user.displayName || user.email,
          quantityBefore: transferTotal,
          quantityAfter: transferTotal,
          createdAt: new Date(),
        });

        // Mouvement d'entrée
        const toMovementRef = doc(movementsCollection);
        transaction.set(toMovementRef, {
          companyId: user.currentCompanyId,
          productId,
          warehouseId: primaryWarehouseId,
          type: 'transfer',
          quantity: quantity,
          reason: 'Transfert automatique pour vente',
          referenceType: 'auto_transfer_for_sale',
          userId: user.id,
          userName: user.displayName || user.email,
          quantityBefore: transferTotal,
          quantityAfter: transferTotal,
          createdAt: new Date(),
        });

        console.log(`[executeStockTransfers] Transféré ${quantity} unités de ${productId} de ${fromWarehouseId} vers ${primaryWarehouseId}`);
      }
    });

    console.log(`[executeStockTransfers] ${transfers.length} transfert(s) effectué(s) avec succès`);
  };

  /**
   * Créer une nouvelle facture avec validation des prix et transaction atomique
   */
  const createInvoice = async (data: InvoiceCreateInput) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');
    if (data.items.length === 0) throw new Error('Ajoutez au moins un produit à la facture');

    // Variable pour stocker les mises à jour de produits (pour le cache IndexedDB)
    const productUpdates: Array<{ productId: string; newStock: number; deduction: number }> = [];

    // Variable pour collecter les alertes de stock à envoyer après la transaction
    const stockAlerts: Array<{ productId: string; productName: string; newStock: number; threshold: number; status: 'out' | 'low' }> = [];

    // Variable pour stocker l'ID de la caisse utilisée (pour refreshBalances après transaction)
    let cashRegisterId: string | null = null;

    try {
      const result = await runTransaction(db, async (transaction) => {
        // 1. Valider les prix (anti-perte)
        for (const item of data.items) {
          if (item.purchasePrice && item.unitPrice < item.purchasePrice) {
            throw new Error(
              `Prix de vente invalide pour ${item.productName}: ${item.unitPrice} < ${item.purchasePrice} (prix d'achat)`
            );
          }
        }

        // 1b. Générer le numéro de facture en premier (nécessaire pour les mouvements de stock)
        const settingsRef = doc(db, COLLECTIONS.companySettings(user.currentCompanyId), 'invoice');
        const settingsSnap = await getDoc(settingsRef);

        let nextNumber: number;
        let prefix: string;

        if (settingsSnap.exists()) {
          const settingsData = settingsSnap.data();
          nextNumber = settingsData.nextNumber || 1;
          prefix = settingsData.prefix || 'FAC';
          transaction.update(settingsRef, {
            nextNumber: nextNumber + 1,
            updatedAt: new Date(),
          });
        } else {
          nextNumber = 1;
          prefix = settings?.invoice?.prefix || 'FAC';
          transaction.set(settingsRef, {
            prefix,
            nextNumber: 2,
            updatedAt: new Date(),
          });
        }

        const invoiceNumber = `${prefix}-${String(nextNumber).padStart(4, '0')}`;

        // 2. Vérifier et déduire le stock
        productUpdates.length = 0; // Vider le tableau avant de le remplir

        for (const item of data.items) {
          console.log('[createInvoice] Traitement item:', {
            productName: item.productName,
            productId: item.productId,
            productIdType: typeof item.productId,
          });

          if (!item.productId) {
            throw new Error(`productId manquant pour le produit: ${item.productName}`);
          }

          const productRef = doc(db, COLLECTIONS.companyProducts(user.currentCompanyId), item.productId);
          const productSnap = await getDoc(productRef);

          if (!productSnap.exists()) {
            console.error('[createInvoice] Produit non trouvé', {
              productId: item.productId,
              productName: item.productName,
              path: `${COLLECTIONS.companyProducts(user.currentCompanyId)}/${item.productId}`,
            });
            throw new Error(`Produit non trouvé: ${item.productName} (ID: ${item.productId})`);
          }

          const productData = productSnap.data();

          // Lire warehouse_quantities (source de vérité pour le stock)
          const primaryWarehouseId = settings?.stock?.defaultWarehouseId;
          const warehouseQuantitiesRef = doc(
            db,
            `companies/${user.currentCompanyId}/warehouse_quantities`,
            item.productId
          );
          const warehouseQuantitiesDoc = await getDoc(warehouseQuantitiesRef);

          let quantities: any[] = [];
          if (warehouseQuantitiesDoc.exists()) {
            quantities = warehouseQuantitiesDoc.data().quantities || [];
          }

          // Vérifier le stock dans le dépôt principal
          if (primaryWarehouseId) {
            const primaryEntry = quantities.find((q: any) => q.warehouseId === primaryWarehouseId);
            const availableInPrimary = primaryEntry?.quantity || 0;

            if (availableInPrimary < item.quantity) {
              throw new Error(
                `Stock insuffisant dans le dépôt principal pour ${item.productName}: ${availableInPrimary} ${item.unit} disponibles (besoin de ${item.quantity})`
              );
            }
          }

          // Calculer les nouvelles quantités warehouse
          const totalStockBefore = quantities.reduce((sum: number, q: any) => sum + q.quantity, 0);
          let updatedQuantities = [...quantities];
          let currentPrimaryQuantity = 0;
          let newPrimaryQuantity = 0;
          if (primaryWarehouseId) {
            currentPrimaryQuantity = updatedQuantities.find((q: any) => q.warehouseId === primaryWarehouseId)?.quantity || 0;
            newPrimaryQuantity = currentPrimaryQuantity - item.quantity;

            updatedQuantities = updatedQuantities.map((q: any) =>
              q.warehouseId === primaryWarehouseId
                ? { ...q, quantity: newPrimaryQuantity }
                : q
            );

            if (!updatedQuantities.some((q: any) => q.warehouseId === primaryWarehouseId)) {
              updatedQuantities.push({
                warehouseId: primaryWarehouseId,
                warehouseName: primaryWarehouseId,
                quantity: newPrimaryQuantity,
              });
            }

            console.log(`[createInvoice] Déduit ${item.quantity} de ${item.productName} du dépôt principal (${primaryWarehouseId}): ${currentPrimaryQuantity} → ${newPrimaryQuantity}`);
          }

          // Calculer le stock total depuis warehouse_quantities (source de vérité)
          const newTotal = updatedQuantities.length > 0
            ? updatedQuantities.reduce((sum: number, q: any) => sum + q.quantity, 0)
            : (productData.currentStock || 0) - item.quantity; // fallback si pas encore de warehouse_quantities

          productUpdates.push({
            productId: item.productId,
            newStock: newTotal,
            deduction: item.quantity,
          });

          // Déterminer le nouveau statut basé sur le stock total
          const newStatus = newTotal === 0 ? 'out' : newTotal <= (productData.alertThreshold || 0) ? 'low' : 'ok';

          // Collecter les alertes de stock (si le statut change vers 'low' ou 'out')
          if (newStatus === 'out' || newStatus === 'low') {
            stockAlerts.push({
              productId: item.productId,
              productName: item.productName,
              newStock: newTotal,
              threshold: productData.alertThreshold,
              status: newStatus,
            });
          }

          // Mettre à jour le produit — seulement le statut (currentStock est calculé côté client)
          transaction.update(productRef, {
            status: newStatus,
            updatedAt: new Date(),
          });

          // Mettre à jour warehouse_quantities
          if (primaryWarehouseId) {
            transaction.set(warehouseQuantitiesRef, {
              productId: item.productId,
              quantities: updatedQuantities,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          }

          // Créer le mouvement de stock (sortie) depuis le dépôt principal
          const movementsCollection = collection(db, COLLECTIONS.companyStockMovements(user.currentCompanyId));
          const movementRef = doc(movementsCollection);
          transaction.set(movementRef, {
            companyId: user.currentCompanyId,
            productId: item.productId,
            warehouseId: primaryWarehouseId || productData.warehouseId,
            type: 'out',
            quantity: -item.quantity,
            reason: `Vente facture ${invoiceNumber}`,
            referenceType: 'invoice',
            userId: user.id,
            userName: user.displayName || user.email,
            quantityBefore: totalStockBefore,
            quantityAfter: totalStockBefore - item.quantity,
            createdAt: new Date(),
          });
        }

        // 4. Calculer les totaux
        const subtotal = data.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        const taxAmount = (subtotal * data.taxRate) / 100;
        const total = subtotal - data.discount + taxAmount;
        const remainingAmount = total - data.paidAmount;

        // 5. Déterminer le statut
        let status: 'draft' | 'validated' | 'paid' | 'cancelled';
        if (remainingAmount <= 0) {
          status = 'paid';
        } else if (data.paidAmount > 0 || data.clientId) {
          // Validé si paiement partiel OU vente à crédit (avec client)
          status = 'validated';
        } else {
          status = 'draft';
        }

        // 6. Préparer les items de la facture
        const invoiceItems: InvoiceItem[] = data.items.map((item, index) => ({
          id: `item-${index}`,
          productId: item.productId,
          productName: item.productName,
          productCode: item.productCode,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          purchasePrice: item.purchasePrice,
          total: item.unitPrice * item.quantity,
          isWholesale: item.isWholesale,
        }));

        // 7. Récupérer le nom du client si fourni
        let clientName;
        if (data.clientId) {
          const clientRef = doc(db, COLLECTIONS.companyClients(user.currentCompanyId), data.clientId);
          const clientSnap = await getDoc(clientRef);
          if (clientSnap.exists()) {
            clientName = clientSnap.data().name;

            // Mettre à jour les statistiques du client
            const clientData = clientSnap.data();
            transaction.update(clientRef, {
              totalPurchases: (clientData.totalPurchases || 0) + 1,
              totalAmount: (clientData.totalAmount || 0) + total,
              currentCredit: (clientData.currentCredit || 0) + remainingAmount,
              lastPurchaseDate: new Date(),
              updatedAt: new Date(),
            });
          }
        }

        // 8. Créer la facture
        const invoicesCollection = collection(db, COLLECTIONS.companyInvoices(user.currentCompanyId));
        const invoiceRef = doc(invoicesCollection);

        // Construire l'objet de paiement selon le mode
        const paymentData: any = {
          companyId: user.currentCompanyId,
          invoiceNumber,
          date: data.saleDate || new Date(), // Date de la vente ou date actuelle
          saleDate: data.saleDate || new Date(), // Conserver saleDate séparément
          items: invoiceItems,
          subtotal,
          taxRate: data.taxRate,
          taxAmount,
          discount: data.discount,
          total,
          status,
          paidAmount: data.paidAmount,
          remainingAmount,
          userId: user.id,
          userName: user.displayName || user.email,
          referenceType: 'sale',
          ...(status === 'validated' || status === 'paid' ? {
            validatedAt: new Date(),
            validatedBy: user.id,
          } : {}),
          ...(status === 'paid' ? {
            paidAt: new Date(),
            paidBy: user.id,
          } : {}),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Ajouter les champs optionnels uniquement s'ils sont définis
        if (data.clientId) paymentData.clientId = data.clientId;
        if (clientName) paymentData.clientName = clientName;
        if (data.dueDate) paymentData.dueDate = data.dueDate;
        if (data.paymentMethod) paymentData.paymentMethod = data.paymentMethod;
        if (data.notes) paymentData.notes = data.notes;

        // Ajouter les champs spécifiques selon le mode de paiement
        if (data.paymentMethod === 'mobile' && data.mobileNumber) {
          paymentData.mobileNumber = data.mobileNumber;
        }

        if (data.paymentMethod === 'bank') {
          if (data.bankName) paymentData.bankName = data.bankName;
          if (data.accountNumber) paymentData.accountNumber = data.accountNumber;
          if (data.transactionNumber) paymentData.transactionNumber = data.transactionNumber;
        }

        // Nettoyer les champs undefined (Firestore les refuse)
        const removeUndefined = (obj: any): any => {
          const cleaned: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              cleaned[key] = value.map((item: any) =>
                item && typeof item === 'object' ? removeUndefined(item) : item
              );
            } else if (value && typeof value === 'object' && !(value instanceof Date)) {
              cleaned[key] = removeUndefined(value);
            } else {
              cleaned[key] = value;
            }
          }
          return cleaned;
        };

        transaction.set(invoiceRef, removeUndefined(paymentData));

        // Créer un mouvement de caisse automatiquement pour tous les paiements
        if (data.paidAmount > 0) {
          // Récupérer la caisse principale ou la première caisse disponible
          const cashRegistersRef = collection(db, COLLECTIONS.companyCashRegisters(user.currentCompanyId));
          const cashRegistersSnap = await getDocs(query(cashRegistersRef, where('isMain', '==', true)));

          if (!cashRegistersSnap.empty) {
            cashRegisterId = cashRegistersSnap.docs[0].id;
          } else {
            // Si pas de caisse principale, prendre la première caisse
            const allCashRegistersSnap = await getDocs(query(cashRegistersRef, limit(1)));
            if (!allCashRegistersSnap.empty) {
              cashRegisterId = allCashRegistersSnap.docs[0].id;
            }
          }

          // Créer le mouvement si une caisse existe
          if (cashRegisterId) {
            const movementsRef = collection(db, COLLECTIONS.companyCashMovements(user.currentCompanyId));
            const movementRef = doc(movementsRef);

            // Catégorie selon le mode de paiement
            let category = 'sale';
            if (data.paymentMethod === 'mobile') category = 'mobile_money';
            else if (data.paymentMethod === 'bank') category = 'bank';
            else if (data.paymentMethod === 'cash') category = 'cash';

            transaction.set(movementRef, {
              companyId: user.currentCompanyId,
              cashRegisterId,
              type: 'in',
              amount: data.paidAmount,
              category,
              description: `Facture ${invoiceNumber} - ${data.paymentMethod === 'cash' ? 'Espèces' : data.paymentMethod === 'mobile' ? 'Mobile Money' : data.paymentMethod === 'bank' ? 'Banque' : 'Crédit'}`,
              userId: user.id,
              createdAt: new Date(),
            });

            // Mettre à jour le solde de la caisse atomiquement
            const cashRegisterRef = doc(db, COLLECTIONS.companyCashRegisters(user.currentCompanyId), cashRegisterId);
            transaction.update(cashRegisterRef, {
              currentBalance: increment(data.paidAmount),
              updatedAt: new Date(),
            });
          }
        }

        // Créer un crédit client automatiquement si reste à payer
        // (indépendant du mouvement de caisse — fonctionne pour crédit ET paiement partiel)
        if (remainingAmount > 0 && data.clientId) {
          const creditsRef = collection(db, COLLECTIONS.companyClientCredits(user.currentCompanyId));
          const creditRef = doc(creditsRef);

          // Récupérer le nom du client
          const clientRef = doc(db, COLLECTIONS.companyClients(user.currentCompanyId), data.clientId);
          const clientSnap = await getDoc(clientRef);
          const clientName = clientSnap.exists() ? clientSnap.data().name : (data.clientName || 'Client inconnu');

          transaction.set(creditRef, {
            companyId: user.currentCompanyId,
            clientId: data.clientId,
            clientName,
            invoiceId: invoiceRef.id,
            invoiceNumber,
            amount: total,
            amountPaid: data.paidAmount,
            remainingAmount,
            status: remainingAmount < total ? 'partial' : 'active',
            date: new Date(),
            notes: `Facture ${invoiceNumber}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        return {
          id: invoiceRef.id,
          invoiceNumber,
          total,
          status,
          remainingAmount,
        };
      });

      // Mettre à jour le cache IndexedDB avec les nouveaux stocks
      // Rafraîchir la liste
      await fetchInvoices();

      // ===== NOUVEAU: Envoyer notification aux admins =====
      try {
        const { notifyNewSale } = await import('@/lib/services/notifications');
        const notifResult = await notifyNewSale({
          invoiceId: result.id,
          invoiceNumber: result.invoiceNumber,
          total: result.total,
          employeeName: user.displayName || user.email || 'Employé',
          clientName: data.clientName,
        }, user.currentCompanyId);

        // ✅ CORRECTION: Logger le résultat pour plus de visibilité
        if (notifResult.success) {
          console.log('[createInvoice] ✅ Notification de vente envoyée aux admins:', notifResult.result);
        } else {
          console.warn('[createInvoice] ⚠️ Notification de vente échouée:', notifResult.error);
        }
      } catch (notifError) {
        console.error('[createInvoice] ❌ Erreur critique lors de l\'envoi de la notification:', notifError);
        // Ne pas échouer la transaction si la notification échoue
      }

      // ===== NOUVEAU: Envoyer notifications d'alertes de stock =====
      if (stockAlerts.length > 0) {
        try {
          const { notifyOutOfStock, notifyLowStock } = await import('@/lib/services/notifications');

          for (const alert of stockAlerts) {
            if (alert.status === 'out') {
              const result = await notifyOutOfStock({
                productId: alert.productId,
                productName: alert.productName,
              }, user.currentCompanyId);

              if (result.success) {
                console.log(`[createInvoice] ✅ Alerte rupture de stock envoyée pour: ${alert.productName}`);
              } else {
                console.warn(`[createInvoice] ⚠️ Alerte rupture échouée pour ${alert.productName}:`, result.error);
              }
            } else {
              const result = await notifyLowStock({
                productId: alert.productId,
                productName: alert.productName,
                currentStock: alert.newStock,
                threshold: alert.threshold,
              }, user.currentCompanyId);

              if (result.success) {
                console.log(`[createInvoice] ✅ Alerte stock faible envoyée pour: ${alert.productName} (${alert.newStock} / ${alert.threshold})`);
              } else {
                console.warn(`[createInvoice] ⚠️ Alerte stock faible échouée pour ${alert.productName}:`, result.error);
              }
            }
          }
        } catch (stockNotifError) {
          console.error('[createInvoice] ❌ Erreur critique lors de l\'envoi des notifications de stock:', stockNotifError);
          // Ne pas échouer la transaction si les notifications échouent
        }
      }

      return result;
    } catch (err: any) {
      console.error('Erreur lors de la création de la facture:', err);
      throw new Error(err.message || 'Erreur lors de la création de la facture');
    }
  };

  /**
   * Modifier une facture avec rollback complet des anciens effets et application des nouveaux
   */
  const updateInvoice = async (invoiceId: string, data: InvoiceCreateInput) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');
    if (data.items.length === 0) throw new Error('Ajoutez au moins un produit à la facture');

    let cashRegisterId: string | null = null;
    const stockAlerts: Array<{ productId: string; productName: string; newStock: number; threshold: number; status: 'out' | 'low' }> = [];

    try {
      const result = await runTransaction(db, async (transaction) => {
        const companyId = user.currentCompanyId!;

        // ===== PHASE 1: ROLLBACK ANCIENNE FACTURE =====

        const invoiceRef = doc(db, COLLECTIONS.companyInvoices(companyId), invoiceId);
        const invoiceSnap = await getDoc(invoiceRef);
        if (!invoiceSnap.exists()) throw new Error('Facture non trouvée');
        const oldInvoice = invoiceSnap.data() as Invoice;
        if (oldInvoice.status === 'cancelled') throw new Error('Facture déjà annulée');

        console.log(`[updateInvoice] ===== MODIFICATION FACTURE ${oldInvoice.invoiceNumber} =====`);
        console.log(`[updateInvoice] Anciens items:`, oldInvoice.items.map((i: any) => `${i.productName} x${i.quantity} (${i.productId})`).join(', '));
        console.log(`[updateInvoice] Nouveaux items:`, data.items.map((i: any) => `${i.productName} x${i.quantity} (${i.productId})`).join(', '));

        // 1A. Calculer le diff de stock par produit
        const primaryWarehouseId = settings?.stock?.defaultWarehouseId;

        // Construire un map des quantités par produit (anciens items)
        const oldQtyMap = new Map<string, number>();
        for (const item of oldInvoice.items) {
          oldQtyMap.set(item.productId, (oldQtyMap.get(item.productId) || 0) + item.quantity);
        }

        // Construire un map des quantités par produit (nouveaux items)
        const newQtyMap = new Map<string, number>();
        for (const item of data.items) {
          newQtyMap.set(item.productId, (newQtyMap.get(item.productId) || 0) + item.quantity);
        }

        console.log(`[updateInvoice] oldQtyMap:`, Object.fromEntries(oldQtyMap));
        console.log(`[updateInvoice] newQtyMap:`, Object.fromEntries(newQtyMap));

        // Appliquer le diff pour chaque produit concerné
        const allProductIds = new Set([...oldQtyMap.keys(), ...newQtyMap.keys()]);

        for (const productId of allProductIds) {
          const oldQty = oldQtyMap.get(productId) || 0;
          const newQty = newQtyMap.get(productId) || 0;
          const diff = newQty - oldQty; // positif = on déduit plus, négatif = on restore

          console.log(`[updateInvoice] Produit ${productId}: oldQty=${oldQty}, newQty=${newQty}, diff=${diff}`);

          if (diff === 0) {
            console.log(`[updateInvoice] → SKIP (diff=0, pas de changement)`);
            continue;
          }

          const whQtyRef = doc(db, `companies/${companyId}/warehouse_quantities`, productId);
          const whQtySnap = await getDoc(whQtyRef);

          let quantities: any[] = [];
          if (whQtySnap.exists()) {
            quantities = whQtySnap.data().quantities || [];
          }

          if (primaryWarehouseId) {
            const currentQty = quantities.find((q: any) => q.warehouseId === primaryWarehouseId)?.quantity || 0;
            const updatedQty = currentQty - diff;
            const totalStockBefore = quantities.reduce((sum: number, q: any) => sum + q.quantity, 0);
            console.log(`[updateInvoice] → Stock ${primaryWarehouseId}: ${currentQty} → ${updatedQty} (${diff > 0 ? 'DÉDUCTION' : 'RESTAURATION'} de ${Math.abs(diff)})`);

            const updatedQuantities = quantities.map((q: any) =>
              q.warehouseId === primaryWarehouseId ? { ...q, quantity: updatedQty } : q
            );
            if (!updatedQuantities.some((q: any) => q.warehouseId === primaryWarehouseId)) {
              updatedQuantities.push({ warehouseId: primaryWarehouseId, warehouseName: primaryWarehouseId, quantity: updatedQty });
            }

            transaction.set(whQtyRef, { quantities: updatedQuantities, updatedAt: serverTimestamp() }, { merge: true });

            // Mettre à jour le statut du produit
            const productRef = doc(db, COLLECTIONS.companyProducts(companyId), productId);
            const productSnap = await getDoc(productRef);
            const productData = productSnap.exists() ? productSnap.data() : null;

            if (productData) {
              const totalStock = updatedQuantities.reduce((sum: number, q: any) => sum + q.quantity, 0);
              const newStatus = totalStock === 0 ? 'out' : totalStock <= (productData.alertThreshold || 0) ? 'low' : 'ok';

              if (newStatus === 'out' || newStatus === 'low') {
                stockAlerts.push({
                  productId, productName: productData.name || productId,
                  newStock: totalStock, threshold: productData.alertThreshold, status: newStatus,
                });
              }

              transaction.update(productRef, { status: newStatus, updatedAt: new Date() });
            }

            // Créer le mouvement de stock correspondant
            const stockMovementsRef = collection(db, COLLECTIONS.companyStockMovements(companyId));
            const movementRef = doc(stockMovementsRef);
            if (diff > 0) {
              transaction.set(movementRef, {
                companyId, productId,
                warehouseId: primaryWarehouseId || 'boutique',
                type: 'out', quantity: -diff,
                reason: `Modification facture ${oldInvoice.invoiceNumber} (ajout)`,
                referenceType: 'invoice_modification', referenceId: invoiceId,
                userId: user.id, userName: user.displayName || user.email,
                quantityBefore: totalStockBefore, quantityAfter: totalStockBefore - diff,
                createdAt: new Date(),
              });
            } else {
              transaction.set(movementRef, {
                companyId, productId,
                warehouseId: primaryWarehouseId || 'boutique',
                type: 'in', quantity: Math.abs(diff),
                reason: `Modification facture ${oldInvoice.invoiceNumber} (retrait)`,
                referenceType: 'invoice_modification', referenceId: invoiceId,
                userId: user.id, userName: user.displayName || user.email,
                quantityBefore: totalStockBefore, quantityAfter: totalStockBefore + Math.abs(diff),
                createdAt: new Date(),
              });
            }
          }
        }

        // 1B. Reverser la caisse ancienne
        console.log(`[updateInvoice] 1B. Caisse: oldPaid=${oldInvoice.paidAmount}, newPaid=${data.paidAmount}`);
        if (oldInvoice.paidAmount > 0) {
          const cashRegistersRef = collection(db, COLLECTIONS.companyCashRegisters(companyId));
          const cashRegistersSnap = await getDocs(query(cashRegistersRef, where('isMain', '==', true)));
          let oldCashRegId: string | null = null;
          if (!cashRegistersSnap.empty) oldCashRegId = cashRegistersSnap.docs[0].id;
          else {
            const allSnap = await getDocs(query(cashRegistersRef, limit(1)));
            if (!allSnap.empty) oldCashRegId = allSnap.docs[0].id;
          }

          if (oldCashRegId) {
            const cashMovementsRef = collection(db, COLLECTIONS.companyCashMovements(companyId));
            const cmRef = doc(cashMovementsRef);
            transaction.set(cmRef, {
              companyId, cashRegisterId: oldCashRegId,
              type: 'out', amount: oldInvoice.paidAmount, category: 'modification',
              description: `Modification facture ${oldInvoice.invoiceNumber}`,
              referenceId: invoiceId, referenceType: 'invoice_modification',
              userId: user.id, createdAt: new Date(),
            });
            transaction.update(doc(db, COLLECTIONS.companyCashRegisters(companyId), oldCashRegId), {
              currentBalance: increment(-oldInvoice.paidAmount), updatedAt: new Date(),
            });
          }
        }

        // 1C. Reverser l'ancien crédit et ses paiements
        if (oldInvoice.remainingAmount > 0 && oldInvoice.clientId) {
          const creditsRef = collection(db, COLLECTIONS.companyClientCredits(companyId));
          const creditsSnap = await getDocs(query(creditsRef, where('invoiceId', '==', invoiceId)));

          for (const creditDoc of creditsSnap.docs) {
            const paymentsRef = collection(db, COLLECTIONS.companyClientCreditPayments(companyId));
            const paymentsSnap = await getDocs(query(paymentsRef, where('creditId', '==', creditDoc.id)));

            for (const paymentDoc of paymentsSnap.docs) {
              const paymentData = paymentDoc.data();
              const cashRegistersRef = collection(db, COLLECTIONS.companyCashRegisters(companyId));
              const cashRegistersSnap = await getDocs(query(cashRegistersRef, where('isMain', '==', true)));
              let payCashRegId: string | null = null;
              if (!cashRegistersSnap.empty) payCashRegId = cashRegistersSnap.docs[0].id;
              else {
                const allSnap = await getDocs(query(cashRegistersRef, limit(1)));
                if (!allSnap.empty) payCashRegId = allSnap.docs[0].id;
              }

              if (payCashRegId) {
                const cashMovementsRef = collection(db, COLLECTIONS.companyCashMovements(companyId));
                const cmRef = doc(cashMovementsRef);
                transaction.set(cmRef, {
                  companyId, cashRegisterId: payCashRegId,
                  type: 'out', amount: paymentData.amount, category: 'credit_payment_reversal',
                  description: `Modification - reversement crédit (${oldInvoice.invoiceNumber})`,
                  referenceId: paymentDoc.id, referenceType: 'invoice_modification',
                  userId: user.id, createdAt: new Date(),
                });
                transaction.update(doc(db, COLLECTIONS.companyCashRegisters(companyId), payCashRegId), {
                  currentBalance: increment(-paymentData.amount), updatedAt: new Date(),
                });
              }
              transaction.delete(doc(db, COLLECTIONS.companyClientCreditPayments(companyId), paymentDoc.id));
            }
            transaction.update(doc(db, COLLECTIONS.companyClientCredits(companyId), creditDoc.id), {
              status: 'cancelled', updatedAt: new Date(),
            });
          }

          // Reverser stats ancien client
          const clientRef = doc(db, COLLECTIONS.companyClients(companyId), oldInvoice.clientId);
          const clientSnap = await getDoc(clientRef);
          if (clientSnap.exists()) {
            const cd = clientSnap.data();
            transaction.update(clientRef, {
              totalPurchases: Math.max(0, (cd.totalPurchases || 0) - 1),
              totalAmount: Math.max(0, (cd.totalAmount || 0) - oldInvoice.total),
              currentCredit: Math.max(0, (cd.currentCredit || 0) - oldInvoice.remainingAmount),
              updatedAt: new Date(),
            });
          }
        } else if (oldInvoice.clientId && oldInvoice.paidAmount > 0) {
          // Facture payée sans crédit — reverser stats client
          const clientRef = doc(db, COLLECTIONS.companyClients(companyId), oldInvoice.clientId);
          const clientSnap = await getDoc(clientRef);
          if (clientSnap.exists()) {
            const cd = clientSnap.data();
            transaction.update(clientRef, {
              totalPurchases: Math.max(0, (cd.totalPurchases || 0) - 1),
              totalAmount: Math.max(0, (cd.totalAmount || 0) - oldInvoice.total),
              updatedAt: new Date(),
            });
          }
        }

        // ===== PHASE 2: APPLIQUER NOUVEAUX EFFETS =====

        // 2A. Valider les prix
        for (const item of data.items) {
          if (item.purchasePrice && item.unitPrice < item.purchasePrice) {
            throw new Error(`Prix de vente invalide pour ${item.productName}: ${item.unitPrice} < ${item.purchasePrice}`);
          }
        }

        // NOTE: La gestion du stock est déjà faite en Phase 1A (basée sur le diff).
        // Plus besoin de Phase 2B séparée.

        // 2C. Calculer les totaux
        const subtotal = data.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        const taxAmount = (subtotal * data.taxRate) / 100;
        const total = subtotal - data.discount + taxAmount;
        const remainingAmount = total - data.paidAmount;

        // 2D. Déterminer le statut
        let status: 'draft' | 'validated' | 'paid';
        if (remainingAmount <= 0) status = 'paid';
        else if (data.paidAmount > 0 || data.clientId) status = 'validated';
        else status = 'draft';

        // 2E. Préparer les items
        const invoiceItems: InvoiceItem[] = data.items.map((item, index) => ({
          id: `item-${index}`,
          productId: item.productId, productName: item.productName, productCode: item.productCode,
          quantity: item.quantity, unit: item.unit, unitPrice: item.unitPrice,
          purchasePrice: item.purchasePrice, total: item.unitPrice * item.quantity,
          isWholesale: item.isWholesale,
        }));

        // 2F. Client : récupérer nom + mettre à jour stats
        let clientName: string | undefined;
        if (data.clientId) {
          const clientRef = doc(db, COLLECTIONS.companyClients(companyId), data.clientId);
          const clientSnap = await getDoc(clientRef);
          if (clientSnap.exists()) {
            const cd = clientSnap.data();
            clientName = cd.name;
            transaction.update(clientRef, {
              totalPurchases: (cd.totalPurchases || 0) + 1,
              totalAmount: (cd.totalAmount || 0) + total,
              currentCredit: (cd.currentCredit || 0) + remainingAmount,
              lastPurchaseDate: new Date(),
              updatedAt: new Date(),
            });
          }
        }

        // 2G. Mouvement de caisse
        if (data.paidAmount > 0) {
          const cashRegistersRef = collection(db, COLLECTIONS.companyCashRegisters(companyId));
          const cashRegistersSnap = await getDocs(query(cashRegistersRef, where('isMain', '==', true)));
          if (!cashRegistersSnap.empty) cashRegisterId = cashRegistersSnap.docs[0].id;
          else {
            const allSnap = await getDocs(query(cashRegistersRef, limit(1)));
            if (!allSnap.empty) cashRegisterId = allSnap.docs[0].id;
          }

          if (cashRegisterId) {
            const movementsRef = collection(db, COLLECTIONS.companyCashMovements(companyId));
            const movementRef = doc(movementsRef);
            let category = 'sale';
            if (data.paymentMethod === 'mobile') category = 'mobile_money';
            else if (data.paymentMethod === 'bank') category = 'bank';
            else if (data.paymentMethod === 'cash') category = 'cash';

            transaction.set(movementRef, {
              companyId, cashRegisterId, type: 'in', amount: data.paidAmount, category,
              description: `Facture ${oldInvoice.invoiceNumber} (modifiée)`,
              userId: user.id, createdAt: new Date(),
            });
            transaction.update(doc(db, COLLECTIONS.companyCashRegisters(companyId), cashRegisterId), {
              currentBalance: increment(data.paidAmount), updatedAt: new Date(),
            });
          }
        }

        // 2H. Crédit client si reste à payer
        if (remainingAmount > 0 && data.clientId) {
          const creditsRef = collection(db, COLLECTIONS.companyClientCredits(companyId));
          const creditRef = doc(creditsRef);
          const cRef = doc(db, COLLECTIONS.companyClients(companyId), data.clientId);
          const cSnap = await getDoc(cRef);
          const cName = cSnap.exists() ? cSnap.data().name : (data.clientName || 'Client inconnu');

          transaction.set(creditRef, {
            companyId, clientId: data.clientId, clientName: cName,
            invoiceId, invoiceNumber: oldInvoice.invoiceNumber,
            amount: total, amountPaid: data.paidAmount, remainingAmount,
            status: remainingAmount < total ? 'partial' : 'active',
            date: new Date(), notes: `Facture ${oldInvoice.invoiceNumber} (modifiée)`,
            createdAt: new Date(), updatedAt: new Date(),
          });
        }

        // 2I. Mettre à jour le document facture
        const updateData: Record<string, any> = {
          items: invoiceItems, subtotal, taxRate: data.taxRate, taxAmount,
          discount: data.discount, total, status,
          paidAmount: data.paidAmount, remainingAmount, updatedAt: new Date(),
        };

        if (data.clientId) updateData.clientId = data.clientId;
        else updateData.clientId = null;
        if (clientName) updateData.clientName = clientName;
        else if (!data.clientId) updateData.clientName = null;
        if (data.paymentMethod) updateData.paymentMethod = data.paymentMethod;
        else updateData.paymentMethod = null;
        if (data.notes) updateData.notes = data.notes;
        else updateData.notes = null;
        if (data.saleDate) updateData.date = data.saleDate;
        if (data.dueDate) updateData.dueDate = data.dueDate;

        if ((status === 'validated' || status === 'paid') && !oldInvoice.validatedAt) {
          updateData.validatedAt = new Date();
          updateData.validatedBy = user.id;
        }
        if (status === 'paid') {
          updateData.paidAt = new Date();
          updateData.paidBy = user.id;
        }

        transaction.update(invoiceRef, updateData);

        return { id: invoiceId, invoiceNumber: oldInvoice.invoiceNumber, total, status, remainingAmount };
      });

      await fetchInvoices();

      // Notifications d'alertes de stock
      if (stockAlerts.length > 0) {
        try {
          const { notifyOutOfStock, notifyLowStock } = await import('@/lib/services/notifications');
          for (const alert of stockAlerts) {
            if (alert.status === 'out') await notifyOutOfStock({ productId: alert.productId, productName: alert.productName }, user.currentCompanyId!);
            else await notifyLowStock({ productId: alert.productId, productName: alert.productName, currentStock: alert.newStock, threshold: alert.threshold }, user.currentCompanyId!);
          }
        } catch (e) { console.error('[updateInvoice] Erreur notifications stock:', e); }
      }

      return result;
    } catch (err) {
      console.error('Erreur lors de la modification de la facture:', err);
      throw new Error(err instanceof Error ? err.message : 'Erreur lors de la modification de la facture');
    }
  };

  /**
   * Supprimer une facture avec rollback complet (stock, caisse, crédit, paiements)
   */
  const deleteInvoice = async (id: string) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      await runTransaction(db, async (transaction) => {
        const companyId = user.currentCompanyId!;

        // 1. Lire la facture originale
        const invoiceRef = doc(db, COLLECTIONS.companyInvoices(companyId), id);
        const invoiceSnap = await getDoc(invoiceRef);
        if (!invoiceSnap.exists()) throw new Error('Facture non trouvée');
        const invoice = invoiceSnap.data() as Invoice;

        if (invoice.status === 'cancelled') throw new Error('Facture déjà annulée');

        // 2. Restaurer le stock pour chaque article
        for (const item of invoice.items) {
          // Lire les quantités en entrepôt
          const whQtyRef = doc(db, `companies/${companyId}/warehouse_quantities`, item.productId);
          const whQtySnap = await getDoc(whQtyRef);

          if (whQtySnap.exists()) {
            const whQtyData = whQtySnap.data();
            const quantities = whQtyData.quantities || [];
            const primaryWarehouseId = settings?.stock?.defaultWarehouseId;

            const totalStockBefore = quantities.reduce((sum: number, e: any) => sum + e.quantity, 0);

            // Ajouter la quantité retirée au warehouse principal
            const updatedQuantities = quantities.map((e: any) => {
              if (e.warehouseId === primaryWarehouseId) {
                return { ...e, quantity: e.quantity + item.quantity };
              }
              return e;
            });

            transaction.set(whQtyRef, {
              quantities: updatedQuantities,
              updatedAt: new Date(),
            }, { merge: true });

            // Recalculer le stock total et le statut du produit
            const totalStock = updatedQuantities.reduce((sum: number, e: any) => sum + e.quantity, 0);
            const productRef = doc(db, COLLECTIONS.companyProducts(companyId), item.productId);
            const productSnap = await getDoc(productRef);
            const alertThreshold = productSnap.exists() ? (productSnap.data().alertThreshold || 0) : 0;

            const newStatus = totalStock === 0 ? 'out' : totalStock <= alertThreshold ? 'low' : 'ok';
            transaction.update(productRef, { status: newStatus, updatedAt: new Date() });

            // Créer un mouvement de stock compensatoire
            const stockMovementsRef = collection(db, COLLECTIONS.companyStockMovements(companyId));
            const movementRef = doc(stockMovementsRef);
            transaction.set(movementRef, {
              companyId,
              productId: item.productId,
              warehouseId: primaryWarehouseId || 'boutique',
              type: 'in',
              quantity: item.quantity,
              reason: `Annulation facture ${invoice.invoiceNumber}`,
              referenceType: 'invoice_cancellation',
              referenceId: id,
              userId: user.id,
              userName: user.displayName || user.email,
              quantityBefore: totalStockBefore,
              quantityAfter: totalStockBefore + item.quantity,
              createdAt: new Date(),
            });
          }
        }

        // 3. Reverser la caisse si un montant a été payé
        if (invoice.paidAmount > 0) {
          // Trouver la caisse principale
          const cashRegistersRef = collection(db, COLLECTIONS.companyCashRegisters(companyId));
          const cashRegistersSnap = await getDocs(query(cashRegistersRef, where('isMain', '==', true)));
          let cashRegisterId: string | null = null;

          if (!cashRegistersSnap.empty) {
            cashRegisterId = cashRegistersSnap.docs[0].id;
          } else {
            const allSnap = await getDocs(query(cashRegistersRef, limit(1)));
            if (!allSnap.empty) cashRegisterId = allSnap.docs[0].id;
          }

          if (cashRegisterId) {
            // Créer un mouvement de caisse compensatoire (sortie)
            const cashMovementsRef = collection(db, COLLECTIONS.companyCashMovements(companyId));
            const cashMovementRef = doc(cashMovementsRef);
            transaction.set(cashMovementRef, {
              companyId,
              cashRegisterId,
              type: 'out',
              amount: invoice.paidAmount,
              category: 'cancellation',
              description: `Annulation facture ${invoice.invoiceNumber}`,
              referenceId: id,
              referenceType: 'invoice_cancellation',
              userId: user.id,
              createdAt: new Date(),
            });

            // Décrementer le solde de la caisse
            const cashRegisterRef = doc(db, COLLECTIONS.companyCashRegisters(companyId), cashRegisterId);
            transaction.update(cashRegisterRef, {
              currentBalance: increment(-invoice.paidAmount),
              updatedAt: new Date(),
            });
          }
        }

        // 4. Reverser le crédit client et ses paiements
        if (invoice.remainingAmount > 0 && invoice.clientId) {
          // Trouver le crédit lié à cette facture
          const creditsRef = collection(db, COLLECTIONS.companyClientCredits(companyId));
          const creditsSnap = await getDocs(query(creditsRef, where('invoiceId', '==', id)));

          for (const creditDoc of creditsSnap.docs) {
            const creditData = creditDoc.data();

            // Trouver et reverser tous les paiements du crédit
            const paymentsRef = collection(db, COLLECTIONS.companyClientCreditPayments(companyId));
            const paymentsSnap = await getDocs(query(paymentsRef, where('creditId', '==', creditDoc.id)));

            for (const paymentDoc of paymentsSnap.docs) {
              const paymentData = paymentDoc.data();

              // Reverser le paiement dans la caisse
              const cashRegistersRef = collection(db, COLLECTIONS.companyCashRegisters(companyId));
              const cashRegistersSnap = await getDocs(query(cashRegistersRef, where('isMain', '==', true)));
              let payCashRegId: string | null = null;

              if (!cashRegistersSnap.empty) {
                payCashRegId = cashRegistersSnap.docs[0].id;
              } else {
                const allSnap = await getDocs(query(cashRegistersRef, limit(1)));
                if (!allSnap.empty) payCashRegId = allSnap.docs[0].id;
              }

              if (payCashRegId) {
                const cashMovementsRef = collection(db, COLLECTIONS.companyCashMovements(companyId));
                const cashMovementRef = doc(cashMovementsRef);
                transaction.set(cashMovementRef, {
                  companyId,
                  cashRegisterId: payCashRegId,
                  type: 'out',
                  amount: paymentData.amount,
                  category: 'credit_payment_reversal',
                  description: `Annulation paiement crédit - ${invoice.clientName || 'Client'} (facture ${invoice.invoiceNumber})`,
                  referenceId: paymentDoc.id,
                  referenceType: 'credit_payment_reversal',
                  userId: user.id,
                  createdAt: new Date(),
                });

                const cashRegisterRef = doc(db, COLLECTIONS.companyCashRegisters(companyId), payCashRegId);
                transaction.update(cashRegisterRef, {
                  currentBalance: increment(-paymentData.amount),
                  updatedAt: new Date(),
                });
              }

              // Supprimer le paiement
              transaction.delete(doc(db, COLLECTIONS.companyClientCreditPayments(companyId), paymentDoc.id));
            }

            // Annuler le crédit
            transaction.update(doc(db, COLLECTIONS.companyClientCredits(companyId), creditDoc.id), {
              status: 'cancelled',
              updatedAt: new Date(),
            });
          }

          // Mettre à jour les stats du client
          const clientRef = doc(db, COLLECTIONS.companyClients(companyId), invoice.clientId);
          const clientSnap = await getDoc(clientRef);
          if (clientSnap.exists()) {
            const clientData = clientSnap.data();
            transaction.update(clientRef, {
              totalPurchases: Math.max(0, (clientData.totalPurchases || 0) - 1),
              totalAmount: Math.max(0, (clientData.totalAmount || 0) - invoice.total),
              currentCredit: Math.max(0, (clientData.currentCredit || 0) - invoice.remainingAmount),
              updatedAt: new Date(),
            });
          }
        } else if (invoice.clientId && invoice.paidAmount > 0) {
          // Facture payée sans crédit — juste reverser les stats client
          const clientRef = doc(db, COLLECTIONS.companyClients(companyId), invoice.clientId);
          const clientSnap = await getDoc(clientRef);
          if (clientSnap.exists()) {
            const clientData = clientSnap.data();
            transaction.update(clientRef, {
              totalPurchases: Math.max(0, (clientData.totalPurchases || 0) - 1),
              totalAmount: Math.max(0, (clientData.totalAmount || 0) - invoice.total),
              updatedAt: new Date(),
            });
          }
        }

        // 5. Annuler la facture
        transaction.update(invoiceRef, {
          status: 'cancelled',
          updatedAt: new Date(),
        });
      });

      await fetchInvoices();
      return { success: true };
    } catch (err) {
      console.error('Erreur lors de l\'annulation de la facture:', err);
      throw new Error(err instanceof Error ? err.message : 'Erreur lors de l\'annulation de la facture');
    }
  };

  /**
   * Mettre à jour le compteur de factures en attente
   */
  const updatePendingCount = async () => {
    const count = await offlineInvoices.getPendingCount();
    setPendingInvoicesCount(count);
  };

  /**
   * Créer une facture (avec support offline)
   */
  const createInvoiceOffline = async (data: InvoiceCreateInput) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    // Vérifier si on est hors ligne
    if (!navigator.onLine) {
      console.log('[createInvoice] Mode hors ligne - stockage local');

      // Stocker localement
      const pendingId = await offlineInvoices.addPendingInvoice(data);

      // Mettre à jour le compteur
      await updatePendingCount();

      // Retourner un résultat simulé
      return {
        id: pendingId,
        invoiceNumber: `PENDING-${pendingId}`,
        total: data.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
        status: 'pending' as const,
        remainingAmount: 0,
        pending: true,
      };
    }

    // Mode en ligne - utiliser la création normale
    return await createInvoice(data);
  };

  /**
   * Synchroniser les factures en attente
   */
  const syncPendingInvoices = async () => {
    if (isSyncing || !navigator.onLine) {
      return;
    }

    try {
      setIsSyncing(true);

      const result = await invoiceSync.syncPendingInvoices(createInvoice);

      // Mettre à jour le compteur
      await updatePendingCount();

      // Rafraîchir la liste des factures
      if (result.success > 0) {
        await fetchInvoices();
      }

      return result;
    } catch (error) {
      console.error('[syncPendingInvoices] Erreur:', error);
      throw error;
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  return {
    invoices,
    loading,
    error,
    hasMore,
    searchQuery,
    setSearchQuery,
    fetchInvoices,
    loadMore,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    // Nouvelles fonctions offline
    createInvoiceOffline,
    syncPendingInvoices,
    // États offline
    isOnline,
    pendingInvoicesCount,
    isSyncing,
    // Nouvelles fonctions de gestion de stock
    checkStockBeforeInvoice,
    executeStockTransfers,
  };
}

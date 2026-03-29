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
   * Vérifier le stock avant création de facture et retourner les produits nécessitant un transfert
   */
  const checkStockBeforeInvoice = async (
    items: InvoiceItem[],
    primaryWarehouseId: string | undefined
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

    // Pour chaque produit de la facture
    for (const item of items) {
      if (!item.productId) continue;

      // Récupérer le produit
      const productRef = doc(db, COLLECTIONS.companyProducts(user.currentCompanyId), item.productId);
      const productSnap = await getDoc(productRef);

      if (!productSnap.exists()) {
        throw new Error(`Produit non trouvé: ${item.productName}`);
      }

      const productData = productSnap.data();
      console.log(`[checkStockBeforeInvoice] ✅ Produit trouvé: ${item.productName}, companyId: "${user.currentCompanyId}" (longueur: ${user.currentCompanyId.length})`);

      // Calculer la quantité totale requise pour ce produit
      const totalRequired = items
        .filter(i => i.productId === item.productId)
        .reduce((sum, i) => sum + i.quantity, 0);

      // Récupérer le stock depuis warehouse_quantities
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

      const primaryEntry = quantities.find((q: any) => q.warehouseId === primaryWarehouseId);
      let availableInPrimary = primaryEntry?.quantity || 0;

      console.log(`[checkStockBeforeInvoice] Stock pour ${item.productName}: ${quantities.length} dépôt(s), dépôt principal (${primaryWarehouseId}): ${availableInPrimary}`);

      // Vérifier si le stock est insuffisant dans le dépôt principal
      if (availableInPrimary < totalRequired) {
        const missingQuantity = totalRequired - availableInPrimary;

        // Chercher dans les autres dépôts
        const otherWarehousesStock: Array<{
          warehouseId: string;
          warehouseName: string;
          availableQuantity: number;
        }> = [];

        for (const warehouse of warehouses) {
          // Ignorer le dépôt principal
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

        // Trier par quantité disponible (décroissant)
        otherWarehousesStock.sort((a, b) => b.availableQuantity - a.availableQuantity);

        productsNeedingTransfer.push({
          productId: item.productId,
          productName: item.productName,
          requiredQuantity: totalRequired,
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
          let updatedQuantities = [...quantities];
          if (primaryWarehouseId) {
            const currentPrimaryQuantity = updatedQuantities.find((q: any) => q.warehouseId === primaryWarehouseId)?.quantity || 0;
            const newPrimaryQuantity = currentPrimaryQuantity - item.quantity;

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
            reason: `Vente facture`,
            referenceType: 'invoice',
            userId: user.id,
            createdAt: new Date(),
          });
        }

        // 3. Générer le numéro de facture (à l'intérieur de la transaction pour l'unicité)
        const settingsRef = doc(db, COLLECTIONS.companySettings(user.currentCompanyId), 'invoice');
        const settingsSnap = await getDoc(settingsRef);

        let nextNumber: number;
        let prefix: string;

        if (settingsSnap.exists()) {
          const settingsData = settingsSnap.data();
          nextNumber = settingsData.nextNumber || 1;
          prefix = settingsData.prefix || 'FAC';

          // Incrémenter le compteur
          transaction.update(settingsRef, {
            nextNumber: nextNumber + 1,
            updatedAt: new Date(),
          });
        } else {
          // Créer les settings initiaux
          nextNumber = 1;
          prefix = settings?.invoice?.prefix || 'FAC';

          transaction.set(settingsRef, {
            prefix,
            nextNumber: 2,
            updatedAt: new Date(),
          });
        }

        const invoiceNumber = `${prefix}-${String(nextNumber).padStart(4, '0')}`;

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

        transaction.set(invoiceRef, paymentData);

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
   * Mettre à jour une facture
   */
  const updateInvoice = async (id: string, data: Partial<Invoice>) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const invoiceRef = doc(db, COLLECTIONS.companyInvoices(user.currentCompanyId), id);

      await updateDoc(invoiceRef, {
        ...data,
        updatedAt: new Date(),
      });

      await fetchInvoices();

      return { success: true };
    } catch (err) {
      console.error('Erreur lors de la mise à jour de la facture:', err);
      throw new Error('Erreur lors de la mise à jour de la facture');
    }
  };

  /**
   * Supprimer une facture (annulation)
   */
  const deleteInvoice = async (id: string) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const invoiceRef = doc(db, COLLECTIONS.companyInvoices(user.currentCompanyId), id);

      // Au lieu de supprimer, on annule la facture
      await updateDoc(invoiceRef, {
        status: 'cancelled',
        updatedAt: new Date(),
      });

      await fetchInvoices();

      return { success: true };
    } catch (err) {
      console.error('Erreur lors de l\'annulation de la facture:', err);
      throw new Error('Erreur lors de l\'annulation de la facture');
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

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
} from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase';
import { useAuth } from './useAuth';
import { useSettings } from './useSettings';
import { productsCache } from '@/lib/indexeddb/db';
import { offlineInvoices } from '@/lib/indexeddb/offline-invoices';
import { invoiceSync, type SyncOptions } from '@/lib/services/invoice-sync';
import type { Invoice, InvoiceItem } from '@/types';

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
   * Créer une nouvelle facture avec validation des prix et transaction atomique
   */
  const createInvoice = async (data: InvoiceCreateInput) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');
    if (data.items.length === 0) throw new Error('Ajoutez au moins un produit à la facture');

    // Variable pour stocker les mises à jour de produits (pour le cache IndexedDB)
    const productUpdates: Array<{ productId: string; newStock: number; deduction: number }> = [];

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
          const currentStock = productData.currentStock || 0;

          if (currentStock < item.quantity) {
            throw new Error(
              `Stock insuffisant pour ${item.productName}: ${currentStock} ${item.unit} disponibles`
            );
          }

          const newStock = currentStock - item.quantity;
          productUpdates.push({
            productId: item.productId,
            newStock,
            deduction: item.quantity,
          });

          // Mettre à jour le produit
          transaction.update(productRef, {
            currentStock: newStock,
            status: newStock === 0 ? 'out' : newStock <= productData.alertThreshold ? 'low' : 'ok',
            updatedAt: new Date(),
          });

          // Créer le mouvement de stock (sortie)
          const movementsCollection = collection(db, COLLECTIONS.companyStockMovements(user.currentCompanyId));
          const movementRef = doc(movementsCollection);
          transaction.set(movementRef, {
            companyId: user.currentCompanyId,
            productId: item.productId,
            warehouseId: productData.warehouseId || settings?.stock?.defaultWarehouseId,
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
        } else if (data.paidAmount > 0) {
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
          date: new Date(),
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

          let cashRegisterId: string | null = null;
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
          }

          // Créer un crédit client automatiquement si reste à payer
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
      console.log('[createInvoice] Mise à jour du cache IndexedDB pour', productUpdates.length, 'produits');
      try {
        for (const update of productUpdates) {
          // Récupérer le produit actuel du cache
          const cachedProduct = await productsCache.getProductById(update.productId);
          if (cachedProduct) {
            // Mettre à jour le stock dans le cache
            const status: 'ok' | 'low' | 'out' = update.newStock === 0 ? 'out' : update.newStock <= (cachedProduct.alertThreshold || 5) ? 'low' : 'ok';
            const updatedProduct = {
              ...cachedProduct,
              currentStock: update.newStock,
              status,
              updatedAt: new Date(),
            };
            await productsCache.upsertProduct(updatedProduct);
            console.log('[createInvoice] Produit mis à jour dans le cache:', cachedProduct.name, `${cachedProduct.currentStock} → ${update.newStock}`);
          }
        }
      } catch (cacheError) {
        console.error('[createInvoice] Erreur lors de la mise à jour du cache:', cacheError);
        // Ne pas échouer la transaction si le cache échoue
      }

      // Rafraîchir la liste
      await fetchInvoices();

      // ===== NOUVEAU: Envoyer notification aux admins =====
      try {
        const { notifyNewSale } = await import('@/lib/services/notifications');
        await notifyNewSale({
          invoiceId: result.id,
          invoiceNumber: result.invoiceNumber,
          total: result.total,
          employeeName: user.displayName || user.email || 'Employé',
          clientName: data.clientName,
        }, user.currentCompanyId);
        console.log('[createInvoice] Notification de vente envoyée aux admins');
      } catch (notifError) {
        console.error('[createInvoice] Erreur lors de l\'envoi de la notification:', notifError);
        // Ne pas échouer la transaction si la notification échoue
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
  };
}

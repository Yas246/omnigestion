/**
 * Service global pour maintenir les connexions onSnapshot actives
 *
 * Ce service garantit que les écoutes Firestore ne sont jamais arrêtées
 * lors de la navigation, permettant au cache React Query de persister.
 */

import { QueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  where,
  getDocs,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, Invoice, Client, Warehouse } from '@/types';

type ListenerUnsubscribe = () => void;

interface WarehouseQuantity {
  warehouseId: string;
  warehouseName: string;
  quantity: number;
}

interface RealtimeState {
  // Listeners existants
  productsListener: ListenerUnsubscribe | null;
  invoicesListener: ListenerUnsubscribe | null;
  clientsListener: ListenerUnsubscribe | null;
  warehousesListener: ListenerUnsubscribe | null;

  // NOUVEAUX listeners
  cashRegistersListener: ListenerUnsubscribe | null;
  cashMovementsListener: ListenerUnsubscribe | null;
  clientCreditsListener: ListenerUnsubscribe | null;
  suppliersListener: ListenerUnsubscribe | null;
  supplierCreditsListener: ListenerUnsubscribe | null;
  settingsListener: ListenerUnsubscribe | null;
  stockMovementsListener: ListenerUnsubscribe | null;
  warehouseQuantitiesListener: ListenerUnsubscribe | null;
  purchasesListener: ListenerUnsubscribe | null;

  currentCompanyId: string | null;

  // Flags pour savoir si le chargement initial est fait
  clientCreditsInitialLoadDone: boolean;
  supplierCreditsInitialLoadDone: boolean;

  // Caches existants
  warehouseQuantitiesCache: Map<string, WarehouseQuantity[]>; // productId -> quantities

  // NOUVEAUX caches pour les données imbriquées
  clientCreditPaymentsCache: Map<string, any[]>; // creditId -> payments[]
  supplierCreditPaymentsCache: Map<string, any[]>; // creditId -> payments[]
}

class RealtimeService {
  private state: RealtimeState = {
    // Listeners existants
    productsListener: null,
    invoicesListener: null,
    clientsListener: null,
    warehousesListener: null,

    // NOUVEAUX listeners
    cashRegistersListener: null,
    cashMovementsListener: null,
    clientCreditsListener: null,
    suppliersListener: null,
    supplierCreditsListener: null,
    settingsListener: null,
    stockMovementsListener: null,
    warehouseQuantitiesListener: null,
    purchasesListener: null,

    currentCompanyId: null,

    // Flags
    clientCreditsInitialLoadDone: false,
    supplierCreditsInitialLoadDone: false,

    // Caches
    warehouseQuantitiesCache: new Map(),
    clientCreditPaymentsCache: new Map(),
    supplierCreditPaymentsCache: new Map(),
  };

  /**
   * Démarre l'écoute des produits (si pas déjà démarrée)
   */
  startProductsListener(queryClient: QueryClient, companyId: string) {
    if (!queryClient) {
      console.error('[RealtimeService] ❌ queryClient est undefined');
      return;
    }
    // Si déjà connecté à la même compagnie, rien à faire
    if (this.state.productsListener && this.state.currentCompanyId === companyId) {
      console.log('[RealtimeService] ♻️ Produits déjà en écoute');
      return;
    }

    // Arrêter l'écoute précédente si différente compagnie
    if (this.state.productsListener && this.state.currentCompanyId !== companyId) {
      console.log('[RealtimeService] 🔄 Arrêt écoute produits (changement compagnie)');
      this.state.productsListener();
      this.state.productsListener = null;

      // NETTOYER le cache des warehouseQuantités quand on change de compagnie
      this.clearWarehouseQuantitiesCache();
    }

    console.log('[RealtimeService] 🔄 Démarrage écoute produits (GLOBAL)');

    const q = query(
      collection(db, `companies/${companyId}/products`)
    );

    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        const changes = snapshot.docChanges();

        // Snapshot initial - charger tous les produits
        if (changes.length === 0) {
          const products = snapshot.docs.map(doc => {
            const data = doc.data();
            const product: any = {
              ...data,
              id: doc.id,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            };
            // Enrichir avec les warehouseQuantities du cache (si disponible)
            return this.enrichProductWithWarehouses(product as Product);
          });

          // Trier par nom alphabétique
          products.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

          queryClient.setQueryData(
            ['companies', companyId, 'products'],
            products
          );
          console.log(`[RealtimeService] ✅ ${products.length} produits chargés (GLOBAL)`);
          return;
        }

        // Changements incrémentiels
        console.log(`[RealtimeService] 📊 ${changes.length} changement(s) produits`);

        const currentProducts = queryClient.getQueryData<Product>(
          ['companies', companyId, 'products']
        );

        let updatedProducts = Array.isArray(currentProducts) ? [...currentProducts] : [];

        changes.forEach((change) => {
          const data = change.doc.data();
          const product = {
            id: change.doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as Product;

          // Enrichir avec les warehouseQuantities du cache (si disponible)
          const enrichedProduct = this.enrichProductWithWarehouses(product);

          switch (change.type) {
            case 'added':
              if (!updatedProducts.find(p => p.id === enrichedProduct.id)) {
                updatedProducts.push(enrichedProduct);
              }
              break;

            case 'modified':
              updatedProducts = updatedProducts.map(p =>
                p.id === enrichedProduct.id ? enrichedProduct : p
              );
              break;

            case 'removed':
              updatedProducts = updatedProducts.filter(p => p.id !== enrichedProduct.id);
              // Retirer du cache quand le produit est supprimé
              this.state.warehouseQuantitiesCache.delete(enrichedProduct.id);
              break;
          }
        });

        // Trier par nom alphabétique après les changements incrémentiels
        updatedProducts.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

        queryClient.setQueryData(
          ['companies', companyId, 'products'],
          updatedProducts
        );
      },

      error: (err) => {
        console.error('[RealtimeService] ❌ Erreur écoute produits:', err);
      },
    });

    this.state.productsListener = unsubscribe;
    this.state.currentCompanyId = companyId;
  }

  /**
   * Met en cache les warehouseQuantities d'un produit
   */
  cacheWarehouseQuantities(productId: string, quantities: WarehouseQuantity[]) {
    this.state.warehouseQuantitiesCache.set(productId, quantities);
  }

  /**
   * Enrichit un produit avec ses warehouseQuantités depuis le cache
   */
  enrichProductWithWarehouses(product: Product): Product {
    const cached = this.state.warehouseQuantitiesCache.get(product.id);
    if (cached && cached.length > 0) {
      const calculatedStock = cached.reduce((sum, wq) => sum + wq.quantity, 0);
      console.log(`[enrichProductWithWarehouses] 📦 ${product.name}: ${cached.length} dépôts, stock Firestore = ${product.currentStock}, stock calculé = ${calculatedStock}`);
      return {
        ...product,
        warehouseQuantities: cached,
        currentStock: calculatedStock, // PRIO: Doit être APRÈS ...product pour écraser la valeur Firestore
      };
    }
    console.log(`[enrichProductWithWarehouses] ⚠️ ${product.name}: Pas de warehouseQuantities dans le cache (currentStock = ${product.currentStock})`);
    return product;
  }

  /**
   * Nettoie le cache des warehouseQuantities (changement de compagnie)
   */
  clearWarehouseQuantitiesCache() {
    this.state.warehouseQuantitiesCache.clear();
    console.log('[RealtimeService] 🧹 Cache warehouseQuantities vidé');
  }

  /**
   * Met en cache les payments d'un crédit client
   */
  cacheClientCreditPayments(creditId: string, payments: any[]) {
    this.state.clientCreditPaymentsCache.set(creditId, payments);
  }

  /**
   * Enrichit un crédit client avec ses payments depuis le cache
   */
  enrichClientCreditWithPayments(credit: any): any {
    const cached = this.state.clientCreditPaymentsCache.get(credit.id);
    if (cached && cached.length > 0) {
      return {
        ...credit,
        payments: cached,
        amountPaid: cached.reduce((sum, p) => sum + (p.amount || 0), 0),
        remainingAmount: credit.amount - cached.reduce((sum, p) => sum + (p.amount || 0), 0),
      };
    }
    return credit;
  }

  /**
   * Nettoie le cache des client credit payments
   */
  clearClientCreditPaymentsCache() {
    this.state.clientCreditPaymentsCache.clear();
    console.log('[RealtimeService] 🧹 Cache clientCreditPayments vidé');
  }

  /**
   * Met en cache les payments d'un crédit fournisseur
   */
  cacheSupplierCreditPayments(creditId: string, payments: any[]) {
    this.state.supplierCreditPaymentsCache.set(creditId, payments);
  }

  /**
   * Enrichit un crédit fournisseur avec ses payments depuis le cache
   */
  enrichSupplierCreditWithPayments(credit: any): any {
    const cached = this.state.supplierCreditPaymentsCache.get(credit.id);
    if (cached && cached.length > 0) {
      return {
        ...credit,
        payments: cached,
        amountPaid: cached.reduce((sum, p) => sum + (p.amount || 0), 0),
        remainingAmount: credit.amount - cached.reduce((sum, p) => sum + (p.amount || 0), 0),
      };
    }
    return credit;
  }

  /**
   * Nettoie le cache des supplier credit payments
   */
  clearSupplierCreditPaymentsCache() {
    this.state.supplierCreditPaymentsCache.clear();
    console.log('[RealtimeService] 🧹 Cache supplierCreditPayments vidé');
  }

  /**
   * Démarre l'écoute des factures (si pas déjà démarrée)
   */
  startInvoicesListener(queryClient: QueryClient, companyId: string, isEmployee: boolean) {
    // Si déjà connecté à la même compagnie et même rôle, rien à faire
    if (this.state.invoicesListener && this.state.currentCompanyId === companyId) {
      console.log('[RealtimeService] ♻️ Factures déjà en écoute');
      return;
    }

    // Arrêter l'écoute précédente
    if (this.state.invoicesListener) {
      console.log('[RealtimeService] 🔄 Arrêt écoute factures (changement compagnie)');
      this.state.invoicesListener();
      this.state.invoicesListener = null;
    }

    console.log('[RealtimeService] 🔄 Démarrage écoute factures (GLOBAL)', { isEmployee });

    let q = query(
      collection(db, `companies/${companyId}/invoices`),
      orderBy('createdAt', 'desc')
    );

    if (isEmployee) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      q = query(q, where('createdAt', '>=', today));
      q = query(q, where('createdAt', '<', tomorrow));
    }

    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        const changes = snapshot.docChanges();

        // Snapshot initial
        if (changes.length === 0) {
          const invoices = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              date: data.date?.toDate ? data.date.toDate() : (data.saleDate?.toDate ? data.saleDate.toDate() : new Date()),
              saleDate: data.saleDate?.toDate() || undefined,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
              validatedAt: data.validatedAt?.toDate() || undefined,
              paidAt: data.paidAt?.toDate() || undefined,
              dueDate: data.dueDate?.toDate() || undefined,
            } as unknown as Invoice;
          });

          queryClient.setQueryData(
            ['companies', companyId, 'invoices', isEmployee ? 'today' : 'all'],
            invoices
          );
          console.log(`[RealtimeService] ✅ ${invoices.length} factures chargées (GLOBAL)`);
          return;
        }

        // Changements incrémentiels
        console.log(`[RealtimeService] 📊 ${changes.length} changement(s) factures`);

        const currentInvoices = queryClient.getQueryData<Invoice>(
          ['companies', companyId, 'invoices', isEmployee ? 'today' : 'all']
        );

        let updatedInvoices = Array.isArray(currentInvoices) ? [...currentInvoices] : [];

        changes.forEach((change) => {
          const data = change.doc.data();
          const invoice = {
            ...data,
            id: change.doc.id,
            date: data.date?.toDate ? data.date.toDate() : (data.saleDate?.toDate ? data.saleDate.toDate() : new Date()),
            saleDate: data.saleDate?.toDate() || undefined,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            validatedAt: data.validatedAt?.toDate() || undefined,
            paidAt: data.paidAt?.toDate() || undefined,
            dueDate: data.dueDate?.toDate() || undefined,
          } as unknown as Invoice;

          switch (change.type) {
            case 'added':
              if (!updatedInvoices.find(inv => inv.id === invoice.id)) {
                updatedInvoices.push(invoice);
              }
              break;

            case 'modified':
              updatedInvoices = updatedInvoices.map(inv =>
                inv.id === invoice.id ? invoice : inv
              );
              break;

            case 'removed':
              updatedInvoices = updatedInvoices.filter(inv => inv.id !== invoice.id);
              break;
          }
        });

        updatedInvoices.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        queryClient.setQueryData(
          ['companies', companyId, 'invoices', isEmployee ? 'today' : 'all'],
          updatedInvoices
        );
      },

      error: (err) => {
        console.error('[RealtimeService] ❌ Erreur écoute factures:', err);
      },
    });

    this.state.invoicesListener = unsubscribe;
    this.state.currentCompanyId = companyId;
  }

  /**
   * Démarre l'écoute des clients (si pas déjà démarrée)
   */
  startClientsListener(queryClient: QueryClient, companyId: string) {
    // Si déjà connecté à la même compagnie, rien à faire
    if (this.state.clientsListener && this.state.currentCompanyId === companyId) {
      console.log('[RealtimeService] ♻️ Clients déjà en écoute');
      return;
    }

    // Arrêter l'écoute précédente
    if (this.state.clientsListener) {
      console.log('[RealtimeService] 🔄 Arrêt écoute clients (changement compagnie)');
      this.state.clientsListener();
      this.state.clientsListener = null;
    }

    console.log('[RealtimeService] 🔄 Démarrage écoute clients (GLOBAL)');

    const q = query(
      collection(db, `companies/${companyId}/clients`),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        const changes = snapshot.docChanges();

        // Snapshot initial
        if (changes.length === 0) {
          const clients = snapshot.docs.map(doc => {
            const data = doc.data();
            const client: any = {
              ...data,
              id: doc.id,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            };
            return client as Client;
          });

          clients.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

          queryClient.setQueryData(
            ['companies', companyId, 'clients'],
            clients
          );
          console.log(`[RealtimeService] ✅ ${clients.length} clients chargés (GLOBAL)`);
          return;
        }

        // Changements incrémentiels
        console.log(`[RealtimeService] 📊 ${changes.length} changement(s) clients`);

        const currentClients = queryClient.getQueryData<Client>(
          ['companies', companyId, 'clients']
        );

        let updatedClients = Array.isArray(currentClients) ? [...currentClients] : [];

        changes.forEach((change) => {
          const data = change.doc.data();
          const client = {
            id: change.doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as Client;

          switch (change.type) {
            case 'added':
              if (!updatedClients.find(c => c.id === client.id)) {
                updatedClients.push(client);
              }
              break;
            case 'modified':
              updatedClients = updatedClients.map(c =>
                c.id === client.id ? client : c
              );
              break;
            case 'removed':
              updatedClients = updatedClients.filter(c => c.id !== client.id);
              break;
          }
        });

        updatedClients.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

        queryClient.setQueryData(
          ['companies', companyId, 'clients'],
          updatedClients
        );
      },

      error: (err) => {
        console.error('[RealtimeService] ❌ Erreur écoute clients:', err);
      },
    });

    this.state.clientsListener = unsubscribe;
    this.state.currentCompanyId = companyId;
  }

  /**
   * Démarre l'écoute des entrepôts (si pas déjà démarrée)
   */
  startWarehousesListener(queryClient: QueryClient, companyId: string) {
    // Si déjà connecté à la même compagnie, rien à faire
    if (this.state.warehousesListener && this.state.currentCompanyId === companyId) {
      console.log('[RealtimeService] ♻️ Entrepôts déjà en écoute');
      return;
    }

    // Arrêter l'écoute précédente
    if (this.state.warehousesListener) {
      console.log('[RealtimeService] 🔄 Arrêt écoute entrepôts (changement compagnie)');
      this.state.warehousesListener();
      this.state.warehousesListener = null;
    }

    console.log('[RealtimeService] 🔄 Démarrage écoute entrepôts (GLOBAL)');

    const q = query(collection(db, `companies/${companyId}/warehouses`));

    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        const changes = snapshot.docChanges();

        // Snapshot initial
        if (changes.length === 0) {
          const warehouses = snapshot.docs.map(doc => {
            const data = doc.data();
            const warehouse: any = {
              ...data,
              id: doc.id,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            };
            return warehouse as Warehouse;
          });

          queryClient.setQueryData(
            ['companies', companyId, 'warehouses'],
            warehouses
          );
          console.log(`[RealtimeService] ✅ ${warehouses.length} entrepôts chargés (GLOBAL)`);
          return;
        }

        // Changements incrémentiels
        console.log(`[RealtimeService] 📊 ${changes.length} changement(s) entrepôts`);

        const currentWarehouses = queryClient.getQueryData<Warehouse>(
          ['companies', companyId, 'warehouses']
        );

        let updatedWarehouses = Array.isArray(currentWarehouses) ? [...currentWarehouses] : [];

        changes.forEach((change) => {
          const data = change.doc.data();
          const warehouse = {
            id: change.doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as Warehouse;

          switch (change.type) {
            case 'added':
              if (!updatedWarehouses.find(w => w.id === warehouse.id)) {
                updatedWarehouses.push(warehouse);
              }
              break;
            case 'modified':
              updatedWarehouses = updatedWarehouses.map(w =>
                w.id === warehouse.id ? warehouse : w
              );
              break;
            case 'removed':
              updatedWarehouses = updatedWarehouses.filter(w => w.id !== warehouse.id);
              break;
          }
        });

        queryClient.setQueryData(
          ['companies', companyId, 'warehouses'],
          updatedWarehouses
        );
      },

      error: (err) => {
        console.error('[RealtimeService] ❌ Erreur écoute entrepôts:', err);
      },
    });

    this.state.warehousesListener = unsubscribe;
    this.state.currentCompanyId = companyId;
  }

  /**
   * Démarre l'écoute des caisses (si pas déjà démarrée)
   */
  startCashRegistersListener(queryClient: QueryClient, companyId: string) {
    // Si déjà connecté à la même compagnie, rien à faire
    if (this.state.cashRegistersListener && this.state.currentCompanyId === companyId) {
      console.log('[RealtimeService] ♻️ Caisses déjà en écoute');
      return;
    }

    // Arrêter l'écoute précédente
    if (this.state.cashRegistersListener) {
      console.log('[RealtimeService] 🔄 Arrêt écoute caisses (changement compagnie)');
      this.state.cashRegistersListener();
      this.state.cashRegistersListener = null;
    }

    console.log('[RealtimeService] 🔄 Démarrage écoute caisses (GLOBAL)');

    const q = query(
      collection(db, `companies/${companyId}/cash_registers`),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        const changes = snapshot.docChanges();

        // Snapshot initial
        if (changes.length === 0) {
          const cashRegisters = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            };
          });

          queryClient.setQueryData(
            ['companies', companyId, 'cashRegisters'],
            cashRegisters
          );
          console.log(`[RealtimeService] ✅ ${cashRegisters.length} caisses chargées (GLOBAL)`);
          return;
        }

        // Changements incrémentiels
        console.log(`[RealtimeService] 📊 ${changes.length} changement(s) caisses`);

        const currentCashRegisters = queryClient.getQueryData<any>(
          ['companies', companyId, 'cashRegisters']
        );

        let updatedCashRegisters = Array.isArray(currentCashRegisters) ? [...currentCashRegisters] : [];

        changes.forEach((change) => {
          const data = change.doc.data();
          const cashRegister = {
            id: change.doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          };

          switch (change.type) {
            case 'added':
              if (!updatedCashRegisters.find(cr => cr.id === cashRegister.id)) {
                updatedCashRegisters.push(cashRegister);
              }
              break;
            case 'modified':
              updatedCashRegisters = updatedCashRegisters.map(cr =>
                cr.id === cashRegister.id ? cashRegister : cr
              );
              break;
            case 'removed':
              updatedCashRegisters = updatedCashRegisters.filter(cr => cr.id !== cashRegister.id);
              break;
          }
        });

        updatedCashRegisters.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

        queryClient.setQueryData(
          ['companies', companyId, 'cashRegisters'],
          updatedCashRegisters
        );
      },

      error: (err) => {
        console.error('[RealtimeService] ❌ Erreur écoute caisses:', err);
      },
    });

    this.state.cashRegistersListener = unsubscribe;
    this.state.currentCompanyId = companyId;
  }

  /**
   * Démarre l'écoute des mouvements de caisse (si pas déjà démarrée)
   */
  startCashMovementsListener(queryClient: QueryClient, companyId: string, limit: number = 20) {
    // Vérification de sécurité
    if (!queryClient) {
      console.error('[RealtimeService] ❌ queryClient est undefined');
      return;
    }

    // Si déjà connecté à la même compagnie, rien à faire
    if (this.state.cashMovementsListener && this.state.currentCompanyId === companyId) {
      console.log('[RealtimeService] ♻️ Mouvements de caisse déjà en écoute');
      return;
    }

    // Arrêter l'écoute précédente
    if (this.state.cashMovementsListener) {
      console.log('[RealtimeService] 🔄 Arrêt écoute mouvements caisse (changement compagnie)');
      this.state.cashMovementsListener();
      this.state.cashMovementsListener = null;
    }

    console.log('[RealtimeService] 🔄 Démarrage écoute mouvements caisse (GLOBAL)');

    const q = query(
      collection(db, `companies/${companyId}/cash_movements`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        const changes = snapshot.docChanges();

        // Snapshot initial
        if (changes.length === 0) {
          const movements = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            };
          });

          // Stocker un tableau simple (pas de structure useInfiniteQuery)
          queryClient.setQueryData(
            ['companies', companyId, 'cashMovements'],
            movements
          );
          console.log(`[RealtimeService] ✅ ${movements.length} mouvements caisse chargés (GLOBAL)`);
          return;
        }

        // Changements incrémentiels
        console.log(`[RealtimeService] 📊 ${changes.length} changement(s) mouvements caisse`);

        const currentMovements = queryClient.getQueryData<any>(
          ['companies', companyId, 'cashMovements']
        );

        let updatedMovements = Array.isArray(currentMovements) ? [...currentMovements] : [];

        changes.forEach((change) => {
          const data = change.doc.data();
          const movement = {
            id: change.doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          };

          switch (change.type) {
            case 'added':
              if (!updatedMovements.find(m => m.id === movement.id)) {
                updatedMovements.push(movement);
              }
              break;
            case 'modified':
              updatedMovements = updatedMovements.map(m =>
                m.id === movement.id ? movement : m
              );
              break;
            case 'removed':
              updatedMovements = updatedMovements.filter(m => m.id !== movement.id);
              break;
          }
        });

        updatedMovements.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Stocker un tableau simple
        queryClient.setQueryData(
          ['companies', companyId, 'cashMovements'],
          updatedMovements
        );
      },

      error: (err) => {
        console.error('[RealtimeService] ❌ Erreur écoute mouvements caisse:', err);
      },
    });

    this.state.cashMovementsListener = unsubscribe;
    this.state.currentCompanyId = companyId;
  }

  /**
   * Démarre l'écoute des crédits clients (si pas déjà démarrée)
   */
  startClientCreditsListener(queryClient: QueryClient, companyId: string) {
    // Si déjà connecté à la même compagnie, rien à faire
    if (this.state.clientCreditsListener && this.state.currentCompanyId === companyId) {
      console.log('[RealtimeService] ♻️ Crédits clients déjà en écoute');
      return;
    }

    // Arrêter l'écoute précédente
    if (this.state.clientCreditsListener) {
      console.log('[RealtimeService] 🔄 Arrêt écoute crédits clients (changement compagnie)');
      this.state.clientCreditsListener();
      this.state.clientCreditsListener = null;
    }

    console.log('[RealtimeService] 🔄 Démarrage écoute crédits clients (GLOBAL)');

    const q = query(
      collection(db, `companies/${companyId}/client_credits`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, {
      next: async (snapshot) => {
        const changes = snapshot.docChanges();

        // Snapshot initial
        if (changes.length === 0) {
          const credits = snapshot.docs.map(doc => {
            const data = doc.data();
            const credit: any = {
              ...data,
              id: doc.id,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            };
            // Enrichir avec les payments du cache (si disponible)
            return this.enrichClientCreditWithPayments(credit);
          });

          // Charger les payments pour chaque crédit de manière asynchrone
          const enrichedCredits = await Promise.all(
            credits.map(async (credit) => {
              // Si déjà enrichi avec des payments, retourner tel quel
              if (credit.payments && credit.payments.length > 0) {
                return credit;
              }

              // Sinon, charger les payments depuis Firestore
              try {
                const paymentsSnapshot = await getDocs(
                  query(collection(db, `companies/${companyId}/client_credits/${credit.id}/payments`))
                );

                const payments = paymentsSnapshot.docs.map((doc) => ({
                  id: doc.id,
                  ...doc.data(),
                  paidAt: doc.data().paidAt?.toDate() || new Date(),
                  createdAt: doc.data().createdAt?.toDate() || new Date(),
                }));

                const amountPaid = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                const remainingAmount = credit.amount - amountPaid;

                // Mettre en cache pour les mises à jour incrémentales
                this.state.clientCreditPaymentsCache.set(credit.id, payments);

                return {
                  ...credit,
                  payments,
                  amountPaid,
                  remainingAmount,
                };
              } catch (err) {
                console.error(`[RealtimeService] ❌ Erreur chargement payments pour crédit ${credit.id}:`, err);
                return credit;
              }
            })
          );

          queryClient.setQueryData(
            ['companies', companyId, 'clientCredits'],
            enrichedCredits
          );

          // 🔄 Marquer que les crédits sont chargés avec leurs payments
          this.state.clientCreditsInitialLoadDone = true;

          console.log(`[RealtimeService] ✅ ${enrichedCredits.length} crédits clients chargés (GLOBAL)`);
          return;
        }

        // Changements incrémentiels
        console.log(`[RealtimeService] 📊 ${changes.length} changement(s) crédits clients`);

        const currentCredits = queryClient.getQueryData<any>(
          ['companies', companyId, 'clientCredits']
        );

        let updatedCredits = Array.isArray(currentCredits) ? [...currentCredits] : [];

        changes.forEach((change) => {
          const data = change.doc.data();
          const credit = {
            id: change.doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          };

          // 🔄 IMPORTANT: Préserver les payments existants du crédit actuel
          const existingCredit = updatedCredits.find(c => c.id === credit.id);
          const creditWithPayments = existingCredit?.payments
            ? { ...credit, payments: existingCredit.payments, amountPaid: existingCredit.amountPaid, remainingAmount: existingCredit.remainingAmount }
            : this.enrichClientCreditWithPayments(credit);

          switch (change.type) {
            case 'added':
              if (!updatedCredits.find(c => c.id === creditWithPayments.id)) {
                updatedCredits.push(creditWithPayments);
              }
              break;
            case 'modified':
              updatedCredits = updatedCredits.map(c =>
                c.id === creditWithPayments.id ? creditWithPayments : c
              );
              break;
            case 'removed':
              updatedCredits = updatedCredits.filter(c => c.id !== creditWithPayments.id);
              // Retirer du cache quand le crédit est supprimé
              this.state.clientCreditPaymentsCache.delete(creditWithPayments.id);
              break;
          }
        });

        updatedCredits.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        queryClient.setQueryData(
          ['companies', companyId, 'clientCredits'],
          updatedCredits
        );

        // 🔄 Force React Query à déclencher un re-render
        queryClient.invalidateQueries({
          queryKey: ['companies', companyId, 'clientCredits'],
          refetchType: 'none', // Ne pas recharger depuis Firestore, juste notifier les subscribers
        });
      },

      error: (err) => {
        console.error('[RealtimeService] ❌ Erreur écoute crédits clients:', err);
      },
    });

    this.state.clientCreditsListener = unsubscribe;
    this.state.currentCompanyId = companyId;
  }

  /**
   * Démarre l'écoute des fournisseurs (si pas déjà démarrée)
   */
  startSuppliersListener(queryClient: QueryClient, companyId: string) {
    // Si déjà connecté à la même compagnie, rien à faire
    if (this.state.suppliersListener && this.state.currentCompanyId === companyId) {
      console.log('[RealtimeService] ♻️ Fournisseurs déjà en écoute');
      return;
    }

    // Arrêter l'écoute précédente
    if (this.state.suppliersListener) {
      console.log('[RealtimeService] 🔄 Arrêt écoute fournisseurs (changement compagnie)');
      this.state.suppliersListener();
      this.state.suppliersListener = null;
    }

    console.log('[RealtimeService] 🔄 Démarrage écoute fournisseurs (GLOBAL)');

    const q = query(
      collection(db, `companies/${companyId}/suppliers`),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        const changes = snapshot.docChanges();

        // Snapshot initial
        if (changes.length === 0) {
          const suppliers = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            };
          }) as any[];

          suppliers.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

          queryClient.setQueryData(
            ['companies', companyId, 'suppliers'],
            suppliers
          );
          console.log(`[RealtimeService] ✅ ${suppliers.length} fournisseurs chargés (GLOBAL)`);
          return;
        }

        // Changements incrémentiels
        console.log(`[RealtimeService] 📊 ${changes.length} changement(s) fournisseurs`);

        const currentSuppliers = queryClient.getQueryData<any>(
          ['companies', companyId, 'suppliers']
        );

        let updatedSuppliers = Array.isArray(currentSuppliers) ? [...currentSuppliers] : [];

        changes.forEach((change) => {
          const data = change.doc.data();
          const supplier = {
            id: change.doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          };

          switch (change.type) {
            case 'added':
              if (!updatedSuppliers.find(s => s.id === supplier.id)) {
                updatedSuppliers.push(supplier);
              }
              break;
            case 'modified':
              updatedSuppliers = updatedSuppliers.map(s =>
                s.id === supplier.id ? supplier : s
              );
              break;
            case 'removed':
              updatedSuppliers = updatedSuppliers.filter(s => s.id !== supplier.id);
              break;
          }
        });

        updatedSuppliers.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

        queryClient.setQueryData(
          ['companies', companyId, 'suppliers'],
          updatedSuppliers
        );
      },

      error: (err) => {
        console.error('[RealtimeService] ❌ Erreur écoute fournisseurs:', err);
      },
    });

    this.state.suppliersListener = unsubscribe;
    this.state.currentCompanyId = companyId;
  }

  /**
   * Démarre l'écoute des achats fournisseurs (si pas déjà démarrée)
   */
  startPurchasesListener(queryClient: QueryClient, companyId: string) {
    // Si déjà connecté à la même compagnie, rien à faire
    if (this.state.purchasesListener && this.state.currentCompanyId === companyId) {
      console.log('[RealtimeService] ♻️ Achats déjà en écoute');
      return;
    }

    // Arrêter l'écoute précédente
    if (this.state.purchasesListener) {
      console.log('[RealtimeService] 🔄 Arrêt écoute achats (changement compagnie)');
      this.state.purchasesListener();
      this.state.purchasesListener = null;
    }

    console.log('[RealtimeService] 🔄 Démarrage écoute achats (GLOBAL)');

    const q = query(
      collection(db, `companies/${companyId}/purchases`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        const changes = snapshot.docChanges();

        // Snapshot initial
        if (changes.length === 0) {
          const purchases = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            };
          }) as any[];

          queryClient.setQueryData(
            ['companies', companyId, 'purchases'],
            purchases
          );
          console.log(`[RealtimeService] ✅ ${purchases.length} achats chargés (GLOBAL)`);
          return;
        }

        // Changements incrémentiels
        console.log(`[RealtimeService] 📊 ${changes.length} changement(s) achats`);

        const currentPurchases = queryClient.getQueryData<any>(
          ['companies', companyId, 'purchases']
        );

        let updatedPurchases = Array.isArray(currentPurchases) ? [...currentPurchases] : [];

        changes.forEach((change) => {
          const data = change.doc.data();
          const purchase = {
            id: change.doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          };

          switch (change.type) {
            case 'added':
              if (!updatedPurchases.find(p => p.id === purchase.id)) {
                updatedPurchases.push(purchase);
              }
              break;
            case 'modified':
              updatedPurchases = updatedPurchases.map(p =>
                p.id === purchase.id ? purchase : p
              );
              break;
            case 'removed':
              updatedPurchases = updatedPurchases.filter(p => p.id !== purchase.id);
              break;
          }
        });

        updatedPurchases.sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
          const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
          return dateB - dateA; // Plus récent en premier
        });

        queryClient.setQueryData(
          ['companies', companyId, 'purchases'],
          updatedPurchases
        );
      },

      error: (err) => {
        console.error('[RealtimeService] ❌ Erreur écoute achats:', err);
      },
    });

    this.state.purchasesListener = unsubscribe;
    this.state.currentCompanyId = companyId;
  }

  /**
   * Démarre l'écoute des crédits fournisseurs (si pas déjà démarrée)
   */
  startSupplierCreditsListener(queryClient: QueryClient, companyId: string) {
    // Si déjà connecté à la même compagnie, rien à faire
    if (this.state.supplierCreditsListener && this.state.currentCompanyId === companyId) {
      console.log('[RealtimeService] ♻️ Crédits fournisseurs déjà en écoute');
      return;
    }

    // Arrêter l'écoute précédente
    if (this.state.supplierCreditsListener) {
      console.log('[RealtimeService] 🔄 Arrêt écoute crédits fournisseurs (changement compagnie)');
      this.state.supplierCreditsListener();
      this.state.supplierCreditsListener = null;
    }

    console.log('[RealtimeService] 🔄 Démarrage écoute crédits fournisseurs (GLOBAL)');

    const q = query(
      collection(db, `companies/${companyId}/supplier_credits`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, {
      next: async (snapshot) => {
        const changes = snapshot.docChanges();

        // Snapshot initial
        if (changes.length === 0) {
          const credits = snapshot.docs.map(doc => {
            const data = doc.data();
            const credit: any = {
              ...data,
              id: doc.id,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            };
            // Enrichir avec les payments du cache (si disponible)
            return this.enrichSupplierCreditWithPayments(credit);
          });

          // Charger les payments pour chaque crédit de manière asynchrone
          const enrichedCredits = await Promise.all(
            credits.map(async (credit) => {
              // Si déjà enrichi avec des payments, retourner tel quel
              if (credit.payments && credit.payments.length > 0) {
                return credit;
              }

              // Sinon, charger les payments depuis Firestore
              try {
                const paymentsSnapshot = await getDocs(
                  query(collection(db, `companies/${companyId}/supplier_credits/${credit.id}/payments`))
                );

                const payments = paymentsSnapshot.docs.map((doc) => ({
                  id: doc.id,
                  ...doc.data(),
                  paidAt: doc.data().paidAt?.toDate() || new Date(),
                  createdAt: doc.data().createdAt?.toDate() || new Date(),
                }));

                const amountPaid = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                const remainingAmount = credit.amount - amountPaid;

                // Mettre en cache pour les mises à jour incrémentales
                this.state.supplierCreditPaymentsCache.set(credit.id, payments);

                return {
                  ...credit,
                  payments,
                  amountPaid,
                  remainingAmount,
                };
              } catch (err) {
                console.error(`[RealtimeService] ❌ Erreur chargement payments pour crédit ${credit.id}:`, err);
                return credit;
              }
            })
          );

          queryClient.setQueryData(
            ['companies', companyId, 'supplierCredits'],
            enrichedCredits
          );

          // 🔄 Marquer que les crédits sont chargés avec leurs payments
          this.state.supplierCreditsInitialLoadDone = true;

          console.log(`[RealtimeService] ✅ ${enrichedCredits.length} crédits fournisseurs chargés (GLOBAL)`);
          return;
        }

        // Changements incrémentiels
        console.log(`[RealtimeService] 📊 ${changes.length} changement(s) crédits fournisseurs`);

        const currentCredits = queryClient.getQueryData<any>(
          ['companies', companyId, 'supplierCredits']
        );

        let updatedCredits = Array.isArray(currentCredits) ? [...currentCredits] : [];

        changes.forEach((change) => {
          const data = change.doc.data();
          const credit = {
            id: change.doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          };

          // 🔄 IMPORTANT: Préserver les payments existants du crédit actuel
          const existingCredit = updatedCredits.find(c => c.id === credit.id);
          const creditWithPayments = existingCredit?.payments
            ? { ...credit, payments: existingCredit.payments, amountPaid: existingCredit.amountPaid, remainingAmount: existingCredit.remainingAmount }
            : this.enrichSupplierCreditWithPayments(credit);

          switch (change.type) {
            case 'added':
              if (!updatedCredits.find(c => c.id === creditWithPayments.id)) {
                updatedCredits.push(creditWithPayments);
              }
              break;
            case 'modified':
              updatedCredits = updatedCredits.map(c =>
                c.id === creditWithPayments.id ? creditWithPayments : c
              );
              break;
            case 'removed':
              updatedCredits = updatedCredits.filter(c => c.id !== creditWithPayments.id);
              // Retirer du cache quand le crédit est supprimé
              this.state.supplierCreditPaymentsCache.delete(creditWithPayments.id);
              break;
          }
        });

        updatedCredits.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        queryClient.setQueryData(
          ['companies', companyId, 'supplierCredits'],
          updatedCredits
        );

        // 🔄 Force React Query à déclencher un re-render
        queryClient.invalidateQueries({
          queryKey: ['companies', companyId, 'supplierCredits'],
          refetchType: 'none', // Ne pas recharger depuis Firestore, juste notifier les subscribers
        });
      },

      error: (err) => {
        console.error('[RealtimeService] ❌ Erreur écoute crédits fournisseurs:', err);
      },
    });

    this.state.supplierCreditsListener = unsubscribe;
    this.state.currentCompanyId = companyId;
  }

  /**
   * Démarre l'écoute des paramètres (si pas déjà démarrée)
   * Note: Écoute un document unique, pas une collection
   */
  startSettingsListener(queryClient: QueryClient, companyId: string) {
    // Si déjà connecté à la même compagnie, rien à faire
    if (this.state.settingsListener && this.state.currentCompanyId === companyId) {
      console.log('[RealtimeService] ♻️ Paramètres déjà en écoute');
      return;
    }

    // Arrêter l'écoute précédente
    if (this.state.settingsListener) {
      console.log('[RealtimeService] 🔄 Arrêt écoute paramètres (changement compagnie)');
      this.state.settingsListener();
      this.state.settingsListener = null;
    }

    console.log('[RealtimeService] 🔄 Démarrage écoute paramètres (GLOBAL)');

    const companyRef = doc(db, `companies/${companyId}`);

    const unsubscribe = onSnapshot(companyRef, {
      next: (snapshot) => {
        if (!snapshot.exists()) {
          console.warn('[RealtimeService] ⚠️ Document compagnie introuvable');
          return;
        }

        const data = snapshot.data();
        const settings = {
          ...data,
          id: snapshot.id,
          createdAt: data?.createdAt?.toDate() || new Date(),
          updatedAt: data?.updatedAt?.toDate() || new Date(),
        };

        queryClient.setQueryData(
          ['companies', companyId, 'settings'],
          settings
        );
        console.log('[RealtimeService] ✅ Paramètres chargés (GLOBAL)');
      },

      error: (err) => {
        console.error('[RealtimeService] ❌ Erreur écoute paramètres:', err);
      },
    });

    this.state.settingsListener = unsubscribe;
    this.state.currentCompanyId = companyId;
  }

  /**
   * Démarre l'écoute des mouvements de stock (si pas déjà démarrée)
   */
  startStockMovementsListener(queryClient: QueryClient, companyId: string, limit: number = 20) {
    // Si déjà connecté à la même compagnie, rien à faire
    if (this.state.stockMovementsListener && this.state.currentCompanyId === companyId) {
      console.log('[RealtimeService] ♻️ Mouvements stock déjà en écoute');
      return;
    }

    // Arrêter l'écoute précédente
    if (this.state.stockMovementsListener) {
      console.log('[RealtimeService] 🔄 Arrêt écoute mouvements stock (changement compagnie)');
      this.state.stockMovementsListener();
      this.state.stockMovementsListener = null;
    }

    console.log('[RealtimeService] 🔄 Démarrage écoute mouvements stock (GLOBAL)');

    const q = query(
      collection(db, `companies/${companyId}/stock_movements`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        const changes = snapshot.docChanges();

        // Snapshot initial
        if (changes.length === 0) {
          const movements = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            };
          });

          // Stocker un tableau simple
          queryClient.setQueryData(
            ['companies', companyId, 'stockMovements'],
            movements
          );
          console.log(`[RealtimeService] ✅ ${movements.length} mouvements stock chargés (GLOBAL)`);
          return;
        }

        // Changements incrémentiels
        console.log(`[RealtimeService] 📊 ${changes.length} changement(s) mouvements stock`);

        const currentMovements = queryClient.getQueryData<any>(
          ['companies', companyId, 'stockMovements']
        );

        let updatedMovements = Array.isArray(currentMovements) ? [...currentMovements] : [];

        changes.forEach((change) => {
          const data = change.doc.data();
          const movement = {
            id: change.doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          };

          switch (change.type) {
            case 'added':
              if (!updatedMovements.find(m => m.id === movement.id)) {
                updatedMovements.push(movement);
              }
              break;
            case 'modified':
              updatedMovements = updatedMovements.map(m =>
                m.id === movement.id ? movement : m
              );
              break;
            case 'removed':
              updatedMovements = updatedMovements.filter(m => m.id !== movement.id);
              break;
          }
        });

        updatedMovements.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        queryClient.setQueryData(
          ['companies', companyId, 'stockMovements'],
          updatedMovements
        );
      },

      error: (err) => {
        console.error('[RealtimeService] ❌ Erreur écoute mouvements stock:', err);
      },
    });

    this.state.stockMovementsListener = unsubscribe;
    this.state.currentCompanyId = companyId;
  }

  /**
   * Démarre l'écoute des warehouse_quantities (si pas déjà démarrée)
   */
  startWarehouseQuantitiesListener(queryClient: QueryClient, companyId: string) {
    if (!queryClient) {
      console.error('[RealtimeService] ❌ queryClient est undefined');
      return;
    }

    // Si déjà connecté à la même compagnie, rien à faire
    if (this.state.warehouseQuantitiesListener && this.state.currentCompanyId === companyId) {
      console.log('[RealtimeService] ♻️ Warehouse quantities déjà en écoute');
      return;
    }

    // Arrêter l'écoute précédente si différente compagnie
    if (this.state.warehouseQuantitiesListener && this.state.currentCompanyId !== companyId) {
      console.log('[RealtimeService] 🔄 Arrêt écoute warehouse quantities (changement compagnie)');
      this.state.warehouseQuantitiesListener();
      this.state.warehouseQuantitiesListener = null;
      this.clearWarehouseQuantitiesCache();
    }

    console.log('[RealtimeService] 🔄 Démarrage écoute warehouse quantities (GLOBAL)');

    const q = query(
      collection(db, `companies/${companyId}/warehouse_quantities`),
      orderBy('productId', 'asc')
    );

    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        const changes = snapshot.docChanges();

        // Initial load : tous les documents
        if (changes.length === snapshot.docs.length && snapshot.docs.length > 0) {
          console.log(`[RealtimeService] ✅ ${snapshot.docs.length} warehouse quantities chargés (GLOBAL)`);

          const warehouseQuantitiesMap = new Map<string, WarehouseQuantity[]>();

          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            const quantities: WarehouseQuantity[] = data.quantities || [];
            warehouseQuantitiesMap.set(doc.id, quantities);

            // Mettre en cache les warehouseQuantities
            this.cacheWarehouseQuantities(doc.id, quantities);
          });

          // ✅ Maintenant que le cache est peuplé, ré-enrichir tous les produits
          const products = queryClient.getQueryData<Product[]>(
            ['companies', companyId, 'products']
          ) || [];

          if (products.length > 0) {
            console.log(`[RealtimeService] 🔄 Ré-enrichissement de ${products.length} produits avec le cache maintenant peuplé...`);

            const reEnrichedProducts = products.map((product) => {
              return this.enrichProductWithWarehouses(product);
            });

            queryClient.setQueryData(
              ['companies', companyId, 'products'],
              reEnrichedProducts
            );

            // 🔄 Force React Query à déclencher un re-render
            queryClient.invalidateQueries({
              queryKey: ['companies', companyId, 'products'],
              refetchType: 'none', // Ne pas recharger depuis Firestore, juste notifier les subscribers
            });

            console.log(`[RealtimeService] ✅ ${reEnrichedProducts.length} produits ré-enrichis avec leurs warehouse quantities`);
          }

          return;
        }

        // Mises à jour incrémentales
        if (changes.length > 0) {
          console.log(`[RealtimeService] 📊 ${changes.length} changement(s) warehouse quantities`);

          // Récupérer les produits actuels depuis le cache
          const products = queryClient.getQueryData<Product[]>(
            ['companies', companyId, 'products']
          ) || [];

          if (products.length === 0) return;

          const updatedProducts = [...products];

          changes.forEach((change) => {
            const doc = change.doc;
            const data = doc.data();
            const quantities: WarehouseQuantity[] = data.quantities || [];
            const productId = doc.id;

            // Mettre à jour le cache
            this.cacheWarehouseQuantities(productId, quantities);

            // Trouver et mettre à jour le produit
            const productIndex = updatedProducts.findIndex(p => p.id === productId);

            if (productIndex !== -1) {
              switch (change.type) {
                case 'added':
                case 'modified':
                  // 🔄 Mettre à jour le cache PUIS enrichir le produit
                  this.cacheWarehouseQuantities(productId, quantities);
                  const enrichedProduct = this.enrichProductWithWarehouses(updatedProducts[productIndex]);
                  updatedProducts[productIndex] = enrichedProduct;
                  console.log(`[RealtimeService] 📦 Produit ${productId} mis à jour avec ${quantities.length} dépôt(s), stock total = ${enrichedProduct.currentStock}`);
                  break;
                case 'removed':
                  // Supprimer du cache et réinitialiser le produit
                  this.state.warehouseQuantitiesCache.delete(productId);
                  updatedProducts[productIndex] = {
                    ...updatedProducts[productIndex],
                    warehouseQuantities: [],
                    currentStock: 0,
                  };
                  break;
              }
            }
          });

          // Mettre à jour le cache React Query
          queryClient.setQueryData(
            ['companies', companyId, 'products'],
            updatedProducts
          );

          // 🔄 Force React Query à déclencher un re-render
          queryClient.invalidateQueries({
            queryKey: ['companies', companyId, 'products'],
            refetchType: 'none', // Ne pas recharger depuis Firestore, juste notifier les subscribers
          });
        }
      },

      error: (err) => {
        console.error('[RealtimeService] ❌ Erreur écoute warehouse quantities:', err);
      },
    });

    this.state.warehouseQuantitiesListener = unsubscribe;
    this.state.currentCompanyId = companyId;
  }

  /**
   * Arrête toutes les écoutes (changement de compagnie)
   */
  stopAllListeners() {
    console.log('[RealtimeService] 🛑 Arrêt de toutes les écoutes');

    // Listeners existants
    if (this.state.productsListener) {
      this.state.productsListener();
      this.state.productsListener = null;
    }

    if (this.state.invoicesListener) {
      this.state.invoicesListener();
      this.state.invoicesListener = null;
    }

    if (this.state.clientsListener) {
      this.state.clientsListener();
      this.state.clientsListener = null;
    }

    if (this.state.warehousesListener) {
      this.state.warehousesListener();
      this.state.warehousesListener = null;
    }

    // NOUVEAUX listeners
    if (this.state.cashRegistersListener) {
      this.state.cashRegistersListener();
      this.state.cashRegistersListener = null;
    }

    if (this.state.cashMovementsListener) {
      this.state.cashMovementsListener();
      this.state.cashMovementsListener = null;
    }

    if (this.state.clientCreditsListener) {
      this.state.clientCreditsListener();
      this.state.clientCreditsListener = null;
    }

    if (this.state.suppliersListener) {
      this.state.suppliersListener();
      this.state.suppliersListener = null;
    }

    if (this.state.supplierCreditsListener) {
      this.state.supplierCreditsListener();
      this.state.supplierCreditsListener = null;
    }

    if (this.state.settingsListener) {
      this.state.settingsListener();
      this.state.settingsListener = null;
    }

    if (this.state.stockMovementsListener) {
      this.state.stockMovementsListener();
      this.state.stockMovementsListener = null;
    }

    if (this.state.warehouseQuantitiesListener) {
      this.state.warehouseQuantitiesListener();
      this.state.warehouseQuantitiesListener = null;
    }

    if (this.state.purchasesListener) {
      this.state.purchasesListener();
      this.state.purchasesListener = null;
    }

    // Nettoyer tous les caches
    this.clearWarehouseQuantitiesCache();
    this.clearClientCreditPaymentsCache();
    this.clearSupplierCreditPaymentsCache();

    this.state.currentCompanyId = null;
  }
}

// Instance singleton
export const realtimeService = new RealtimeService();

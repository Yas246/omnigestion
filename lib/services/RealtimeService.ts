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
  productsListener: ListenerUnsubscribe | null;
  invoicesListener: ListenerUnsubscribe | null;
  clientsListener: ListenerUnsubscribe | null;
  warehousesListener: ListenerUnsubscribe | null;
  currentCompanyId: string | null;
  warehouseQuantitiesCache: Map<string, WarehouseQuantity[]>; // productId -> quantities
}

class RealtimeService {
  private state: RealtimeState = {
    productsListener: null,
    invoicesListener: null,
    clientsListener: null,
    warehousesListener: null,
    currentCompanyId: null,
    warehouseQuantitiesCache: new Map(),
  };

  /**
   * Démarre l'écoute des produits (si pas déjà démarrée)
   */
  startProductsListener(queryClient: QueryClient, companyId: string) {
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

        const currentProducts = queryClient.getQueryData<Product[]>(
          ['companies', companyId, 'products']
        ) || [];

        let updatedProducts = [...currentProducts];

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
      return {
        ...product,
        warehouseQuantities: cached,
        currentStock: cached.reduce((sum, wq) => sum + wq.quantity, 0),
      };
    }
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

        const currentInvoices = queryClient.getQueryData<Invoice[]>(
          ['companies', companyId, 'invoices', isEmployee ? 'today' : 'all']
        ) || [];

        let updatedInvoices = [...currentInvoices];

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

        const currentClients = queryClient.getQueryData<Client[]>(
          ['companies', companyId, 'clients']
        ) || [];

        let updatedClients = [...currentClients];

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

        const currentWarehouses = queryClient.getQueryData<Warehouse[]>(
          ['companies', companyId, 'warehouses']
        ) || [];

        let updatedWarehouses = [...currentWarehouses];

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
   * Arrête toutes les écoutes (changement de compagnie)
   */
  stopAllListeners() {
    console.log('[RealtimeService] 🛑 Arrêt de toutes les écoutes');

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

    // Nettoyer le cache des warehouseQuantities
    this.clearWarehouseQuantitiesCache();

    this.state.currentCompanyId = null;
  }
}

// Instance singleton
export const realtimeService = new RealtimeService();

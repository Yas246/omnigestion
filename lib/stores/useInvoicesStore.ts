import { create } from "zustand";
import { subscribeWithSelector, persist } from "zustand/middleware";
import type { Invoice } from "@/types";
import * as invoicesApi from "@/lib/firestore/invoices";
import { useAuthStore } from "./useAuthStore";

/**
 * Filtres pour les factures
 */
export interface InvoiceFilters {
  search: string | null;  // Recherche textuelle (numéro facture, client)
  clientId: string | null;
  status: string | null;
  startDate: Date | null;
  endDate: Date | null;
  minAmount: number | null;
  maxAmount: number | null;
}

/**
 * État du store factures
 */
interface InvoicesState {
  // Données
  invoices: Invoice[];

  // État de chargement
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  lastLoadedAt: number | null;

  // Pagination
  currentPage: number;
  pageSize: number;
  lastDoc: any;

  // Filtres actuels
  filters: InvoiceFilters;

  // Actions de chargement
  fetchInvoices: (
    companyId: string,
    options?: { reset?: boolean; pageSize?: number },
  ) => Promise<void>;
  loadMore: (companyId?: string) => Promise<void>;
  refreshInvoices: (companyId?: string) => Promise<void>;

  // Actions de filtres
  setSearchFilter: (search: string | null) => void;
  searchWithAutoLoad: (search: string, companyId?: string) => Promise<boolean>;
  setClientFilter: (clientId: string | null) => void;
  setStatusFilter: (status: string | null) => void;
  setDateRangeFilter: (startDate: Date | null, endDate: Date | null) => void;
  setAmountRangeFilter: (min: number | null, max: number | null) => void;
  clearFilters: () => void;

  // Optimistic updates
  optimisticCreateInvoice: (invoice: Invoice) => void;
  optimisticUpdateInvoice: (
    invoiceId: string,
    updates: Partial<Invoice>,
  ) => void;
  optimisticDeleteInvoice: (invoiceId: string) => void;

  // Synchronisation avec Firestore
  syncInvoice: (invoiceId: string) => Promise<void>;

  // Getters
  getInvoiceById: (invoiceId: string) => Invoice | undefined;
  getFilteredInvoices: () => Invoice[];
  getInvoicesByDateRange: (start: Date, end: Date) => Invoice[];
  getInvoicesByClient: (clientId: string) => Invoice[];
  clearInvoices: () => void;
}

/**
 * Store factures avec pagination, filtres et optimistic updates
 *
 * CRITIQUE: Ce store corrige le bug ligne 76 du useDashboard qui charge TOUTES les factures
 *
 * Avant: Toutes les factures chargées (500+ lectures Firestore)
 * Après: Pagination par 20 (20 lectures initiales, puis 20 par page)
 */
export const useInvoicesStore = create<InvoicesState>()(
  persist(
    subscribeWithSelector((set, get) => ({
      // État initial
      invoices: [],
      loading: false,
      error: null,
      hasMore: true,
      lastLoadedAt: null,
      currentPage: 0,
      pageSize: 20, // Pagination par défaut de 20 factures
      lastDoc: null,
      filters: {
        search: null,
        clientId: null,
        status: null,
        startDate: null,
        endDate: null,
        minAmount: null,
        maxAmount: null,
      },

      /**
       * Charger les factures depuis Firestore
       * IMPORTANT: Pagination pour éviter de charger TOUTES les factures
       */
      fetchInvoices: async (companyId, options = {}) => {
        const { reset = false, pageSize = 20 } = options;
        const { filters, currentPage, lastDoc } = get();

        if (!companyId) {
          console.error("[fetchInvoices] Aucune compagnie sélectionnée");
          return;
        }

        set({ loading: true, error: null });

        const startTime = performance.now();
        console.log("[useInvoicesStore] Début chargement factures", {
          companyId,
          page: reset ? 0 : currentPage,
          pageSize,
          filters,
        });

        try {
          const {
            data: newInvoices,
            hasMore,
            lastDoc: newLastDoc,
          } = await invoicesApi.fetchInvoices(companyId, {
            limit: pageSize,
            startAfter: reset ? undefined : lastDoc,
            orderByField: "createdAt",
            orderDirection: "desc",
            filters: {
              // Note: search filter is applied client-side in getFilteredInvoices()
              clientId: filters.clientId || undefined,
              status: filters.status || undefined,
              startDate: filters.startDate || undefined,
              endDate: filters.endDate || undefined,
              minAmount: filters.minAmount || undefined,
              maxAmount: filters.maxAmount || undefined,
            },
          });

          const endTime = performance.now();
          console.log("[useInvoicesStore] Chargement terminé", {
            count: newInvoices.length,
            hasMore,
            duration: `${(endTime - startTime).toFixed(0)}ms`,
          });

          set((state) => ({
            invoices: reset ? newInvoices : [...state.invoices, ...newInvoices],
            hasMore,
            lastDoc: newLastDoc,
            loading: false,
            lastLoadedAt: Date.now(),
            currentPage: reset ? 0 : state.currentPage + 1,
          }));
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Erreur inconnue lors du chargement";
          console.error("[useInvoicesStore] Erreur chargement:", error);

          set({
            error: errorMessage,
            loading: false,
          });
        }
      },

      /**
       * Charger plus de factures (pagination)
       */
      loadMore: async (companyId?: string) => {
        const { hasMore, loading } = get();

        if (!hasMore || loading) {
          console.log("[loadMore] Pas plus de factures ou chargement en cours");
          return;
        }

        // Utiliser le companyId passé ou celui du store
        const targetCompanyId =
          companyId || useAuthStore.getState().currentCompanyId;
        if (!targetCompanyId) {
          console.error("[loadMore] Aucune compagnie sélectionnée");
          return;
        }

        console.log("[loadMore] Chargement page suivante");
        await get().fetchInvoices(targetCompanyId, { reset: false });
      },

      /**
       * Rafraîchir toutes les factures (recharger depuis Firestore)
       */
      refreshInvoices: async (companyId?: string) => {
        console.log("[refreshInvoices] Rafraîchissement complet");
        const targetCompanyId =
          companyId || useAuthStore.getState().currentCompanyId;
        if (!targetCompanyId) {
          console.error("[refreshInvoices] Aucune compagnie sélectionnée");
          return;
        }
        await get().fetchInvoices(targetCompanyId, { reset: true });
      },

      /**
       * Filtrer par recherche textuelle (filtre local seulement)
       * NOTE: Plus de rechargement Firestore - le filtrage est côté client
       */
      setSearchFilter: (search: string | null) => {
        console.log("[setSearchFilter] Changement filtre recherche", { search });
        set({ filters: { ...get().filters, search } });
      },

      /**
       * Rechercher avec chargement automatique des pages suivantes
       * Charge plus de factures jusqu'à trouver un résultat ou épuiser toutes les pages
       */
      searchWithAutoLoad: async (search: string, companyId?: string) => {
        console.log("[searchWithAutoLoad] Début recherche auto-load", { search });

        // Définir le filtre de recherche
        set({ filters: { ...get().filters, search } });

        // Fonction récursive pour charger les pages suivantes
        const loadUntilFound = async (): Promise<boolean> => {
          const state = get();
          const filteredCount = state.getFilteredInvoices().length;

          console.log("[searchWithAutoLoad] Résultats trouvés:", filteredCount, "hasMore:", state.hasMore);

          // Si on a trouvé des résultats, arrêter
          if (filteredCount > 0) {
            console.log("[searchWithAutoLoad] ✅ Résultats trouvés, arrêt du chargement");
            return true;
          }

          // Si plus de pages à charger, arrêter
          if (!state.hasMore || state.loading) {
            console.log("[searchWithAutoLoad] ❌ Plus de pages ou chargement en cours");
            return false;
          }

          // Charger la page suivante
          const targetCompanyId = companyId || useAuthStore.getState().currentCompanyId;
          if (!targetCompanyId) {
            console.error("[searchWithAutoLoad] Aucune compagnie sélectionnée");
            return false;
          }

          console.log("[searchWithAutoLoad] 📄 Chargement page suivante...");
          await get().fetchInvoices(targetCompanyId, { reset: false });

          // Attendre un peu pour éviter les boucles trop rapides
          await new Promise(resolve => setTimeout(resolve, 300));

          // Réessayer avec les nouvelles données
          return loadUntilFound();
        };

        // Lancer le chargement automatique
        return loadUntilFound();
      },

      /**
       * Filtrer par client (filtre local, pas de rechargement)
       */
      setClientFilter: (clientId) => {
        console.log("[setClientFilter] Changement filtre client", { clientId });
        set((state) => ({
          filters: { ...state.filters, clientId },
        }));
      },

      /**
       * Filtrer par statut (filtre local)
       */
      setStatusFilter: (status) => {
        console.log("[setStatusFilter] Changement filtre statut", { status });
        set((state) => ({
          filters: { ...state.filters, status },
        }));
      },

      /**
       * Filtrer par plage de dates (filtre local)
       */
      setDateRangeFilter: (startDate, endDate) => {
        console.log("[setDateRangeFilter] Changement filtre dates", {
          startDate,
          endDate,
        });
        set((state) => ({
          filters: { ...state.filters, startDate, endDate },
        }));
      },

      /**
       * Filtrer par plage de montants (filtre local)
       */
      setAmountRangeFilter: (min, max) => {
        console.log("[setAmountRangeFilter] Changement filtre montants", {
          min,
          max,
        });
        set((state) => ({
          filters: { ...state.filters, minAmount: min, maxAmount: max },
        }));
      },

      /**
       * Effacer tous les filtres
       */
      clearFilters: () => {
        console.log("[clearFilters] Effacement filtres");
        set((state) => ({
          filters: {
            search: null,
            clientId: null,
            status: null,
            startDate: null,
            endDate: null,
            minAmount: null,
            maxAmount: null,
          },
        }));
      },

      /**
       * Optimistic CREATE - Ajouter une facture immédiatement
       */
      optimisticCreateInvoice: (invoice) => {
        console.log("[optimisticCreateInvoice] Ajout facture optimiste", {
          invoiceId: invoice.id,
        });
        set((state) => ({
          invoices: [invoice, ...state.invoices],
        }));
      },

      /**
       * Optimistic UPDATE - Mettre à jour une facture immédiatement
       */
      optimisticUpdateInvoice: (invoiceId, updates) => {
        console.log("[optimisticUpdateInvoice] Mise à jour optimiste", {
          invoiceId,
          updates,
        });
        set((state) => ({
          invoices: state.invoices.map((i) =>
            i.id === invoiceId ? { ...i, ...updates } : i,
          ),
        }));
      },

      /**
       * Optimistic DELETE - Supprimer une facture immédiatement
       */
      optimisticDeleteInvoice: (invoiceId) => {
        console.log("[optimisticDeleteInvoice] Suppression optimiste", {
          invoiceId,
        });
        set((state) => ({
          invoices: state.invoices.filter((i) => i.id !== invoiceId),
        }));
      },

      /**
       * Synchroniser une facture avec Firestore (après optimistic update)
       */
      syncInvoice: async (invoiceId) => {
        const companyId = useAuthStore.getState().currentCompanyId;
        if (!companyId) {
          console.error("[syncInvoice] Aucune compagnie sélectionnée");
          return;
        }

        console.log("[syncInvoice] Synchronisation facture", { invoiceId });

        try {
          const invoice = await invoicesApi.fetchInvoice(companyId, invoiceId);

          if (invoice) {
            set((state) => ({
              invoices: state.invoices.map((i) =>
                i.id === invoiceId ? invoice : i,
              ),
            }));
            console.log("[syncInvoice] Facture synchronisée", { invoiceId });
          } else {
            // Facture supprimée, la retirer du store
            set((state) => ({
              invoices: state.invoices.filter((i) => i.id !== invoiceId),
            }));
            console.log("[syncInvoice] Facture retirée (supprimée)", {
              invoiceId,
            });
          }
        } catch (error) {
          console.error("[syncInvoice] Erreur synchronisation:", error);
        }
      },

      /**
       * Récupérer une facture par ID
       */
      getInvoiceById: (invoiceId) => {
        return get().invoices.find((i) => i.id === invoiceId);
      },

      /**
       * Récupérer les factures filtrées (filtres locaux)
       */
      getFilteredInvoices: () => {
        const { invoices, filters } = get();
        let filtered: Invoice[] = [...invoices];

        // Filtre par recherche textuelle (numéro facture, nom client)
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filtered = filtered.filter((i) =>
            i.invoiceNumber.toLowerCase().includes(searchLower) ||
            (i.clientName && i.clientName.toLowerCase().includes(searchLower))
          );
        }

        // Filtre par client
        if (filters.clientId) {
          filtered = filtered.filter((i) => i.clientId === filters.clientId);
        }

        // Filtre par statut
        if (filters.status) {
          filtered = filtered.filter((i) => i.status === filters.status);
        }

        // Helper pour convertir createdAt en Date
        const getDate = (invoice: Invoice): Date => {
          const createdAt = invoice.createdAt;
          if (createdAt instanceof Date) {
            return createdAt;
          }
          // Cast pour Timestamp Firebase qui a une méthode toDate()
          return (createdAt as any).toDate();
        };

        // Filtre par plage de dates
        if (filters.startDate) {
          filtered = filtered.filter(
            (invoice: Invoice) => getDate(invoice) >= filters.startDate!,
          );
        }

        if (filters.endDate) {
          filtered = filtered.filter(
            (invoice: Invoice) => getDate(invoice) <= filters.endDate!,
          );
        }

        // Filtre par plage de montants
        if (filters.minAmount !== null) {
          filtered = filtered.filter((i) => i.total >= filters.minAmount!);
        }
        if (filters.maxAmount !== null) {
          filtered = filtered.filter((i) => i.total <= filters.maxAmount!);
        }

        return filtered;
      },

      /**
       * Récupérer les factures pour une plage de dates
       */
      getInvoicesByDateRange: (start, end) => {
        const { invoices } = get();
        const getDate = (invoice: Invoice): Date => {
          const createdAt = invoice.createdAt;
          if (createdAt instanceof Date) {
            return createdAt;
          }
          // Cast pour Timestamp Firebase qui a une méthode toDate()
          return (createdAt as any).toDate();
        };
        return invoices.filter((invoice: Invoice) => {
          const date = getDate(invoice);
          return date >= start && date <= end;
        });
      },

      /**
       * Récupérer les factures d'un client
       */
      getInvoicesByClient: (clientId) => {
        const { invoices } = get();
        return invoices.filter((i) => i.clientId === clientId);
      },

      /**
       * Vider toutes les factures (déconnexion)
       */
      clearInvoices: () => {
        console.log("[clearInvoices] Vidage du store");
        set({
          invoices: [],
          hasMore: true,
          lastLoadedAt: null,
          currentPage: 0,
          lastDoc: null,
        });
      },
    })),
    {
      name: "invoices-storage",
      partialize: (state) => ({
        invoices: state.invoices,
        lastLoadedAt: state.lastLoadedAt,
      }),
    },
  ),
);

/**
 * Sélecteurs dérivés optimisés
 */
export const selectInvoices = () =>
  useInvoicesStore.getState().getFilteredInvoices();
export const selectInvoiceById = (invoiceId: string) =>
  useInvoicesStore.getState().getInvoiceById(invoiceId);

/**
 * Hooks pour utiliser le store avec des sélecteurs optimisés
 * NOTE: On utilise les factures brutes et on laisse le composant faire le filtrage
 * pour éviter les boucles infinies de re-render
 */
export const useInvoices = () => useInvoicesStore((state) => state.invoices);
export const useInvoicesLoading = () =>
  useInvoicesStore((state) => state.loading);
export const useInvoicesError = () => useInvoicesStore((state) => state.error);
export const useInvoicesHasMore = () =>
  useInvoicesStore((state) => state.hasMore);
// NOTE: useInvoicesFilters supprimé car il cause des boucles infinies (objet qui change)

// Hook pour accéder à tout le store (actions + getters)
export const useInvoicesStoreState = useInvoicesStore;

export default useInvoicesStore;

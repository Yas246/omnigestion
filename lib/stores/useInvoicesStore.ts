import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Invoice } from '@/types';
import * as invoicesApi from '@/lib/firestore/invoices';
import { useAuthStore } from './useAuthStore';

/**
 * Filtres pour les factures
 */
export interface InvoiceFilters {
  clientId: string | null;
  paymentStatus: string | null;
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
  fetchInvoices: (options?: { reset?: boolean; pageSize?: number }) => Promise<void>;
  loadMore: () => Promise<void>;
  refreshInvoices: () => Promise<void>;

  // Actions de filtres
  setClientFilter: (clientId: string | null) => void;
  setPaymentStatusFilter: (status: string | null) => void;
  setDateRangeFilter: (startDate: Date | null, endDate: Date | null) => void;
  setAmountRangeFilter: (min: number | null, max: number | null) => void;
  clearFilters: () => void;

  // Optimistic updates
  optimisticCreateInvoice: (invoice: Invoice) => void;
  optimisticUpdateInvoice: (invoiceId: string, updates: Partial<Invoice>) => void;
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
      clientId: null,
      paymentStatus: null,
      startDate: null,
      endDate: null,
      minAmount: null,
      maxAmount: null,
    },

    /**
     * Charger les factures depuis Firestore
     * IMPORTANT: Pagination pour éviter de charger TOUTES les factures
     */
    fetchInvoices: async (options = {}) => {
      const { reset = false, pageSize = 20 } = options;
      const { filters, currentPage, lastDoc } = get();
      const companyId = useAuthStore.getState().currentCompanyId;

      if (!companyId) {
        console.error('[fetchInvoices] Aucune compagnie sélectionnée');
        return;
      }

      set({ loading: true, error: null });

      const startTime = performance.now();
      console.log('[useInvoicesStore] Début chargement factures', {
        companyId,
        page: reset ? 0 : currentPage,
        pageSize,
        filters,
      });

      try {
        const { data: newInvoices, hasMore, lastDoc: newLastDoc } =
          await invoicesApi.fetchInvoices(companyId, {
            limit: pageSize,
            startAfter: reset ? undefined : lastDoc,
            orderByField: 'createdAt',
            orderDirection: 'desc',
            filters: {
              clientId: filters.clientId || undefined,
              paymentStatus: filters.paymentStatus || undefined,
              startDate: filters.startDate || undefined,
              endDate: filters.endDate || undefined,
              minAmount: filters.minAmount || undefined,
              maxAmount: filters.maxAmount || undefined,
            },
          });

        const endTime = performance.now();
        console.log('[useInvoicesStore] Chargement terminé', {
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
          error instanceof Error ? error.message : 'Erreur inconnue lors du chargement';
        console.error('[useInvoicesStore] Erreur chargement:', error);

        set({
          error: errorMessage,
          loading: false,
        });
      }
    },

    /**
     * Charger plus de factures (pagination)
     */
    loadMore: async () => {
      const { hasMore, loading } = get();

      if (!hasMore || loading) {
        console.log('[loadMore] Pas plus de factures ou chargement en cours');
        return;
      }

      console.log('[loadMore] Chargement page suivante');
      await get().fetchInvoices({ reset: false });
    },

    /**
     * Rafraîchir toutes les factures (recharger depuis Firestore)
     */
    refreshInvoices: async () => {
      console.log('[refreshInvoices] Rafraîchissement complet');
      await get().fetchInvoices({ reset: true });
    },

    /**
     * Filtrer par client (filtre local, pas de rechargement)
     */
    setClientFilter: (clientId) => {
      console.log('[setClientFilter] Changement filtre client', { clientId });
      set((state) => ({
        filters: { ...state.filters, clientId },
      }));
    },

    /**
     * Filtrer par statut de paiement (filtre local)
     */
    setPaymentStatusFilter: (status) => {
      console.log('[setPaymentStatusFilter] Changement filtre statut', { status });
      set((state) => ({
        filters: { ...state.filters, paymentStatus: status },
      }));
    },

    /**
     * Filtrer par plage de dates (filtre local)
     */
    setDateRangeFilter: (startDate, endDate) => {
      console.log('[setDateRangeFilter] Changement filtre dates', { startDate, endDate });
      set((state) => ({
        filters: { ...state.filters, startDate, endDate },
      }));
    },

    /**
     * Filtrer par plage de montants (filtre local)
     */
    setAmountRangeFilter: (min, max) => {
      console.log('[setAmountRangeFilter] Changement filtre montants', { min, max });
      set((state) => ({
        filters: { ...state.filters, minAmount: min, maxAmount: max },
      }));
    },

    /**
     * Effacer tous les filtres
     */
    clearFilters: () => {
      console.log('[clearFilters] Effacement filtres');
      set((state) => ({
        filters: {
          clientId: null,
          paymentStatus: null,
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
      console.log('[optimisticCreateInvoice] Ajout facture optimiste', {
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
      console.log('[optimisticUpdateInvoice] Mise à jour optimiste', { invoiceId, updates });
      set((state) => ({
        invoices: state.invoices.map((i) => (i.id === invoiceId ? { ...i, ...updates } : i)),
      }));
    },

    /**
     * Optimistic DELETE - Supprimer une facture immédiatement
     */
    optimisticDeleteInvoice: (invoiceId) => {
      console.log('[optimisticDeleteInvoice] Suppression optimiste', { invoiceId });
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
        console.error('[syncInvoice] Aucune compagnie sélectionnée');
        return;
      }

      console.log('[syncInvoice] Synchronisation facture', { invoiceId });

      try {
        const invoice = await invoicesApi.fetchInvoice(companyId, invoiceId);

        if (invoice) {
          set((state) => ({
            invoices: state.invoices.map((i) => (i.id === invoiceId ? invoice : i)),
          }));
          console.log('[syncInvoice] Facture synchronisée', { invoiceId });
        } else {
          // Facture supprimée, la retirer du store
          set((state) => ({
            invoices: state.invoices.filter((i) => i.id !== invoiceId),
          }));
          console.log('[syncInvoice] Facture retirée (supprimée)', { invoiceId });
        }
      } catch (error) {
        console.error('[syncInvoice] Erreur synchronisation:', error);
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
      let filtered = [...invoices];

      // Filtre par client
      if (filters.clientId) {
        filtered = filtered.filter((i) => i.clientId === filters.clientId);
      }

      // Filtre par statut de paiement
      if (filters.paymentStatus) {
        filtered = filtered.filter((i) => i.paymentStatus === filters.paymentStatus);
      }

      // Filtre par plage de dates
      if (filters.startDate) {
        filtered = filtered.filter((i) => {
          const date = i.createdAt instanceof Date ? i.createdAt : i.createdAt.toDate();
          return date >= filters.startDate!;
        });
      }

      if (filters.endDate) {
        filtered = filtered.filter((i) => {
          const date = i.createdAt instanceof Date ? i.createdAt : i.createdAt.toDate();
          return date <= filters.endDate!;
        });
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
      return invoices.filter((i) => {
        const date = i.createdAt instanceof Date ? i.createdAt : i.createdAt.toDate();
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
      console.log('[clearInvoices] Vidage du store');
      set({
        invoices: [],
        hasMore: true,
        lastLoadedAt: null,
        currentPage: 0,
        lastDoc: null,
      });
    },
  }))
);

/**
 * Sélecteurs dérivés optimisés
 */
export const selectInvoices = () => useInvoicesStore.getState().getFilteredInvoices();
export const selectInvoiceById = (invoiceId: string) =>
  useInvoicesStore.getState().getInvoiceById(invoiceId);

/**
 * Hooks pour utiliser le store avec des sélecteurs optimisés
 */
export const useInvoices = () => useInvoicesStore((state) => state.getFilteredInvoices());
export const useInvoicesLoading = () => useInvoicesStore((state) => state.loading);
export const useInvoicesError = () => useInvoicesStore((state) => state.error);
export const useInvoicesHasMore = () => useInvoicesStore((state) => state.hasMore);
export const useInvoicesFilters = () => useInvoicesStore((state) => state.filters);
export const useInvoicesActions = () =>
  useInvoicesStore((state) => ({
    fetchInvoices: state.fetchInvoices,
    loadMore: state.loadMore,
    refreshInvoices: state.refreshInvoices,
    setClientFilter: state.setClientFilter,
    setPaymentStatusFilter: state.setPaymentStatusFilter,
    setDateRangeFilter: state.setDateRangeFilter,
    setAmountRangeFilter: state.setAmountRangeFilter,
    clearFilters: state.clearFilters,
    optimisticCreateInvoice: state.optimisticCreateInvoice,
    optimisticUpdateInvoice: state.optimisticUpdateInvoice,
    optimisticDeleteInvoice: state.optimisticDeleteInvoice,
    syncInvoice: state.syncInvoice,
    getInvoiceById: state.getInvoiceById,
    getInvoicesByDateRange: state.getInvoicesByDateRange,
    getInvoicesByClient: state.getInvoicesByClient,
    clearInvoices: state.clearInvoices,
  }));

export default useInvoicesStore;

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Client } from '@/types';
import * as clientsApi from '@/lib/firestore/clients';
import { useAuthStore } from './useAuthStore';

/**
 * Filtres pour les clients
 */
export interface ClientFilters {
  search: string;
  city: string | null;
  country: string | null;
  minBalance: number | null;
  maxBalance: number | null;
}

/**
 * État du store clients
 */
interface ClientsState {
  // Données
  clients: Client[];

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
  filters: ClientFilters;

  // Actions de chargement
  fetchClients: (options?: { reset?: boolean; pageSize?: number }) => Promise<void>;
  loadMore: () => Promise<void>;
  refreshClients: () => Promise<void>;

  // Actions de filtres
  setSearchQuery: (query: string) => void;
  setCityFilter: (city: string | null) => void;
  setCountryFilter: (country: string | null) => void;
  setBalanceRangeFilter: (min: number | null, max: number | null) => void;
  clearFilters: () => void;

  // Recherche
  searchClients: (query: string) => Promise<Client[]>;

  // Optimistic updates
  optimisticCreateClient: (client: Client) => void;
  optimisticUpdateClient: (clientId: string, updates: Partial<Client>) => void;
  optimisticDeleteClient: (clientId: string) => void;

  // Synchronisation avec Firestore
  syncClient: (clientId: string) => Promise<void>;

  // Getters
  getClientById: (clientId: string) => Client | undefined;
  getFilteredClients: () => Client[];
  getClientsByCity: (city: string) => Client[];
  clearClients: () => void;
}

/**
 * Store clients avec pagination, filtres et optimistic updates
 */
export const useClientsStore = create<ClientsState>()(
  subscribeWithSelector((set, get) => ({
    // État initial
    clients: [],
    loading: false,
    error: null,
    hasMore: true,
    lastLoadedAt: null,
    currentPage: 0,
    pageSize: 50,
    lastDoc: null,
    filters: {
      search: '',
      city: null,
      country: null,
      minBalance: null,
      maxBalance: null,
    },

    /**
     * Charger les clients depuis Firestore
     */
    fetchClients: async (options = {}) => {
      const { reset = false, pageSize = 50 } = options;
      const { filters, currentPage, lastDoc } = get();
      const companyId = useAuthStore.getState().currentCompanyId;

      if (!companyId) {
        console.error('[fetchClients] Aucune compagnie sélectionnée');
        return;
      }

      set({ loading: true, error: null });

      const startTime = performance.now();
      console.log('[useClientsStore] Début chargement clients', {
        companyId,
        page: reset ? 0 : currentPage,
        pageSize,
        filters,
      });

      try {
        const { data: newClients, hasMore, lastDoc: newLastDoc } =
          await clientsApi.fetchClients(companyId, {
            limit: pageSize,
            startAfter: reset ? undefined : lastDoc,
            orderByField: 'name',
            orderDirection: 'asc',
            filters: {
              city: filters.city || undefined,
              country: filters.country || undefined,
            },
          });

        const endTime = performance.now();
        console.log('[useClientsStore] Chargement terminé', {
          count: newClients.length,
          hasMore,
          duration: `${(endTime - startTime).toFixed(0)}ms`,
        });

        set((state) => ({
          clients: reset ? newClients : [...state.clients, ...newClients],
          hasMore,
          lastDoc: newLastDoc,
          loading: false,
          lastLoadedAt: Date.now(),
          currentPage: reset ? 0 : state.currentPage + 1,
        }));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Erreur inconnue lors du chargement';
        console.error('[useClientsStore] Erreur chargement:', error);

        set({
          error: errorMessage,
          loading: false,
        });
      }
    },

    /**
     * Charger plus de clients (pagination)
     */
    loadMore: async () => {
      const { hasMore, loading } = get();

      if (!hasMore || loading) {
        console.log('[loadMore] Pas plus de clients ou chargement en cours');
        return;
      }

      console.log('[loadMore] Chargement page suivante');
      await get().fetchClients({ reset: false });
    },

    /**
     * Rafraîchir tous les clients (recharger depuis Firestore)
     */
    refreshClients: async () => {
      console.log('[refreshClients] Rafraîchissement complet');
      await get().fetchClients({ reset: true });
    },

    /**
     * Rechercher des clients (filtre local)
     */
    setSearchQuery: (query) => {
      console.log('[setSearchQuery] Changement recherche', { query });
      set((state) => ({
        filters: { ...state.filters, search: query },
      }));
    },

    /**
     * Filtrer par ville (filtre local)
     */
    setCityFilter: (city) => {
      console.log('[setCityFilter] Changement filtre ville', { city });
      set((state) => ({
        filters: { ...state.filters, city },
      }));
    },

    /**
     * Filtrer par pays (filtre local)
     */
    setCountryFilter: (country) => {
      console.log('[setCountryFilter] Changement filtre pays', { country });
      set((state) => ({
        filters: { ...state.filters, country },
      }));
    },

    /**
     * Filtrer par plage de solde (filtre local)
     */
    setBalanceRangeFilter: (min, max) => {
      console.log('[setBalanceRangeFilter] Changement filtre solde', { min, max });
      set((state) => ({
        filters: { ...state.filters, minBalance: min, maxBalance: max },
      }));
    },

    /**
     * Effacer tous les filtres
     */
    clearFilters: () => {
      console.log('[clearFilters] Effacement filtres');
      set((state) => ({
        filters: {
          search: '',
          city: null,
          country: null,
          minBalance: null,
          maxBalance: null,
        },
      }));
    },

    /**
     * Rechercher des clients par nom ou email
     * Note: Utilise une requête Firestore spécifique (recherche par préfixe)
     */
    searchClients: async (query) => {
      const companyId = useAuthStore.getState().currentCompanyId;
      if (!companyId) {
        console.error('[searchClients] Aucune compagnie sélectionnée');
        return [];
      }

      console.log('[searchClients] Recherche Firestore', { query });
      return clientsApi.searchClients(companyId, query);
    },

    /**
     * Optimistic CREATE - Ajouter un client immédiatement
     */
    optimisticCreateClient: (client) => {
      console.log('[optimisticCreateClient] Ajout client optimiste', { clientId: client.id });
      set((state) => ({
        clients: [client, ...state.clients],
      }));
    },

    /**
     * Optimistic UPDATE - Mettre à jour un client immédiatement
     */
    optimisticUpdateClient: (clientId, updates) => {
      console.log('[optimisticUpdateClient] Mise à jour optimiste', { clientId, updates });
      set((state) => ({
        clients: state.clients.map((c) => (c.id === clientId ? { ...c, ...updates } : c)),
      }));
    },

    /**
     * Optimistic DELETE - Supprimer un client immédiatement
     */
    optimisticDeleteClient: (clientId) => {
      console.log('[optimisticDeleteClient] Suppression optimiste', { clientId });
      set((state) => ({
        clients: state.clients.filter((c) => c.id !== clientId),
      }));
    },

    /**
     * Synchroniser un client avec Firestore (après optimistic update)
     */
    syncClient: async (clientId) => {
      const companyId = useAuthStore.getState().currentCompanyId;
      if (!companyId) {
        console.error('[syncClient] Aucune compagnie sélectionnée');
        return;
      }

      console.log('[syncClient] Synchronisation client', { clientId });

      try {
        const client = await clientsApi.fetchClient(companyId, clientId);

        if (client) {
          set((state) => ({
            clients: state.clients.map((c) => (c.id === clientId ? client : c)),
          }));
          console.log('[syncClient] Client synchronisé', { clientId });
        } else {
          // Client supprimé, le retirer du store
          set((state) => ({
            clients: state.clients.filter((c) => c.id !== clientId),
          }));
          console.log('[syncClient] Client retiré (supprimé)', { clientId });
        }
      } catch (error) {
        console.error('[syncClient] Erreur synchronisation:', error);
      }
    },

    /**
     * Récupérer un client par ID
     */
    getClientById: (clientId) => {
      return get().clients.find((c) => c.id === clientId);
    },

    /**
     * Récupérer les clients filtrés (filtres locaux)
     */
    getFilteredClients: () => {
      const { clients, filters } = get();
      let filtered = [...clients];

      // Filtre par recherche (nom ou email)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.name.toLowerCase().includes(searchLower) ||
            c.email?.toLowerCase().includes(searchLower)
        );
      }

      // Filtre par ville
      if (filters.city) {
        filtered = filtered.filter((c) => c.city === filters.city);
      }

      // Filtre par pays
      if (filters.country) {
        filtered = filtered.filter((c) => c.country === filters.country);
      }

      // Filtre par plage de solde
      if (filters.minBalance !== null) {
        filtered = filtered.filter((c) => (c.currentBalance || 0) >= filters.minBalance!);
      }
      if (filters.maxBalance !== null) {
        filtered = filtered.filter((c) => (c.currentBalance || 0) <= filters.maxBalance!);
      }

      return filtered;
    },

    /**
     * Récupérer les clients d'une ville
     */
    getClientsByCity: (city) => {
      const { clients } = get();
      return clients.filter((c) => c.city === city);
    },

    /**
     * Vider tous les clients (déconnexion)
     */
    clearClients: () => {
      console.log('[clearClients] Vidage du store');
      set({
        clients: [],
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
export const selectClients = () => useClientsStore.getState().getFilteredClients();
export const selectClientById = (clientId: string) =>
  useClientsStore.getState().getClientById(clientId);

/**
 * Hooks pour utiliser le store avec des sélecteurs optimisés
 */
export const useClients = () => useClientsStore((state) => state.getFilteredClients());
export const useClientsLoading = () => useClientsStore((state) => state.loading);
export const useClientsError = () => useClientsStore((state) => state.error);
export const useClientsHasMore = () => useClientsStore((state) => state.hasMore);
export const useClientsFilters = () => useClientsStore((state) => state.filters);
export const useClientsActions = () =>
  useClientsStore((state) => ({
    fetchClients: state.fetchClients,
    loadMore: state.loadMore,
    refreshClients: state.refreshClients,
    setSearchQuery: state.setSearchQuery,
    setCityFilter: state.setCityFilter,
    setCountryFilter: state.setCountryFilter,
    setBalanceRangeFilter: state.setBalanceRangeFilter,
    clearFilters: state.clearFilters,
    searchClients: state.searchClients,
    optimisticCreateClient: state.optimisticCreateClient,
    optimisticUpdateClient: state.optimisticUpdateClient,
    optimisticDeleteClient: state.optimisticDeleteClient,
    syncClient: state.syncClient,
    getClientById: state.getClientById,
    clearClients: state.clearClients,
  }));

export default useClientsStore;

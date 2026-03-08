import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Company } from '@/types';

/**
 * État d'authentification global
 *
 * Gère :
 * - L'utilisateur connecté
 * - La compagnie courante
 * - La liste des compagnies de l'utilisateur
 * - Le rôle et les permissions
 */
interface AuthState {
  // Données utilisateur
  user: User | null;
  currentCompanyId: string | null;
  companies: Company[];

  // État de chargement
  loading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setCurrentCompany: (companyId: string) => void;
  updateUserProfile: (updates: Partial<User>) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Getters
  isAdmin: () => boolean;
  isEmployee: () => boolean;
  getCurrentCompany: () => Company | null;
  hasPermission: (permission: string) => boolean;
}

/**
 * Store d'authentification avec persistance localStorage
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // État initial
      user: null,
      currentCompanyId: null,
      companies: [],
      loading: false,
      error: null,

      /**
       * Définir l'utilisateur connecté
       */
      setUser: (user) => {
        set({
          user,
          currentCompanyId: user?.currentCompanyId || null,
          companies: user?.companies || [],
        });
      },

      /**
       * Changer la compagnie courante
       */
      setCurrentCompany: (companyId) => {
        const { user } = get();

        if (!user) {
          console.error('[setCurrentCompany] Aucun utilisateur connecté');
          return;
        }

        // Vérifier que l'utilisateur a accès à cette compagnie
        const hasAccess = user.companies?.some((c) => c.id === companyId);
        if (!hasAccess) {
          console.error('[setCurrentCompany] Accès refusé à la compagnie', { companyId });
          return;
        }

        set({ currentCompanyId: companyId });

        // Mettre à jour user.currentCompanyId pour persister dans Firestore
        // (sera mis à jour au prochain appel API)
        console.log('[setCurrentCompany] Compagne changée', { companyId });
      },

      /**
       * Mettre à jour le profil utilisateur
       */
      updateUserProfile: (updates) => {
        const { user } = get();

        if (!user) {
          console.error('[updateUserProfile] Aucun utilisateur connecté');
          return;
        }

        set({
          user: {
            ...user,
            ...updates,
          },
        });
      },

      /**
       * Déconnexion
       */
      logout: () => {
        set({
          user: null,
          currentCompanyId: null,
          companies: [],
          loading: false,
          error: null,
        });
      },

      /**
       * Définir l'état de chargement
       */
      setLoading: (loading) => {
        set({ loading });
      },

      /**
       * Définir une erreur
       */
      setError: (error) => {
        set({ error });
      },

      /**
       * Effacer l'erreur
       */
      clearError: () => {
        set({ error: null });
      },

      /**
       * Vérifier si l'utilisateur est admin
       */
      isAdmin: () => {
        const { user } = get();
        return user?.role === 'admin';
      },

      /**
       * Vérifier si l'utilisateur est employé
       */
      isEmployee: () => {
        const { user } = get();
        return user?.role === 'employee';
      },

      /**
       * Récupérer la compagnie courante
       */
      getCurrentCompany: () => {
        const { companies, currentCompanyId } = get();
        return companies.find((c) => c.id === currentCompanyId) || null;
      },

      /**
       * Vérifier si l'utilisateur a une permission spécifique
       */
      hasPermission: (permission) => {
        const { user } = get();

        // Les admins ont toutes les permissions
        if (user?.role === 'admin') {
          return true;
        }

        // Les employés ont des permissions limitées
        if (user?.role === 'employee') {
          const employeePermissions = [
            'create_invoice',
            'view_products',
            'view_stock',
            'create_sale',
          ];
          return employeePermissions.includes(permission);
        }

        return false;
      },
    }),
    {
      name: 'auth-storage', // Clé localStorage
      storage: createJSONStorage(() => localStorage),
      // Persister seulement certains champs
      partialize: (state) => ({
        user: state.user,
        currentCompanyId: state.currentCompanyId,
        companies: state.companies,
      }),
    }
  )
);

/**
 * Sélecteurs dérivés pour éviter les re-renders inutiles
 */
export const selectUser = () => useAuthStore.getState().user;
export const selectCurrentCompanyId = () => useAuthStore.getState().currentCompanyId;
export const selectCurrentCompany = () => useAuthStore.getState().getCurrentCompany();
export const selectIsAdmin = () => useAuthStore.getState().isAdmin();
export const selectIsEmployee = () => useAuthStore.getState().isEmployee();

/**
 * Hook pour utiliser le store avec des sélecteurs optimisés
 */
export const useAuthUser = () => useAuthStore((state) => state.user);
export const useAuthCompanyId = () => useAuthStore((state) => state.currentCompanyId);
export const useAuthCompany = () => useAuthStore((state) => state.getCurrentCompany());
export const useAuthIsAdmin = () => useAuthStore((state) => state.isAdmin());
export const useAuthIsEmployee = () => useAuthStore((state) => state.isEmployee());
export const useAuthLoading = () => useAuthStore((state) => state.loading);
export const useAuthError = () => useAuthStore((state) => state.error);

export default useAuthStore;

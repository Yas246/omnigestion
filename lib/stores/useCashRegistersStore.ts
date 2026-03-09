import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  runTransaction,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase';
import { useAuthStore } from './useAuthStore';
import type { CashRegister, CashMovement } from '@/types';

/**
 * État du store caisses
 */
interface CashStoreState {
  // Données métier
  cashRegisters: CashRegister[];
  movements: CashMovement[];

  // Soldes calculés et mis à jour automatiquement
  balances: Record<string, number>; // cashRegisterId -> currentBalance

  // ID de la compagnie courante
  currentCompanyId: string | null;

  // État de chargement
  loading: boolean;
  error: string | null;

  // Pagination pour les mouvements
  hasMore: boolean;
  lastDoc: any;
  pageSize: number;

  // Filtres
  selectedCashRegisterId: string | null;

  // Statistiques du jour
  todayStats: {
    todayIn: number;
    todayOut: number;
  };
}

/**
 * Actions du store
 */
interface CashStoreActions {
  // Initialisation
  initialize: (companyId: string) => Promise<void>;

  // Caisses
  fetchCashRegisters: (companyId: string) => Promise<void>;
  createCashRegister: (data: Omit<CashRegister, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateCashRegister: (id: string, data: Partial<CashRegister>) => Promise<void>;
  deleteCashRegister: (id: string) => Promise<void>;

  // Mouvements avec mise à jour automatique des soldes
  fetchMovements: (cashRegisterId?: string, reset?: boolean) => Promise<void>;
  loadMoreMovements: () => Promise<void>;
  createMovement: (movement: Omit<CashMovement, 'id' | 'companyId' | 'createdAt'>, companyId?: string) => Promise<string>;
  deleteMovement: (id: string) => Promise<void>;

  // Gestion des soldes
  refreshBalances: (forceRecalculate?: boolean, companyId?: string) => Promise<void>;

  // Statistiques
  fetchTodayStats: () => Promise<void>;

  // Reset
  reset: () => void;

  // Getters
  getCashRegisterById: (id: string) => CashRegister | undefined;
  getBalance: (cashRegisterId: string) => number;
  getTotalBalance: () => number;
  getFilteredMovements: () => CashMovement[];
}

type CashStore = CashStoreState & CashStoreActions;

/**
 * Store Zustand pour les caisses avec persist et optimistic updates
 *
 * Ce store résout les problèmes de performance O(n) du calcul de balance
 * en maintenant un état local synchronisé avec Firebase.
 */
export const useCashRegistersStore = create<CashStore>()(
  persist(
    subscribeWithSelector((set, get) => ({
      // État initial
      cashRegisters: [],
      movements: [],
      balances: {},
      currentCompanyId: null,
      loading: false,
      error: null,
      hasMore: false,
      lastDoc: null,
      pageSize: 50,
      selectedCashRegisterId: null,
      todayStats: { todayIn: 0, todayOut: 0 },

      /**
       * Initialisation du store
       */
      initialize: async (companyId: string) => {
        console.log('[useCashRegistersStore] Initialisation', { companyId });
        set({ loading: true, error: null, currentCompanyId: companyId });
        try {
          await get().fetchCashRegisters(companyId);
          await get().fetchTodayStats();
        } catch (error) {
          set({ error: (error as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      /**
       * Récupérer les caisses depuis Firestore
       */
      fetchCashRegisters: async (companyId: string) => {
        console.log('[fetchCashRegisters] Chargement des caisses', { companyId });
        set({ loading: true, error: null });
        try {
          const q = query(
            collection(db, COLLECTIONS.companyCashRegisters(companyId)),
            orderBy('createdAt', 'desc')
          );
          const snapshot = await getDocs(q);
          const cashRegisters = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          })) as CashRegister[];

          console.log('[fetchCashRegisters] Caisses chargées', { count: cashRegisters.length });

          // Mettre à jour les balances depuis les currentBalance de Firestore
          const balances: Record<string, number> = {};
          cashRegisters.forEach((cr) => {
            balances[cr.id] = cr.currentBalance || 0;
          });

          set({ cashRegisters, balances });
        } catch (error) {
          console.error('[fetchCashRegisters] Erreur:', error);
          set({ error: (error as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      /**
       * Récupérer les mouvements avec pagination
       */
      fetchMovements: async (cashRegisterId?: string, reset = false) => {
        const companyId = get().currentCompanyId;
        if (!companyId) {
          console.error('[fetchMovements] Aucune compagnie sélectionnée');
          return;
        }

        // Utiliser la caisse sélectionnée ou la première par défaut
        let targetCashRegisterId = cashRegisterId;
        if (!targetCashRegisterId && get().cashRegisters.length > 0) {
          targetCashRegisterId = get().cashRegisters[0].id;
        }

        if (!targetCashRegisterId) {
          console.log('[fetchMovements] Aucune caisse disponible');
          set({ movements: [], hasMore: false, lastDoc: null });
          return;
        }

        console.log('[fetchMovements] Chargement des mouvements', {
          cashRegisterId: targetCashRegisterId,
          reset,
        });

        set({ loading: true, error: null });

        try {
          const movementsRef = collection(db, COLLECTIONS.companyCashMovements(companyId));

          let q = query(
            movementsRef,
            where('cashRegisterId', '==', targetCashRegisterId),
            orderBy('createdAt', 'desc'),
            limit(get().pageSize)
          );

          // Pagination : charger la page suivante
          if (!reset && get().lastDoc) {
            q = query(
              movementsRef,
              where('cashRegisterId', '==', targetCashRegisterId),
              orderBy('createdAt', 'desc'),
              startAfter(get().lastDoc),
              limit(get().pageSize)
            );
          }

          const snapshot = await getDocs(q);
          const movements = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
          })) as CashMovement[];

          const hasMore = snapshot.docs.length === get().pageSize;
          const lastDoc = snapshot.docs[snapshot.docs.length - 1];

          console.log('[fetchMovements] Mouvements chargés', {
            count: movements.length,
            hasMore,
          });

          set((state) => ({
            movements: reset ? movements : [...state.movements, ...movements],
            hasMore,
            lastDoc,
            selectedCashRegisterId: targetCashRegisterId || null,
          }));

          // Mettre à jour les stats du jour
          await get().fetchTodayStats();
        } catch (error) {
          console.error('[fetchMovements] Erreur:', error);
          set({ error: (error as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      /**
       * Charger plus de mouvements (pagination)
       */
      loadMoreMovements: async () => {
        const { hasMore, loading } = get();
        if (!hasMore || loading) {
          console.log('[loadMoreMovements] Pas plus de mouvements ou chargement en cours');
          return;
        }

        console.log('[loadMoreMovements] Chargement page suivante');
        await get().fetchMovements(get().selectedCashRegisterId || undefined, false);
      },

      /**
       * Créer un mouvement avec mise à jour automatique du solde
       * Utilise un optimistic update pour une UX fluide
       * @param companyId Optionnel : utilise le currentCompanyId du store si non fourni
       */
      createMovement: async (movement: Omit<CashMovement, 'id' | 'companyId' | 'createdAt'>, companyId?: string) => {
        const targetCompanyId = companyId || get().currentCompanyId;
        if (!targetCompanyId) {
          throw new Error('Utilisateur non connecté');
        }

        console.log('[createMovement] Création mouvement', { type: movement.type, amount: movement.amount, companyId: targetCompanyId });
        set({ loading: true, error: null });

        try {
          // Optimistic update immédiat
          const tempMovement: CashMovement = {
            ...movement,
            id: `temp-${Date.now()}`,
            createdAt: new Date(),
            companyId: targetCompanyId,
          };

          // Calculer le delta du solde
          const currentBalance = get().balances[movement.cashRegisterId] || 0;
          let amountDelta = 0;

          if (movement.type === 'in') {
            amountDelta = movement.amount;
          } else if (movement.type === 'out') {
            amountDelta = -movement.amount;
          } else if (movement.type === 'transfer') {
            // Transfer : débit de la source, crédit de la cible
            if (movement.sourceCashRegisterId) {
              // Ce mouvement est pour la caisse cible (crédit)
              amountDelta = movement.amount;
            } else if (movement.targetCashRegisterId) {
              // Ce mouvement est pour la caisse source (débit)
              amountDelta = -movement.amount;
            }
          }

          const newBalance = currentBalance + amountDelta;

          console.log('[createMovement] Calcul delta', {
            currentBalance,
            amountDelta,
            newBalance,
          });

          // Optimistic update de l'UI
          set((state) => ({
            movements: [tempMovement, ...state.movements],
            balances: {
              ...state.balances,
              [movement.cashRegisterId]: newBalance,
            },
          }));

          console.log('[createMovement] Optimistic update effectué', { newBalance });

          // Créer dans Firebase avec mise à jour du solde
          const movementsRef = collection(db, COLLECTIONS.companyCashMovements(targetCompanyId));
          const movementRef = doc(movementsRef);
          const cashRegisterRef = doc(db, COLLECTIONS.companyCashRegisters(targetCompanyId), movement.cashRegisterId);

          await runTransaction(db, async (transaction) => {
            // Lire le solde actuel de la caisse depuis Firestore
            const cashRegisterSnap = await transaction.get(cashRegisterRef);
            const firestoreBalance = cashRegisterSnap.exists() ? (cashRegisterSnap.data().currentBalance || 0) : 0;

            console.log('[createMovement] Transaction - Solde Firestore avant:', firestoreBalance);

            // Créer le mouvement - IMPORTANT: Filtrer les champs undefined
            const movementData: any = {
              id: movementRef.id,
              companyId: targetCompanyId,
              cashRegisterId: movement.cashRegisterId,
              type: movement.type,
              amount: movement.amount,
              category: movement.category,
              createdAt: new Date(),
            };

            // Ajouter les champs optionnels seulement s'ils sont définis
            if (movement.description) movementData.description = movement.description;
            if (movement.targetCashRegisterId) movementData.targetCashRegisterId = movement.targetCashRegisterId;
            if (movement.sourceCashRegisterId) movementData.sourceCashRegisterId = movement.sourceCashRegisterId;
            if (movement.referenceId) movementData.referenceId = movement.referenceId;
            if (movement.referenceType) movementData.referenceType = movement.referenceType;
            if (movement.userId) movementData.userId = movement.userId;

            transaction.set(movementRef, movementData);

            // Mettre à jour le solde de la caisse dans Firestore
            transaction.update(cashRegisterRef, {
              currentBalance: firestoreBalance + amountDelta,
              updatedAt: new Date(),
            });

            console.log('[createMovement] Transaction - Solde Firestore après:', firestoreBalance + amountDelta);
          });

          console.log('[createMovement] ✅ Transaction réussie', { movementId: movementRef.id });

          // Recharger pour confirmer et synchroniser
          await get().fetchMovements(movement.cashRegisterId, true);
          await get().fetchCashRegisters(targetCompanyId);

          return movementRef.id;
        } catch (error) {
          // Rollback optimistic update
          console.error('[createMovement] ❌ Erreur, rollback en cours', error);
          await get().fetchMovements(get().selectedCashRegisterId || undefined, true);
          set({ error: (error as Error).message });
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      /**
       * Supprimer un mouvement
       */
      deleteMovement: async (id: string) => {
        const companyId = get().currentCompanyId;
        if (!companyId) {
          throw new Error('Utilisateur non connecté');
        }

        console.log('[deleteMovement] Suppression mouvement', { id });
        set({ loading: true, error: null });

        try {
          // Supprimer le mouvement
          const movementRef = doc(db, COLLECTIONS.companyCashMovements(companyId), id);
          await deleteDoc(movementRef);

          console.log('[deleteMovement] Mouvement supprimé, recalcul des soldes');

          // Recalculer le solde de toutes les caisses
          await get().refreshBalances(true);
          await get().fetchCashRegisters(companyId);
          await get().fetchMovements(get().selectedCashRegisterId || undefined, true);
        } catch (error) {
          console.error('[deleteMovement] Erreur:', error);
          set({ error: (error as Error).message });
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      /**
       * Créer une caisse
       */
      createCashRegister: async (
        data: Omit<CashRegister, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>
      ): Promise<string> => {
        const companyId = get().currentCompanyId;
        if (!companyId) {
          throw new Error('Utilisateur non connecté');
        }

        console.log('[createCashRegister] Création caisse', { name: data.name });
        set({ loading: true, error: null });

        try {
          const docRef = await addDoc(collection(db, COLLECTIONS.companyCashRegisters(companyId)), {
            ...data,
            currentBalance: 0,
            companyId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          console.log('[createCashRegister] Caisse créée', { id: docRef.id });

          await get().fetchCashRegisters(companyId);
          return docRef.id;
        } catch (error) {
          console.error('[createCashRegister] Erreur:', error);
          set({ error: (error as Error).message });
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      /**
       * Mettre à jour une caisse
       */
      updateCashRegister: async (id: string, data: Partial<CashRegister>) => {
        const companyId = get().currentCompanyId;
        if (!companyId) {
          throw new Error('Utilisateur non connecté');
        }

        console.log('[updateCashRegister] Mise à jour caisse', { id, data });
        set({ loading: true, error: null });

        try {
          const cashRegisterRef = doc(db, COLLECTIONS.companyCashRegisters(companyId), id);
          await updateDoc(cashRegisterRef, {
            ...data,
            updatedAt: new Date(),
          });

          console.log('[updateCashRegister] Caisse mise à jour');

          await get().fetchCashRegisters(companyId);
        } catch (error) {
          console.error('[updateCashRegister] Erreur:', error);
          set({ error: (error as Error).message });
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      /**
       * Supprimer une caisse
       */
      deleteCashRegister: async (id: string) => {
        const companyId = get().currentCompanyId;
        if (!companyId) {
          throw new Error('Utilisateur non connecté');
        }

        console.log('[deleteCashRegister] Suppression caisse', { id });
        set({ loading: true, error: null });

        try {
          await deleteDoc(doc(db, COLLECTIONS.companyCashRegisters(companyId), id));

          // Nettoyer l'état local
          set((state) => {
            const newBalances = { ...state.balances };
            delete newBalances[id];
            return {
              balances: newBalances,
            };
          });

          console.log('[deleteCashRegister] Caisse supprimée');

          await get().fetchCashRegisters(companyId);
        } catch (error) {
          console.error('[deleteCashRegister] Erreur:', error);
          set({ error: (error as Error).message });
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      /**
       * Recalculer tous les soldes depuis les mouvements
       * À utiliser après une suppression ou pour resynchroniser
       * @param companyId Optionnel : utilise le currentCompanyId du store si non fourni
       */
      refreshBalances: async (forceRecalculate = false, companyId?: string) => {
        const targetCompanyId = companyId || get().currentCompanyId;
        if (!targetCompanyId) {
          console.error('[refreshBalances] Aucune compagnie sélectionnée');
          return;
        }

        console.log('[refreshBalances] Recalcul des soldes', { forceRecalculate, companyId: targetCompanyId });

        try {
          // Pour chaque caisse, recalculer le solde depuis les mouvements
          for (const cr of get().cashRegisters) {
            const movementsRef = collection(db, COLLECTIONS.companyCashMovements(targetCompanyId));
            const q = query(movementsRef, where('cashRegisterId', '==', cr.id));
            const snapshot = await getDocs(q);

            console.log('[refreshBalances] Analyse des mouvements pour', cr.id, '- trouvé:', snapshot.size, 'mouvements');

            let balance = 0;
            snapshot.forEach((doc) => {
              const m = doc.data();
              const prevBalance = balance;

              if (m.type === 'in') {
                balance += m.amount;
                console.log('[refreshBalances] Mouvement IN -', m.amount, '→', balance, '(diff:', balance - prevBalance, ')');
              } else if (m.type === 'out') {
                balance -= m.amount;
                console.log('[refreshBalances] Mouvement OUT -', m.amount, '→', balance, '(diff:', balance - prevBalance, ')');
              } else if (m.type === 'transfer') {
                if (m.sourceCashRegisterId) {
                  // Ce mouvement crédite cette caisse
                  balance += m.amount;
                  console.log('[refreshBalances] Mouvement TRANSFER IN -', m.amount, '→', balance, '(diff:', balance - prevBalance, ')');
                } else if (m.targetCashRegisterId) {
                  // Ce mouvement débite cette caisse
                  balance -= m.amount;
                  console.log('[refreshBalances] Mouvement TRANSFER OUT -', m.amount, '→', balance, '(diff:', balance - prevBalance, ')');
                }
              } else {
                console.log('[refreshBalances] ⚠️ Type de mouvement inconnu:', m.type, '- montant:', m.amount);
              }
            });

            console.log('[refreshBalances] Solde recalculé', {
              cashRegisterId: cr.id,
              balance,
            });

            // IMPORTANT: Mettre à jour le state local ET Firestore
            set((state) => ({
              balances: {
                ...state.balances,
                [cr.id]: balance,
              },
            }));

            // Mettre à jour currentBalance dans Firestore pour persister le recalcul
            try {
              const cashRegisterRef = doc(db, COLLECTIONS.companyCashRegisters(targetCompanyId), cr.id);
              await updateDoc(cashRegisterRef, {
                currentBalance: balance,
                updatedAt: new Date(),
              });

              console.log('[refreshBalances] ✅ Solde sauvegardé dans Firestore', {
                cashRegisterId: cr.id,
                balance,
              });
            } catch (firestoreError) {
              console.error('[refreshBalances] ❌ ERREUR sauvegarde Firestore:', firestoreError);
            }
          }
        } catch (error) {
          console.error('[refreshBalances] Erreur:', error);
        }
      },

      /**
       * Récupérer les statistiques des mouvements du jour
       */
      fetchTodayStats: async () => {
        const companyId = get().currentCompanyId;
        if (!companyId) {
          console.error('[fetchTodayStats] Aucune compagnie sélectionnée');
          return;
        }

        console.log('[fetchTodayStats] Chargement stats du jour');

        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const movementsRef = collection(db, COLLECTIONS.companyCashMovements(companyId));
          const q = query(
            movementsRef,
            where('createdAt', '>=', today),
            where('createdAt', '<', tomorrow),
            orderBy('createdAt', 'desc')
          );

          const snapshot = await getDocs(q);
          let todayIn = 0;
          let todayOut = 0;

          snapshot.forEach((doc) => {
            const movement = doc.data();
            const isIn = movement.type === 'in' || (movement.type === 'transfer' && movement.sourceCashRegisterId);
            const isOut = movement.type === 'out' || (movement.type === 'transfer' && movement.targetCashRegisterId);

            if (isIn) todayIn += movement.amount;
            if (isOut) todayOut += movement.amount;
          });

          console.log('[fetchTodayStats] Stats chargées', { todayIn, todayOut });

          set({ todayStats: { todayIn, todayOut } });
        } catch (error) {
          console.error('[fetchTodayStats] Erreur:', error);
        }
      },

      /**
       * Reset du store (déconnexion)
       */
      reset: () => {
        console.log('[useCashRegistersStore] Reset du store');
        set({
          cashRegisters: [],
          movements: [],
          balances: {},
          currentCompanyId: null,
          loading: false,
          error: null,
          hasMore: false,
          lastDoc: null,
          pageSize: 50,
          selectedCashRegisterId: null,
          todayStats: { todayIn: 0, todayOut: 0 },
        });
      },

      /**
       * Récupérer une caisse par ID
       */
      getCashRegisterById: (id: string) => {
        return get().cashRegisters.find((cr) => cr.id === id);
      },

      /**
       * Récupérer le solde d'une caisse
       */
      getBalance: (cashRegisterId: string) => {
        return get().balances[cashRegisterId] || 0;
      },

      /**
       * Récupérer le solde total de toutes les caisses
       */
      getTotalBalance: () => {
        return Object.values(get().balances).reduce((sum, balance) => sum + balance, 0);
      },

      /**
       * Récupérer les mouvements filtrés
       */
      getFilteredMovements: () => {
        return get().movements;
      },
    })),
    {
      name: 'cash-registers-storage',
      partialize: (state) => ({
        cashRegisters: state.cashRegisters,
        // balances: state.balances, // NE PAS PERSISTER - toujours depuis Firestore currentBalance
        selectedCashRegisterId: state.selectedCashRegisterId,
      }),
    }
  )
);

/**
 * Hooks spécialisés optimisés
 */
export const useCashRegisters = () => useCashRegistersStore((state) => state.cashRegisters);
export const useMovements = () => useCashRegistersStore((state) => state.movements);
export const useBalances = () => useCashRegistersStore((state) => state.balances);
export const useCashRegistersLoading = () => useCashRegistersStore((state) => state.loading);
export const useMovementsLoading = () => useCashRegistersStore((state) => state.loading);
export const useMovementsHasMore = () => useCashRegistersStore((state) => state.hasMore);
export const useTodayStats = () => useCashRegistersStore((state) => state.todayStats);
export const useSelectedCashRegisterId = () => useCashRegistersStore((state) => state.selectedCashRegisterId);

/**
 * Sélecteurs dérivés
 */
export const selectCashRegisterById = (id: string) =>
  useCashRegistersStore.getState().getCashRegisterById(id);
export const selectBalance = (cashRegisterId: string) =>
  useCashRegistersStore.getState().getBalance(cashRegisterId);
export const selectTotalBalance = () => useCashRegistersStore.getState().getTotalBalance();

export default useCashRegistersStore;

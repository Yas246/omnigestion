'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/useAuth';
import { realtimeService } from '@/lib/services/RealtimeService';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Hook pour les crédits fournisseurs avec écoute temps réel GLOBAL
 *
 * Le service global maintient la connexion onSnapshot active en permanence,
 * permettant au cache React Query de persister entre les navigations.
 *
 * Les crédits sont enrichis avec leurs payments (nested collections).
 */
export function useSupplierCreditsRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: credits = [], isLoading, error } = useQuery<any[]>({
    queryKey: ['companies', user?.currentCompanyId, 'supplierCredits'],
    queryFn: async () => [],
    enabled: !!user?.currentCompanyId,
    staleTime: Infinity,
  });

  // Démarrer l'écoute globale (une seule fois pour toute l'application)
  useEffect(() => {
    if (user?.currentCompanyId) {
      realtimeService.startSupplierCreditsListener(queryClient, user.currentCompanyId);
      // NOTE: Les payments sont chargés automatiquement par startSupplierCreditsListener
      // Plus besoin d'appeler loadSupplierCreditPayments manuellement
    }
    // NOTE: PAS de cleanup du cache ici! Le cache doit persister entre les navigations.
    // Le cache sera vidé uniquement lors d'un changement de compagnie (géré par RealtimeService)
  }, [user?.currentCompanyId, queryClient]);

  return {
    credits,
    isLoading,
    error,
  };
}

/**
 * Charge les payments pour tous les crédits fournisseurs et les met en cache
 */
async function loadSupplierCreditPayments(queryClient: QueryClient, companyId: string) {
  try {
    // Récupérer tous les crédits depuis le cache
    const credits = queryClient.getQueryData<any[]>(
      ['companies', companyId, 'supplierCredits']
    ) || [];

    if (credits.length === 0) {
      console.log('[useSupplierCreditsRealtime] ⚠️ Aucun crédit à traiter');
      return;
    }

    // Vérifier si les payments sont déjà chargés pour TOUS les crédits
    const allHavePayments = credits.every((credit: any) => credit.hasOwnProperty('payments'));
    if (allHavePayments) {
      console.log('[useSupplierCreditsRealtime] ♻️ Payments déjà chargés pour tous les crédits');
      return;
    }

    console.log('[useSupplierCreditsRealtime] 🔨 Chargement des payments...');

    // Pour chaque crédit, charger ses payments
    const creditsWithPayments = await Promise.all(
      credits.map(async (credit: any) => {
        try {
          const paymentsSnapshot = await getDocs(
            query(
              collection(db, `companies/${companyId}/supplier_credits/${credit.id}/payments`)
            )
          );

          const payments = paymentsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            paidAt: doc.data().paidAt?.toDate() || new Date(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
          }));

          console.log(`[useSupplierCreditsRealtime] 📦 Crédit ${credit.id}: ${payments.length} payment(s)`);

          return {
            ...credit,
            payments,
            amountPaid: payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
            remainingAmount: credit.amount - payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
          };
        } catch (err) {
          console.error(`[useSupplierCreditsRealtime] ❌ Erreur chargement payments pour crédit ${credit.id}:`, err);
          return credit;
        }
      })
    );

    // Mettre à jour le cache avec les crédits enrichis
    queryClient.setQueryData(
      ['companies', companyId, 'supplierCredits'],
      creditsWithPayments
    );

    // 🔄 IMPORTANT: Stocker les payments dans le cache RealtimeService
    // pour qu'ils soient préservés lors des mises à jour onSnapshot
    creditsWithPayments.forEach((credit) => {
      if (credit.payments && credit.payments.length > 0) {
        realtimeService.cacheSupplierCreditPayments(credit.id, credit.payments);
      }
    });

    console.log(`[useSupplierCreditsRealtime] ✅ ${creditsWithPayments.length} crédits mis à jour avec leurs payments (CACHÉ)`);
  } catch (err) {
    console.error('[useSupplierCreditsRealtime] ❌ Erreur chargement payments:', err);
  }
}
'use client';

import { useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { realtimeService } from '@/lib/services/RealtimeService';

/**
 * Hook global qui surveille l'état de connexion Firebase
 * et redémarre les listeners onSnapshot quand nécessaire.
 *
 * Cas gérés :
 * 1. Token expiré → onAuthStateChanged détecte le re-auth → restart
 * 2. Onglet redevient visible → visibilitychange → restart si erreur
 * 3. Réseau coupe puis revient → online event → restart si listeners morts
 * 4. Si le restart échoue (données toujours vides après 10s) → signOut()
 *
 * À placer une seule fois dans le providers racine.
 */
export function useConnectionRecovery() {
  const isRecovering = useRef(false);

  useEffect(() => {
    // 1. Écouter les changements d'état d'authentification
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      if (realtimeService.isInError() && !isRecovering.current) {
        console.log('[ConnectionRecovery] 🔑 Utilisateur re-authentifié, redémarrage des listeners...');
        attemptRecovery();
      }
    });

    // 2. Écouter le retour de visibilité de l'onglet (sortie de veille)
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (!auth.currentUser) return;
      if (isRecovering.current) return;

      // Si en erreur, tenter la récupération immédiatement
      if (realtimeService.isInError()) {
        console.log('[ConnectionRecovery] 👁️ Onglet visible avec erreur, redémarrage...');
        attemptRecovery();
        return;
      }

      // Sinon, vérifier après un délai si des listeners sont morts
      setTimeout(() => {
        if (realtimeService.isInError() && !isRecovering.current) {
          console.log('[ConnectionRecovery] 👁️ Erreur détectée après retour onglet, redémarrage...');
          attemptRecovery();
        }
      }, 3000);
    };

    // 3. Écouter le retour du réseau (online/offline)
    const handleOnline = () => {
      if (!auth.currentUser) return;
      if (isRecovering.current) return;

      // Le réseau revient → toujours tenter un restart
      // car les listeners peuvent être morts silencieusement
      console.log('[ConnectionRecovery] 🌐 Réseau revenu, vérification des listeners...');
      setTimeout(() => {
        if (!isRecovering.current) {
          attemptRecovery();
        }
      }, 2000);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  function attemptRecovery() {
    if (isRecovering.current) return;
    isRecovering.current = true;

    try {
      realtimeService.restartAllListeners();
    } catch (err) {
      console.error('[ConnectionRecovery] ❌ Échec redémarrage, déconnexion...', err);
      forceSignOut();
      return;
    }

    // Si après 10s les données ne sont pas revenues, déconnecter
    setTimeout(() => {
      if (realtimeService.isInError()) {
        console.warn('[ConnectionRecovery] ⚠️ Données toujours non récupérées après 10s, déconnexion forcée');
        forceSignOut();
      } else {
        console.log('[ConnectionRecovery] ✅ Récupération réussie');
      }
      isRecovering.current = false;
    }, 10000);
  }

  async function forceSignOut() {
    try {
      await signOut(auth);
      console.log('[ConnectionRecovery] 🔓 Utilisateur déconnecté, redirection vers login...');
    } catch (err) {
      console.error('[ConnectionRecovery] ❌ Erreur lors de la déconnexion:', err);
      window.location.href = '/login';
    }
  }
}

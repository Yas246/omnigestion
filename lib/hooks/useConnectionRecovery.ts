'use client';

import { useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { realtimeService } from '@/lib/services/RealtimeService';

/**
 * Hook global qui surveille l'état de connexion Firebase Auth
 * et redémarre les listeners onSnapshot quand nécessaire.
 *
 * Cas gérés :
 * 1. Token expiré pendant la veille du PC → onAuthStateChanged détecte le re-auth → restart
 * 2. Onglet redevient visible après veille → visibilitychange + restart
 * 3. Si le restart échoue (données toujours vides après 10s) → signOut() → redirect login
 *
 * À placer une seule fois dans le providers racine.
 */
export function useConnectionRecovery() {
  const isRecovering = useRef(false);

  useEffect(() => {
    // 1. Écouter les changements d'état d'authentification
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Utilisateur déconnecté — les listeners seront nettoyés par le dashboard layout
        return;
      }

      if (realtimeService.isInError() && !isRecovering.current) {
        console.log('[ConnectionRecovery] 🔑 Utilisateur re-authentifié, redémarrage des listeners...');
        attemptRecovery();
      }
    });

    // 2. Écouter le retour de visibilité de l'onglet (sortie de veille)
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (!auth.currentUser) return; // Pas connecté
      if (isRecovering.current) return;

      // Si en erreur, tenter la récupération
      if (realtimeService.isInError()) {
        console.log('[ConnectionRecovery] 👁️ Onglet visible avec erreur, redémarrage...');
        attemptRecovery();
        return;
      }

      // Sinon, vérifier l'état après un délai (les erreurs peuvent mettre du temps à arriver)
      setTimeout(() => {
        if (realtimeService.isInError() && !isRecovering.current) {
          console.log('[ConnectionRecovery] 👁️ Erreur détectée après retour onglet, redémarrage...');
          attemptRecovery();
        }
      }, 3000);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  /**
   * Tente de redémarrer les listeners.
   * Si après 10 secondes les données ne sont pas revenues, déconnecte l'utilisateur.
   */
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

    // Fallback : si après 10s les données ne sont pas revenues, déconnecter
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
      // Dernier recours : recharger la page
      window.location.href = '/login';
    }
  }
}

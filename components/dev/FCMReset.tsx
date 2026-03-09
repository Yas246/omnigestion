'use client';

import { useEffect } from 'react';

/**
 * Composant qui expose la fonction resetFCM() dans la console du navigateur
 * Uniquement pour le développement / debug
 */
export function FCMReset() {
  useEffect(() => {
    // Fonction pour réinitialiser FCM
    const resetFCM = () => {
      console.log('[resetFCM] Réinitialisation complète de FCM...');

      // 1. Supprimer les flags localStorage
      localStorage.removeItem('fcm-permission-granted');
      localStorage.removeItem('notification-permission-dismissed');

      console.log('[resetFCM] ✓ localStorage nettoyé');

      // 2. Unregister le service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            console.log('[resetFCM] Suppression du Service Worker:', registration.scope);
            registration.unregister();
          });
        });
      }

      // 3. Recharger la page pour tout réinitialiser
      console.log('[resetFCM] Rechargement de la page dans 1 seconde...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    };

    // Exposer globalement
    (window as any).resetFCM = resetFCM;
    console.log('[FCMReset] Fonction resetFCM() disponible dans la console');
  }, []);

  return null; // Ce composant n'affiche rien
}

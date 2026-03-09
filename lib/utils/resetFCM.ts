/**
 * Utilitaire pour réinitialiser complètement FCM
 * À utiliser dans la console du navigateur : resetFCM()
 */

export function resetFCM() {
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
}

// Exposer immédiatement dans la console
if (typeof window !== 'undefined') {
  (window as any).resetFCM = resetFCM;
  console.log('[resetFCM] Fonction resetFCM() disponible dans la console');
}

/**
 * Hook pour détecter le statut de connexion en ligne/hors ligne
 */
import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    // Initial state based on navigator
    if (typeof window !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  useEffect(() => {
    // Handle online event
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[Network] Connexion rétablie');
    };

    // Handle offline event
    const handleOffline = () => {
      setIsOnline(false);
      console.log('[Network] Connexion perdue - Mode hors ligne');
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Hook pour afficher une notification de changement de statut réseau
 */
export function useNetworkNotification() {
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Afficher une notification lors du changement de statut
    const showNotification = (message: string, type: 'online' | 'offline') => {
      // Créer un événement personnalisé
      const event = new CustomEvent('network-change', {
        detail: { isOnline: type === 'online', message },
      });
      window.dispatchEvent(event);
    };

    // Écouter les événements native
    const handleOnline = () => {
      showNotification('Connexion rétablie', 'online');
    };

    const handleOffline = () => {
      showNotification('Mode hors ligne - Certaines fonctionnalités peuvent être limitées', 'offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline]);

  return isOnline;
}

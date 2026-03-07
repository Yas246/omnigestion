'use client';

import { useEffect, useState } from 'react';
import { registerSW, listenForInstallPrompt } from '@/lib/pwa';

export function SWRegistration() {
  const [swRegistered, setSwRegistered] = useState(false);

  useEffect(() => {
    // Enregistrer le Service Worker
    const registerServiceWorker = async () => {
      try {
        const success = await registerSW();
        setSwRegistered(success);
      } catch (error) {
        console.error('[SWRegistration] Erreur:', error);
      }
    };

    registerServiceWorker();

    // Écouter l'événement de mise à jour du SW
    const handleUpdate = () => {
      console.log('[SWRegistration] Mise à jour disponible');
      // Afficher une notification à l'utilisateur
      if (window.confirm('Une nouvelle version est disponible. Voulez-vous mettre à jour ?')) {
        window.location.reload();
      }
    };

    window.addEventListener('sw-update-available', handleUpdate);

    return () => {
      window.removeEventListener('sw-update-available', handleUpdate);
    };
  }, []);

  // Ce composant ne rend rien visuellement
  return null;
}

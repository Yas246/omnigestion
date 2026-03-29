/**
 * Composant pour demander la permission de notification FCM
 * Affiche une bannière discrète pour inviter l'utilisateur à activer les notifications
 */

'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { useFCM } from '@/lib/hooks/useFCM';

export function NotificationPermission() {
  const { permissionStatus, requestPermission, initializeFCM, loading } = useFCM();
  const [dismissed, setDismissed] = useState(false);
  const [wasGrantedPreviously, setWasGrantedPreviously] = useState(false);

  useEffect(() => {
    // Charger l'état de rejet depuis localStorage
    const isDismissed = localStorage.getItem('notification-permission-dismissed');
    if (isDismissed === 'true') {
      setDismissed(true);
    }

    // Vérifier si la permission a déjà été accordée précédemment
    const permissionGranted = localStorage.getItem('fcm-permission-granted');
    if (permissionGranted === 'true') {
      console.log('[NotificationPermission] Permission déjà accordée (localStorage)');
      setWasGrantedPreviously(true);
    }
  }, []);

  // Masquer si déjà accordée (y compris via localStorage)
  if (dismissed || permissionStatus === 'granted' || permissionStatus === 'denied' || wasGrantedPreviously) {
    return null;
  }

  const handleEnable = async () => {
    const granted = await requestPermission();
    if (granted) {
      await initializeFCM();
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('notification-permission-dismissed', 'true');
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start gap-3">
          {/* Icône de cloche */}
          <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
            <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>

          {/* Contenu */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              Activer les notifications
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Recevez des alertes en temps réel pour les nouvelles ventes et les stocks faibles
            </p>
          </div>

          {/* Bouton de fermeture */}
          <button
            onClick={handleDismiss}
            className="shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            title="Masquer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleEnable}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Activation...' : 'Activer'}
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Plus tard
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in-from-bottom-4 {
          from {
            opacity: 0;
            transform: translateY(1rem);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-in {
          animation: slide-in-from-bottom-4 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

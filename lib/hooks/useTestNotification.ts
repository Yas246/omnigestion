/**
 * Hook pour tester les notifications push FCM
 * Utilisé uniquement pour le debug
 */

'use client';

import { useState } from 'react';
import { useAuth } from './useAuth';
import type { PushNotification } from '@/types';

export function useTestNotification() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const sendTestNotification = async () => {
    if (!user?.currentCompanyId) {
      setError('Utilisateur non connecté ou aucune compagnie sélectionnée');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    console.log('[TestNotification] Début du test de notification...');
    console.log('[TestNotification] Utilisateur:', user.displayName, user.email);
    console.log('[TestNotification] Rôle:', user.role);
    console.log('[TestNotification] Compagnie ID:', user.currentCompanyId);

    try {
      // Préparer la notification de test
      const notification: PushNotification = {
        type: 'test',
        companyId: user.currentCompanyId,
        targetRole: 'admin', // Envoyer aux admins seulement
        title: '🧪 Notification de Test',
        body: `Test de notification de ${user.role} - ${new Date().toLocaleTimeString('fr-FR')}`,
        data: {
          userId: user.id, // ✅ Corrigé: User.id pas User.uid
          timestamp: new Date().toISOString(),
          test: 'true', // ✅ FCM exige que toutes les valeurs dans data soient des strings !
        },
      };

      console.log('[TestNotification] Envoi de la notification à l\'API...', notification);

      // Appeler l'API Next.js
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notification),
      });

      const data = await response.json();

      console.log('[TestNotification] Réponse de l\'API:', response.status, data);

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi');
      }

      setResult(data);
      console.log('[TestNotification] Succès !', data);
    } catch (err: any) {
      const errorMessage = err.message || 'Erreur inconnue';
      console.error('[TestNotification] Erreur:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    sendTestNotification,
    loading,
    error,
    result,
  };
}

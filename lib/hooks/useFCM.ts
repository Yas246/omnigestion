/**
 * Hook pour gérer les notifications push FCM
 * Permet de demander la permission, générer et sauvegarder le token FCM
 */

'use client';

import { useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { FCMToken } from '@/types';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export function useFCM() {
  const [token, setToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Demander la permission de notification au navigateur
   */
  const requestPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      setError('Les notifications ne sont pas supportées par ce navigateur');
      return false;
    }

    if (Notification.permission === 'granted') {
      setPermissionStatus('granted');
      return true;
    }

    if (Notification.permission === 'denied') {
      setPermissionStatus('denied');
      setError('Notifications bloquées par l\'utilisateur');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);

      if (permission === 'granted') {
        return true;
      } else {
        setError('Permission de notification refusée');
        return false;
      }
    } catch (err) {
      setError('Erreur lors de la demande de permission');
      console.error('[useFCM] Erreur demande permission:', err);
      return false;
    }
  };

  /**
   * Sauvegarder le token FCM dans Firestore
   */
  const saveToken = async (fcmToken: string): Promise<void> => {
    if (!auth.currentUser) {
      setError('Utilisateur non connecté');
      return;
    }

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);

      // Créer l'objet token avec device info
      const fcmTokenData: FCMToken = {
        token: fcmToken,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: 'web',
          lastSeen: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Ajouter le token à la liste (évite les doublons avec arrayUnion)
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(fcmTokenData),
        updatedAt: serverTimestamp(),
      });

      setToken(fcmToken);
      console.log('[useFCM] Token sauvegardé dans Firestore');
    } catch (err: any) {
      // Si le token existe déjà, ce n'est pas une erreur fatale
      if (err.code !== 'aborted') {
        console.error('[useFCM] Erreur sauvegarde token:', err);
        setError('Erreur lors de la sauvegarde du token');
      }
    }
  };

  /**
   * Initialiser FCM et générer le token
   */
  const initializeFCM = async (): Promise<(() => void) | undefined> => {
    if (typeof window === 'undefined') {
      setError('FCM non disponible côté serveur');
      return;
    }

    if (!auth.currentUser) {
      setError('Utilisateur non connecté');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Import dynamique pour éviter les erreurs SSR
      const { messaging } = await import('@/lib/firebase');

      if (!messaging) {
        setError('Firebase Messaging non disponible');
        setLoading(false);
        return;
      }

      // Demander la permission si nécessaire
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        setLoading(false);
        return;
      }

      // Générer le token FCM
      try {
        console.log('[useFCM] Génération du token FCM avec VAPID_KEY:', VAPID_KEY ? 'configurée' : 'NON configurée');

        const fcmToken = await getToken(messaging, {
          vapidKey: VAPID_KEY,
        });

        if (!fcmToken) {
          console.error('[useFCM] Échec de la génération du token FCM - token vide');
          setError('Impossible de générer le token FCM');
          setLoading(false);
          return;
        }

        console.log('[useFCM] Token FCM généré avec succès:', fcmToken.substring(0, 20) + '...');
        await saveToken(fcmToken);
      } catch (err: any) {
        console.error('[useFCM] Erreur lors de la génération du token:', err);
        if (err.code === 'messaging/permission-blocked') {
          setError('Notifications bloquées');
          setPermissionStatus('denied');
        } else {
          throw err;
        }
      }

      // Écouter les messages en premier plan (quand l'app est ouverte)
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('[useFCM] Notification reçue en premier plan:', payload);

        // Afficher une notification native si le navigateur le supporte
        if (payload.notification && 'Notification' in window) {
          new Notification(payload.notification.title || 'Notification', {
            body: payload.notification.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-96x96.png',
            tag: payload.data?.type || 'default',
            data: payload.data,
          });
        }
      });

      // Retourner la fonction de cleanup
      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    } catch (err) {
      console.error('[useFCM] Erreur initialisation:', err);
      setError('Erreur lors de l\'initialisation des notifications');
    } finally {
      setLoading(false);
    }
  };

  return {
    token,
    permissionStatus,
    loading,
    error,
    requestPermission,
    initializeFCM,
  };
}

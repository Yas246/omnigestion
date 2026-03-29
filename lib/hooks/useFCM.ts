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
  // ✅ CORRECTION: Initialiser avec l'état réel du navigateur au lieu de 'default'
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchroniser l'état avec le navigateur et charger le token existant depuis Firestore
  // Ne tourne qu'une seule fois par session (guard localStorage)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission);

      if (Notification.permission === 'granted') {
        localStorage.setItem('fcm-permission-granted', 'true');
      }

      // Charger le token FCM existant depuis Firestore — une seule fois par session
      const sessionKey = 'fcm-token-loaded-' + (auth.currentUser?.uid || '');
      if (!sessionStorage.getItem(sessionKey)) {
        const loadExistingToken = async () => {
          if (!auth.currentUser) return;
          try {
            const { getDoc, doc: docFn } = await import('firebase/firestore');
            const userDoc = await getDoc(docFn(db, 'users', auth.currentUser.uid));
            const existingTokens: FCMToken[] = userDoc.data()?.fcmTokens || [];
            const currentUserAgent = navigator.userAgent;
            const existing = existingTokens.find(
              (t) => t.deviceInfo?.userAgent === currentUserAgent && t.deviceInfo?.platform === 'web'
            );
            if (existing) {
              setToken(existing.token);
            }
            sessionStorage.setItem(sessionKey, 'true');
          } catch {
            // Silencieux — le token sera chargé au prochain initializeFCM()
          }
        };
        loadExistingToken();
      }
    }
  }, []);

  /**
   * Demander la permission de notification au navigateur
   */
  const requestPermission = async (): Promise<boolean> => {
    console.log('[useFCM] État actuel des notifications:', Notification.permission);

    if (!('Notification' in window)) {
      setError('Les notifications ne sont pas supportées par ce navigateur');
      return false;
    }

    if (Notification.permission === 'granted') {
      console.log('[useFCM] Permission déjà accordée');
      setPermissionStatus('granted');
      return true;
    }

    if (Notification.permission === 'denied') {
      console.error('[useFCM] Permission refusée par l\'utilisateur');
      setPermissionStatus('denied');
      setError('Notifications bloquées par l\'utilisateur');
      return false;
    }

    try {
      console.log('[useFCM] Demande de permission en cours...');
      const permission = await Notification.requestPermission();
      console.log('[useFCM] Permission accordée:', permission);
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

    // Éviter les appels multiples — si on a déjà un token, ne pas relancer
    if (token) {
      console.log('[useFCM] Token déjà en mémoire, initialisation ignorée');
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

        if (!VAPID_KEY) {
          console.error('[useFCM] VAPID_KEY non définie dans .env.local');
          setError('VAPID_KEY non configurée - contactez l\'administrateur');
          setLoading(false);
          return;
        }

        console.log('[useFCM] VAPID_KEY (premiers caractères):', VAPID_KEY.substring(0, 20) + '...');
        console.log('[useFCM] VAPID_KEY longueur:', VAPID_KEY.length, 'caractères');

        // Récupérer ou enregistrer le service worker existant
        let swRegistration;
        try {
          swRegistration = await navigator.serviceWorker.getRegistration();
          if (!swRegistration) {
            console.log('[useFCM] Aucun SW trouvé, enregistrement de /sw.js');
            swRegistration = await navigator.serviceWorker.register('/sw.js');
          }
          console.log('[useFCM] Service Worker utilisé:', swRegistration);
          console.log('[useFCM] PushManager disponible?', !!swRegistration.pushManager);
        } catch (swError) {
          console.error('[useFCM] Erreur enregistrement SW:', swError);
          throw new Error('Impossible d\'enregistrer le service worker');
        }

        console.log('[useFCM] Appel à getToken() avec VAPID_KEY...');

        // ✅ CORRECTION: Vérifier si un token existe déjà pour cet appareil
        const { getDoc, doc: docFn } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const existingTokens = userDoc.data()?.fcmTokens || [];

        // Chercher un token existant pour ce useragent (même appareil)
        const currentUserAgent = navigator.userAgent;
        const existingToken = existingTokens.find((t: FCMToken) =>
          t.deviceInfo?.userAgent === currentUserAgent &&
          t.deviceInfo?.platform === 'web'
        );

        if (existingToken) {
          console.log('[useFCM] Token existant trouvé pour cet appareil:', existingToken.token.substring(0, 20) + '...');
          console.log('[useFCM] Réutilisation du token existant (pas de nouvelle génération)');
          setToken(existingToken.token);
          setLoading(false);

          // Écouter les messages en premier plan
          const unsubscribe = onMessage(messaging, (payload) => {
            console.log('[useFCM] Notification reçue en premier plan:', payload);
            if (payload.notification && 'Notification' in window) {
              const uniqueTag = `${payload.data?.type || 'default'}-${Date.now()}`;
              new Notification(payload.notification.title || 'Notification', {
                body: payload.notification.body,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-96x96.png',
                tag: uniqueTag, // Tag unique
                data: payload.data,
              });
            }
          });

          return () => {
            if (unsubscribe) {
              unsubscribe();
            }
          };
        }

        // Pas de token existant, en générer un nouveau
        const fcmToken = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swRegistration,
        });
        console.log('[useFCM] getToken() réussi!');

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
        console.error('[useFCM] Erreur name:', err.name);
        console.error('[useFCM] Erreur message:', err.message);
        console.error('[useFCM] Erreur code:', err.code);
        console.error('[useFCM] Notification permission:', Notification.permission);

        if (err.code === 'messaging/permission-blocked') {
          setError('Notifications bloquées');
          setPermissionStatus('denied');
        } else if (err.name === 'AbortError' && err.message.includes('push service error')) {
          setError('Erreur du service push - vérifiez que les notifications sont autorisées');
          console.error('[useFCM] Push service error - peut-être causé par:');
          console.error('  - Un adblocker ou extension de confidentialité');
          console.error('  - Notifications bloquées dans les paramètres Chrome');
          console.error('  - VPN ou proxy');
        } else {
          throw err;
        }
      }

      // Écouter les messages en premier plan (quand l'app est ouverte)
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('[useFCM] Notification reçue en premier plan:', payload);

        // Afficher une notification native si le navigateur le supporte
        if (payload.notification && 'Notification' in window) {
          // ✅ CORRECTION: Tag unique pour éviter le remplacement de notifications
          const uniqueTag = `${payload.data?.type || 'default'}-${Date.now()}`;

          console.log('[useFCM] Affichage notification avec tag:', uniqueTag);

          new Notification(payload.notification.title || 'Notification', {
            body: payload.notification.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-96x96.png',
            tag: uniqueTag, // Tag unique = notifications s'empilent
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
      setHasInitialized(true);
    }
  };

  /**
   * Désactiver les notifications : supprime le token du device et de Firestore
   */
  const disableNotifications = async (): Promise<void> => {
    try {
      // Supprimer le token FCM du device
      const { messaging } = await import('@/lib/firebase');
      if (messaging) {
        const { deleteToken } = await import('firebase/messaging');
        await deleteToken(messaging);
      }

      // Retirer les tokens de cet appareil de Firestore
      if (auth.currentUser) {
        const { getDoc, doc: docFn, updateDoc } = await import('firebase/firestore');
        const userRef = docFn(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        const existingTokens: FCMToken[] = userDoc.data()?.fcmTokens || [];

        const currentUserAgent = navigator.userAgent;
        const remainingTokens = existingTokens.filter(
          (t) => !(t.deviceInfo?.userAgent === currentUserAgent && t.deviceInfo?.platform === 'web')
        );

        await updateDoc(userRef, {
          fcmTokens: remainingTokens,
          updatedAt: serverTimestamp(),
        });
      }

      // Nettoyer le state et localStorage
      setToken(null);
      localStorage.removeItem('fcm-permission-granted');
      localStorage.removeItem('notification-permission-dismissed');

      console.log('[useFCM] Notifications désactivées avec succès');
    } catch (err) {
      console.error('[useFCM] Erreur désactivation notifications:', err);
      setError('Erreur lors de la désactivation des notifications');
    }
  };

  // Flag pour éviter les initialisations multiples
  const [hasInitialized, setHasInitialized] = useState(false);

  return {
    token,
    permissionStatus,
    loading,
    error,
    hasInitialized,
    requestPermission,
    initializeFCM,
    disableNotifications,
  };
}

/**
 * Context FCM - etat partage entre tous les composants
 * Permet de demander la permission, generer et sauvegarder le token FCM
 * SINGLETON : un seul etat pour toute l'app
 *
 * Regles importantes :
 * - Chaque navigateur genere SON PROPRE token (getToken())
 * - On ne recharge JAMAIS un token depuis Firestore dans le state
 * - Firestore sert uniquement a sauvegarder/nettoyer les tokens
 * - Un flag localStorage empeche le re-activation automatique apres desactivation
 */

'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import { getToken, onMessage, deleteToken } from 'firebase/messaging';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { FCMToken } from '@/types';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
const DISABLED_FLAG = 'fcm-intentionally-disabled';

// ===== Types =====
interface FCMContextType {
  token: string | null;
  permissionStatus: NotificationPermission;
  loading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  initializeFCM: () => Promise<void>;
  disableNotifications: () => Promise<void>;
}

// ===== Context =====
const FCMContext = createContext<FCMContextType | null>(null);

// ===== Provider =====
export function FCMProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializingRef = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Synchroniser la permission du navigateur
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  /**
   * Demander la permission de notification au navigateur
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      setError('Les notifications ne sont pas supportees par ce navigateur');
      return false;
    }

    if (Notification.permission === 'granted') {
      setPermissionStatus('granted');
      return true;
    }

    if (Notification.permission === 'denied') {
      setPermissionStatus('denied');
      setError('Notifications bloquees par l\'utilisateur');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      return permission === 'granted';
    } catch {
      setError('Erreur lors de la demande de permission');
      return false;
    }
  }, []);

  /**
   * Sauvegarder le token FCM dans Firestore
   * Remplace le token existant pour cet appareil (pas de doublon)
   */
  const saveToken = useCallback(async (fcmToken: string): Promise<void> => {
    if (!auth.currentUser) return;

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      const existingTokens: FCMToken[] = userDoc.data()?.fcmTokens || [];

      const deviceKey = getOrCreateDeviceId();

      // Chercher un token existant pour cet appareil (par deviceKey ou userAgent exact)
      const existingIndex = existingTokens.findIndex(t =>
        t.deviceInfo?.platform === 'web' && (
          t.deviceInfo?.deviceKey === deviceKey ||
          t.deviceInfo?.userAgent === navigator.userAgent
        )
      );

      const tokenData: FCMToken = {
        token: fcmToken,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: 'web',
          deviceKey,
          lastSeen: new Date(),
        },
        createdAt: existingIndex !== -1 ? (existingTokens[existingIndex].createdAt || new Date()) : new Date(),
        updatedAt: new Date(),
      };

      let updatedTokens: FCMToken[];
      if (existingIndex !== -1) {
        // Remplacer le token existant pour cet appareil
        updatedTokens = [...existingTokens];
        updatedTokens[existingIndex] = tokenData;
      } else {
        // Nouvel appareil
        updatedTokens = [...existingTokens, tokenData];
      }

      await updateDoc(userRef, {
        fcmTokens: updatedTokens,
        updatedAt: serverTimestamp(),
      });

      setToken(fcmToken);
    } catch (err: any) {
      if (err.code !== 'aborted') {
        console.error('[FCM] Erreur sauvegarde token:', err);
      }
    }
  }, []);

  /**
   * Ecouter les messages en premier plan
   */
  const listenForMessages = useCallback(async () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    const { messaging } = await import('@/lib/firebase');
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      if (payload.notification && 'Notification' in window) {
        const uniqueTag = `${payload.data?.type || 'default'}-${Date.now()}`;
        new Notification(payload.notification.title || 'Notification', {
          body: payload.notification.body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-96x96.png',
          tag: uniqueTag,
          data: payload.data,
        });
      }
    });

    unsubscribeRef.current = unsubscribe;
  }, []);

  /**
   * Initialiser FCM : generer un token pour CE navigateur
   * Toujours appeler getToken() - le SDK Firebase gere le cache interne
   */
  const initializeFCM = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined') return;

    // Eviter les appels multiples simultanes
    if (initializingRef.current) return;

    // Si on a deja un token en memoire, juste ecouter les messages
    if (token) {
      await listenForMessages();
      return;
    }

    if (!auth.currentUser) {
      setError('Utilisateur non connecte');
      return;
    }

    initializingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const { messaging } = await import('@/lib/firebase');
      if (!messaging) {
        setError('Firebase Messaging non disponible');
        return;
      }

      // Demander la permission si necessaire
      const hasPermission = await requestPermission();
      if (!hasPermission) return;

      if (!VAPID_KEY) {
        setError('VAPID_KEY non configuree');
        return;
      }

      // Enregistrer le service worker
      let swRegistration;
      try {
        swRegistration = await navigator.serviceWorker.getRegistration();
        if (!swRegistration) {
          swRegistration = await navigator.serviceWorker.register('/sw.js');
        }
      } catch {
        throw new Error('Impossible d\'enregistrer le service worker');
      }

      // TOUJOURS appeler getToken() - le SDK retourne le meme token si valide
      // ou en genere un nouveau si la subscription a change
      const fcmToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRegistration,
      });

      if (!fcmToken) {
        setError('Impossible de generer le token FCM');
        return;
      }

      // Sauvegarder dans Firestore (remplace ou ajoute)
      await saveToken(fcmToken);

      // Retirer le flag "intentionally disabled" car l'utilisateur a active
      localStorage.removeItem(DISABLED_FLAG);

      // Ecouter les messages en premier plan
      await listenForMessages();
    } catch (err: any) {
      console.error('[FCM] Erreur initialisation:', err);
      if (err.code === 'messaging/permission-blocked') {
        setError('Notifications bloquees');
        setPermissionStatus('denied');
      } else {
        setError('Erreur lors de l\'initialisation des notifications');
      }
    } finally {
      setLoading(false);
      initializingRef.current = false;
    }
  }, [token, requestPermission, saveToken, listenForMessages]);

  /**
   * Desactiver les notifications
   */
  const disableNotifications = useCallback(async (): Promise<void> => {
    try {
      const { messaging } = await import('@/lib/firebase');
      if (messaging) {
        await deleteToken(messaging);
      }

      // Retirer le token de cet appareil dans Firestore
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        const existingTokens: FCMToken[] = userDoc.data()?.fcmTokens || [];
        const deviceKey = getOrCreateDeviceId();

        const remainingTokens = existingTokens.filter(t =>
          !(t.deviceInfo?.platform === 'web' && (
            t.deviceInfo?.deviceKey === deviceKey ||
            t.deviceInfo?.userAgent === navigator.userAgent
          ))
        );

        await updateDoc(userRef, {
          fcmTokens: remainingTokens,
          updatedAt: serverTimestamp(),
        });
      }

      setToken(null);
      localStorage.setItem(DISABLED_FLAG, 'true');

      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    } catch (err) {
      console.error('[FCM] Erreur desactivation:', err);
      setError('Erreur lors de la desactivation');
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return (
    <FCMContext.Provider value={{
      token,
      permissionStatus,
      loading,
      error,
      requestPermission,
      initializeFCM,
      disableNotifications,
    }}>
      {children}
    </FCMContext.Provider>
  );
}

// ===== Hook =====
export function useFCM(): FCMContextType {
  const context = useContext(FCMContext);
  if (!context) {
    throw new Error('useFCM must be used within a FCMProvider');
  }
  return context;
}

// ===== Helpers =====

const DEVICE_ID_KEY = 'fcm-device-id';

/**
 * Genere un UUID v4 unique par instance de navigateur.
 * Stocke en localStorage pour persister entre les sessions.
 * Chaque telephone, chaque PC aura son propre ID.
 */
function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr';

  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  // Generer un UUID v4
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

  localStorage.setItem(DEVICE_ID_KEY, uuid);
  return uuid;
}

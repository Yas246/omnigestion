/**
 * Context FCM - etat partage entre tous les composants
 * Permet de demander la permission, generer et sauvegarder le token FCM
 * SINGLETON : un seul etat pour toute l'app
 */

'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import { getToken, onMessage, deleteToken } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { FCMToken } from '@/types';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

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
  const tokenLoadedRef = useRef(false);

  // Charger le token existant depuis Firestore au montage (une seule fois)
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    setPermissionStatus(Notification.permission);

    if (Notification.permission === 'granted') {
      localStorage.setItem('fcm-permission-granted', 'true');
    }

    const loadExistingToken = async () => {
      if (!auth.currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const existingTokens: FCMToken[] = userDoc.data()?.fcmTokens || [];
        // Trouver un token pour cet appareil (matching souple)
        const existing = findTokenForDevice(existingTokens);
        if (existing) {
          setToken(existing.token);
          tokenLoadedRef.current = true;
        }
      } catch {
        // Silencieux
      }
    };
    loadExistingToken();
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

      if (permission === 'granted') {
        return true;
      } else {
        setError('Permission de notification refusee');
        return false;
      }
    } catch (err) {
      setError('Erreur lors de la demande de permission');
      return false;
    }
  }, []);

  /**
   * Sauvegarder le token FCM dans Firestore
   * Remplace le token existant pour cet appareil au lieu d'ajouter un doublon
   */
  const saveToken = useCallback(async (fcmToken: string): Promise<void> => {
    if (!auth.currentUser) {
      setError('Utilisateur non connecte');
      return;
    }

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      const existingTokens: FCMToken[] = userDoc.data()?.fcmTokens || [];

      const deviceKey = getDeviceKey();

      // Remplacer le token existant pour cet appareil ou ajouter le nouveau
      const deviceId = getDeviceId(existingTokens);
      let updatedTokens: FCMToken[];

      if (deviceId !== null) {
        // Mettre a jour le token existant pour cet appareil
        updatedTokens = existingTokens.map((t, i) =>
          i === deviceId
            ? { ...t, token: fcmToken, updatedAt: new Date(), deviceInfo: { ...t.deviceInfo, lastSeen: new Date() } }
            : t
        );
      } else {
        // Nouvel appareil : ajouter
        updatedTokens = [
          ...existingTokens,
          {
            token: fcmToken,
            deviceInfo: {
              userAgent: navigator.userAgent,
              platform: 'web',
              deviceKey,
              lastSeen: new Date(),
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      }

      await updateDoc(userRef, {
        fcmTokens: updatedTokens,
        updatedAt: serverTimestamp(),
      });

      setToken(fcmToken);
    } catch (err: any) {
      if (err.code !== 'aborted') {
        console.error('[useFCM] Erreur sauvegarde token:', err);
        setError('Erreur lors de la sauvegarde du token');
      }
    }
  }, []);

  /**
   * Ecouter les messages en premier plan
   */
  const listenForMessages = useCallback(async () => {
    // Nettoyer l'ancien listener
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
   * Initialiser FCM et generer le token
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

    // Si deja charge depuis Firestore, juste ecouter les messages
    if (tokenLoadedRef.current) {
      await listenForMessages();
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
      } catch (swError) {
        throw new Error('Impossible d\'enregistrer le service worker');
      }

      // Generer le token FCM
      const fcmToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRegistration,
      });

      if (!fcmToken) {
        setError('Impossible de generer le token FCM');
        return;
      }

      // Sauvegarder (remplace ou ajoute, pas de doublon)
      await saveToken(fcmToken);

      // Ecouter les messages en premier plan
      await listenForMessages();
    } catch (err: any) {
      console.error('[useFCM] Erreur initialisation:', err);

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
   * Desactiver les notifications : supprime le token du device et de Firestore
   */
  const disableNotifications = useCallback(async (): Promise<void> => {
    try {
      const { messaging } = await import('@/lib/firebase');
      if (messaging) {
        await deleteToken(messaging);
      }

      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        const existingTokens: FCMToken[] = userDoc.data()?.fcmTokens || [];

        // Retirer le token de cet appareil
        const deviceId = getDeviceId(existingTokens);
        const remainingTokens = deviceId !== null
          ? existingTokens.filter((_, i) => i !== deviceId)
          : existingTokens;

        await updateDoc(userRef, {
          fcmTokens: remainingTokens,
          updatedAt: serverTimestamp(),
        });
      }

      setToken(null);
      tokenLoadedRef.current = false;
      localStorage.removeItem('fcm-permission-granted');
      localStorage.removeItem('notification-permission-dismissed');

      // Nettoyer le listener
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    } catch (err) {
      console.error('[useFCM] Erreur desactivation notifications:', err);
      setError('Erreur lors de la desactivation des notifications');
    }
  }, []);

  // Cleanup on unmount
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

// ===== Helper functions (hors React) =====

/**
 * Genere une cle unique pour l'appareil basee sur le platform + navigateur
 * Plus stable que le userAgent complet (resiste aux mises a jour de version)
 */
function getDeviceKey(): string {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  const platform = navigator.platform || 'unknown';

  // Extraire le navigateur principal
  let browser = 'unknown';
  if (ua.includes('Firefox')) browser = 'firefox';
  else if (ua.includes('Edg')) browser = 'edge';
  else if (ua.includes('Chrome')) browser = 'chrome';
  else if (ua.includes('Safari')) browser = 'safari';

  // Extraire l'OS
  let os = 'unknown';
  if (ua.includes('Windows')) os = 'windows';
  else if (ua.includes('Mac OS')) os = 'mac';
  else if (ua.includes('Android')) os = 'android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'ios';
  else if (ua.includes('Linux')) os = 'linux';

  return `${platform}:${os}:${browser}`;
}

/**
 * Trouve un token existant pour cet appareil dans la liste
 * Utilise un matching souple (deviceKey ou userAgent partiel)
 */
function findTokenForDevice(tokens: FCMToken[]): FCMToken | null {
  const currentDeviceKey = getDeviceKey();
  const currentUa = navigator.userAgent;

  // 1. Matching par deviceKey (si presente)
  const byDeviceKey = tokens.find(t =>
    t.deviceInfo?.platform === 'web' && t.deviceInfo?.deviceKey === currentDeviceKey
  );
  if (byDeviceKey) return byDeviceKey;

  // 2. Fallback : matching par userAgent exact (anciens tokens sans deviceKey)
  const byExactUa = tokens.find(t =>
    t.deviceInfo?.platform === 'web' && t.deviceInfo?.userAgent === currentUa
  );
  if (byExactUa) return byExactUa;

  // 3. Fallback : matching souple par navigateur + OS (extraits de l'UA)
  const currentBrowser = extractBrowser(currentUa);
  const currentOs = extractOs(currentUa);

  const byPartial = tokens.find(t => {
    if (t.deviceInfo?.platform !== 'web') return false;
    const tBrowser = extractBrowser(t.deviceInfo?.userAgent || '');
    const tOs = extractOs(t.deviceInfo?.userAgent || '');
    return tBrowser === currentBrowser && tOs === currentOs;
  });

  return byPartial || null;
}

/**
 * Trouve l'index du token pour cet appareil
 */
function getDeviceId(tokens: FCMToken[]): number | null {
  const currentDeviceKey = getDeviceKey();
  const currentUa = navigator.userAgent;

  // 1. Par deviceKey
  const idxByKey = tokens.findIndex(t =>
    t.deviceInfo?.platform === 'web' && t.deviceInfo?.deviceKey === currentDeviceKey
  );
  if (idxByKey !== -1) return idxByKey;

  // 2. Par userAgent exact
  const idxByUa = tokens.findIndex(t =>
    t.deviceInfo?.platform === 'web' && t.deviceInfo?.userAgent === currentUa
  );
  if (idxByUa !== -1) return idxByUa;

  // 3. Par navigateur + OS
  const currentBrowser = extractBrowser(currentUa);
  const currentOs = extractOs(currentUa);

  const idxByPartial = tokens.findIndex(t => {
    if (t.deviceInfo?.platform !== 'web') return false;
    const tBrowser = extractBrowser(t.deviceInfo?.userAgent || '');
    const tOs = extractOs(t.deviceInfo?.userAgent || '');
    return tBrowser === currentBrowser && tOs === currentOs;
  });

  return idxByPartial !== -1 ? idxByPartial : null;
}

function extractBrowser(ua: string): string {
  if (ua.includes('Firefox')) return 'firefox';
  if (ua.includes('Edg')) return 'edge';
  if (ua.includes('Chrome')) return 'chrome';
  if (ua.includes('Safari')) return 'safari';
  return 'unknown';
}

function extractOs(ua: string): string {
  if (ua.includes('Windows')) return 'windows';
  if (ua.includes('Mac OS')) return 'mac';
  if (ua.includes('Android')) return 'android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'ios';
  if (ua.includes('Linux')) return 'linux';
  return 'unknown';
}

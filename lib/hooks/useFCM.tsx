'use client';

/**
 * FCM (push notifications) — LOCAL NO-OP STUB.
 *
 * The real FCM was Firebase-backed (firebase/messaging + Firestore) and is not
 * yet migrated. To stop the Firebase errors on the Settings page (and anywhere
 * else FCMProvider/useFCM is used), this stub exposes the same API surface with
 * safe defaults + no-ops. Wire to a backend push endpoint later (FCM server key
 * + a /fcm-tokens endpoint) — until then notifications simply show as disabled.
 */
import { createContext, useContext, type ReactNode } from 'react';

interface FCMContextType {
  token: string | null;
  permissionStatus: NotificationPermission;
  loading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  initializeFCM: () => Promise<void>;
  disableNotifications: () => Promise<void>;
}

const noop = async () => {};
const defaultValue: FCMContextType = {
  token: null,
  permissionStatus: 'default',
  loading: false,
  error: null,
  requestPermission: async () => false,
  initializeFCM: noop,
  disableNotifications: noop,
};

const FCMContext = createContext<FCMContextType>(defaultValue);

export function FCMProvider({ children }: { children: ReactNode }) {
  return <FCMContext.Provider value={defaultValue}>{children}</FCMContext.Provider>;
}

export function useFCM() {
  return useContext(FCMContext);
}

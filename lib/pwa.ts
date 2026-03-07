/**
 * PWA Utilities for Omnigestion
 * Handles Service Worker registration and installation prompts
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let isInstallHandlerAttached = false;

/**
 * Register the Service Worker
 */
export async function registerSW(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Worker non supporté');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[PWA] Service Worker enregistré:', registration);

    // Écouter les mises à jour du SW
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Nouvelle version disponible
            console.log('[PWA] Nouvelle version disponible');
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      }
    });

    return true;
  } catch (error) {
    console.error('[PWA] Erreur d\'enregistrement du SW:', error);
    return false;
  }
}

/**
 * Check if the app is installed as PWA
 */
export function isPWAInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for display mode
  const isStandalone =
    (window.navigator as any).standalone ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches;

  return isStandalone;
}

/**
 * Listen for beforeinstallprompt event
 */
export function listenForInstallPrompt(callback: (prompt: () => Promise<void>) => void): () => void {
  if (typeof window === 'undefined' || isInstallHandlerAttached) {
    return () => {};
  }

  const handler = (e: Event) => {
    // Prevent default install prompt
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    console.log('[PWA] Install prompt capturé');

    // Call callback with prompt function
    callback(() => deferredPrompt?.prompt() ?? Promise.resolve());
  };

  window.addEventListener('beforeinstallprompt', handler);
  isInstallHandlerAttached = true;

  // Return cleanup function
  return () => {
    window.removeEventListener('beforeinstallprompt', handler);
    isInstallHandlerAttached = false;
  };
}

/**
 * Prompt user to install PWA
 */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) {
    console.warn('[PWA] Pas de prompt disponible');
    return false;
  }

  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('[PWA] Installation acceptée');
    } else {
      console.log('[PWA] Installation refusée');
    }

    deferredPrompt = null;
    return outcome === 'accepted';
  } catch (error) {
    console.error('[PWA] Erreur lors du prompt d\'installation:', error);
    return false;
  }
}

/**
 * Check if install prompt is available
 */
export function canInstall(): boolean {
  return deferredPrompt !== null;
}

/**
 * Skip waiting for new Service Worker
 */
export function skipWaiting(): void {
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    });
  }
}

/**
 * Add URLs to cache
 */
export async function cacheUrls(urls: string[]): Promise<void> {
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'CACHE_URLS', urls });
  }
}

/**
 * Get Service Worker registration info
 */
export async function getSWInfo(): Promise<{
  active: boolean;
  waiting: boolean;
  updateAvailable: boolean;
} | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();

    if (!registration) {
      return { active: false, waiting: false, updateAvailable: false };
    }

    return {
      active: !!registration.active,
      waiting: !!registration.waiting,
      updateAvailable: !!registration.waiting,
    };
  } catch (error) {
    console.error('[PWA] Erreur lors de la récupération des infos SW:', error);
    return null;
  }
}

/**
 * Clear all caches
 */
export async function clearCaches(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map((cacheName) => caches.delete(cacheName))
    );
    console.log('[PWA] Tous les caches ont été supprimés');
  } catch (error) {
    console.error('[PWA] Erreur lors de la suppression des caches:', error);
  }
}

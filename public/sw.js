// Omnigestion Service Worker
// Cache des assets statiques uniquement - PAS de cache Firestore/API
// v6: Ne pas intercepter les requêtes Firebase (évite les erreurs hors ligne)

const CACHE_NAME = 'omnigestion-v6';
const STATIC_CACHE = 'omnigestion-static-v6';

// Assets à mettre en cache statique (pages, JS, CSS, images)
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/offline',
  '/manifest.json',
  // Les icônes seront ajoutées automatiquement lors de l'installation
];

// Assets à ne JAMAIS cacher (Firestore, API, IndexedDB)
const DYNAMIC_PATTERNS = [
  /\/_next\/data\/.*/, // Next.js data requests
  /\/api\/.*/, // API routes (sauf si spécifié ailleurs)
  /firebaseio\.com/, // Firebase Realtime Database
  /firestore\.googleapis\.com/, // Firestore API
  /googleapis\.com\/identitytoolkit/, // Firebase Auth
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installation');

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Mise en cache des assets statiques');
      return cache.addAll(STATIC_ASSETS);
    })
  );

  self.skipWaiting();
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Supprimer les anciens caches
          if (cacheName !== STATIC_CACHE && cacheName !== CACHE_NAME) {
            console.log('[SW] Suppression de l\'ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// Stratégie de cache pour les requêtes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // NE PAS intercepter les requêtes Firestore/API
  // Ne PAS utiliser event.respondWith() - laisser le navigateur gérer directement
  if (shouldBypassCache(url)) {
    // Ne rien faire - laisser passer la requête normalement sans interception
    return;
  }

  // Pour les assets statiques (_next/static/, icons, etc.) : Cache First
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request).then((response) => {
          // Mettre en cache les assets statiques
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          // Fallback pour les assets statiques - retourner une réponse vide ou placeholder
          return new Response('Asset non disponible', { status: 503 });
        });
      })
    );
    return;
  }

  // Pour les pages HTML : Cache First (permet navigation hors ligne)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request).then((cached) => {
        // Servir depuis le cache si disponible (rapide et fonctionne offline)
        if (cached) {
          // Mettre à jour en arrière-plan (stale-while-revalidate)
          fetch(request).then((response) => {
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
          }).catch(() => {
            // Ignorer les erreurs de fetch en arrière-plan
          });
          return cached;
        }

        // Pas dans le cache : aller sur le réseau
        return fetch(request)
          .then((response) => {
            // Mettre en cache pour la prochaine fois
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Hors ligne et page non visitée auparavant
            // Retourner le dashboard depuis le cache comme fallback (page principale pour les utilisateurs connectés)
            return caches.match('/dashboard').then((dashboardPage) => {
              if (dashboardPage) {
                return dashboardPage;
              }
              // Fallback vers la racine si dashboard pas dispo
              return caches.match('/').then((homePage) => {
                if (homePage) {
                  return homePage;
                }
                // Dernier recours : page offline
                return caches.match('/offline').then((offlinePage) => {
                  return offlinePage || new Response('Application non disponible hors ligne pour le moment', { status: 503 });
                });
              });
            });
          });
      })
    );
    return;
  }

  // Par défaut : Network First
  event.respondWith(
    fetch(request)
      .then((response) => response)
      .catch(() => caches.match(request))
  );
});

// Vérifier si une URL doit contourner le cache
function shouldBypassCache(url) {
  return DYNAMIC_PATTERNS.some(pattern => pattern.test(url.href));
}

// Vérifier si c'est un asset statique
function isStaticAsset(url) {
  // Assets Next.js statiques et dynamiques (chunks, JS, CSS)
  if (url.pathname.startsWith('/_next/')) {
    return true;
  }

  // Images et icônes locales
  if (url.pathname.startsWith('/icons/') ||
      url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico)$/)) {
    return true;
  }

  // Fichiers JavaScript et CSS
  if (url.pathname.match(/\.(js|css)$/)) {
    return true;
  }

  // Cloudinary images (logo uploadé dans les paramètres, etc.)
  if (url.hostname.includes('res.cloudinary.com') ||
      url.href.includes('res.cloudinary.com')) {
    return true;
  }

  // Manifeste
  if (url.pathname === '/manifest.json') {
    return true;
  }

  return false;
}

// ===== NOTIFICATIONS PUSH FCM =====

// Gérer les événements push entrants (notifications reçues en arrière-plan)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  console.log('[SW] Notification push reçue:', data);

  const options = {
    body: data.notification?.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [200, 100, 200],
    tag: data.data?.type || 'default',
    data: data.data || {},
    actions: [
      {
        action: 'view',
        title: 'Voir',
        icon: '/icons/icon-96x96.png',
      },
      {
        action: 'close',
        title: 'Fermer',
        icon: '/icons/icon-96x96.png',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.notification?.title || 'Notification', options)
  );
});

// Gérer les clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification cliquée:', event);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Action par défaut ou "Voir"
  const data = event.notification.data;
  let url = '/dashboard';

  // Navigation selon le type de notification
  if (data.type === 'sale' && data.invoiceId) {
    url = `/sales/print/${data.invoiceId}`;
  } else if ((data.type === 'stock' || data.type === 'stock_low' || data.type === 'stock_out') && data.productId) {
    url = '/stock';
  }

  event.waitUntil(
    clients.openWindow(url).then((window) => {
      if (window) {
        window.focus();
      }
    })
  );
});

// Écouter les messages du client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

// Omnigestion Service Worker
// Pass-through : pas de caching, juste PWA install + push notifications
// v33

const CACHE_VERSION = "omnigestion-v33";

// Installation
self.addEventListener("install", () => {
  console.log("[SW] Installation", CACHE_VERSION);
  self.skipWaiting();
});

// Activation : nettoyer les anciens caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activation", CACHE_VERSION);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log("[SW] Suppression du cache:", cacheName);
          return caches.delete(cacheName);
        }),
      );
    }),
  );

  self.clients.claim();
});

// ===== NOTIFICATIONS PUSH FCM =====

self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  console.log("[SW] Notification push reçue:", data);

  const options = {
    body: data.notification?.body || "",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-96x96.png",
    vibrate: [200, 100, 200],
    tag: data.data?.type || "default",
    data: data.data || {},
    actions: [
      {
        action: "view",
        title: "Voir",
        icon: "/icons/icon-96x96.png",
      },
      {
        action: "close",
        title: "Fermer",
        icon: "/icons/icon-96x96.png",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(
      data.notification?.title || "Notification",
      options,
    ),
  );
});

// Gérer les clics sur les notifications
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification cliquée:", event);

  event.notification.close();

  if (event.action === "close") {
    return;
  }

  const data = event.notification.data;
  let url = "/dashboard";

  if (data.type === "sale" && data.invoiceId) {
    url = `/sales/print/${data.invoiceId}`;
  } else if (
    (data.type === "stock" ||
      data.type === "stock_low" ||
      data.type === "stock_out") &&
    data.productId
  ) {
    url = "/stock";
  }

  event.waitUntil(
    clients.openWindow(url).then((windowClient) => {
      if (windowClient) {
        windowClient.focus();
      }
    }),
  );
});

// Écouter les messages du client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

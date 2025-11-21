/**
 * Optimized Service Worker for Mobile Performance
 *
 * Features:
 * - Aggressive caching for static assets
 * - Network-first for API calls with fallback
 * - Stale-while-revalidate for dynamic content
 * - Background sync for offline mutations
 * - Intelligent cache cleanup
 */

// Cache versions - increment to bust cache
const CACHE_VERSION = 'v2';
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

// Cache size limits
const MAX_DYNAMIC_CACHE_SIZE = 50;
const MAX_API_CACHE_SIZE = 100;
const MAX_IMAGE_CACHE_SIZE = 100;

// App shell files to precache
const APP_SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/lovable-uploads/2f12a6ef-587b-4049-ad53-d83fb94064e3.png'
];

// Static assets patterns (regex)
const STATIC_ASSET_PATTERNS = [
  /\.js$/,
  /\.css$/,
  /\.woff2?$/,
  /\.ttf$/,
  /\.eot$/
];

// Image patterns
const IMAGE_PATTERNS = [
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.gif$/,
  /\.webp$/,
  /\.svg$/,
  /\.ico$/
];

// API patterns (Supabase and other APIs)
const API_PATTERNS = [
  /supabase\.co\/rest/,
  /supabase\.co\/storage/,
  /api\./
];

const hostname = new URL(self.location.href).hostname;
const isDevHost =
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname.endsWith('.github.dev');

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Limit cache size by removing oldest entries
 */
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxItems) {
    const keysToDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

/**
 * Check if URL matches any pattern in list
 */
function matchesPattern(url, patterns) {
  return patterns.some(pattern => pattern.test(url));
}

/**
 * Get appropriate cache name for request
 */
function getCacheNameForRequest(request) {
  const url = request.url;

  if (matchesPattern(url, STATIC_ASSET_PATTERNS)) {
    return STATIC_CACHE;
  }
  if (matchesPattern(url, IMAGE_PATTERNS)) {
    return IMAGE_CACHE;
  }
  if (matchesPattern(url, API_PATTERNS)) {
    return API_CACHE;
  }
  return DYNAMIC_CACHE;
}

/**
 * Broadcast message to all clients
 */
self.broadcastToClients = async (type, data) => {
  try {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const message = { source: 'sw', type, data, ts: Date.now() };
    for (const client of windows) {
      try {
        client.postMessage(message);
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // ignore
  }
};

// ============================================
// CACHING STRATEGIES
// ============================================

/**
 * Cache-first strategy for static assets
 */
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network-first strategy with cache fallback
 */
async function networkFirst(request, cacheName, timeout = 5000) {
  const cache = await caches.open(cacheName);

  try {
    // Race between network and timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const networkResponse = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Stale-while-revalidate strategy
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await caches.match(request);

  // Start network fetch in background
  const networkFetch = fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Return cached response immediately, or wait for network
  return cachedResponse || networkFetch;
}

// ============================================
// INSTALL EVENT
// ============================================

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Precache app shell
      if (!isDevHost) {
        const cache = await caches.open(APP_SHELL_CACHE);
        await cache.addAll(APP_SHELL_FILES);
      }

      // Skip waiting to activate immediately
      await self.skipWaiting();
    })()
  );
});

// ============================================
// ACTIVATE EVENT
// ============================================

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      const currentCaches = [APP_SHELL_CACHE, STATIC_CACHE, DYNAMIC_CACHE, API_CACHE, IMAGE_CACHE];

      await Promise.all(
        cacheNames
          .filter(name => !currentCaches.includes(name))
          .map(name => caches.delete(name))
      );

      // Take control of all pages immediately
      await self.clients.claim();

      // Notify clients about update
      await self.broadcastToClients('sw-activated', { version: CACHE_VERSION });
    })()
  );
});

// ============================================
// FETCH EVENT
// ============================================

self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip dev mode
  if (isDevHost) {
    return;
  }

  const url = new URL(event.request.url);

  // Skip WebSocket and chrome-extension requests
  if (url.protocol === 'ws:' || url.protocol === 'wss:' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Skip Supabase realtime
  if (url.pathname.includes('/realtime/')) {
    return;
  }

  event.respondWith(
    (async () => {
      const cacheName = getCacheNameForRequest(event.request);

      // Static assets: Cache-first (they have hashes in filenames)
      if (matchesPattern(event.request.url, STATIC_ASSET_PATTERNS)) {
        return cacheFirst(event.request, cacheName);
      }

      // Images: Cache-first with trimming
      if (matchesPattern(event.request.url, IMAGE_PATTERNS)) {
        const response = await cacheFirst(event.request, cacheName);
        // Trim cache in background
        trimCache(IMAGE_CACHE, MAX_IMAGE_CACHE_SIZE);
        return response;
      }

      // API calls: Network-first with short timeout
      if (matchesPattern(event.request.url, API_PATTERNS)) {
        const response = await networkFirst(event.request, cacheName, 3000);
        // Trim cache in background
        trimCache(API_CACHE, MAX_API_CACHE_SIZE);
        return response;
      }

      // Navigation requests: Network-first
      if (event.request.mode === 'navigate') {
        try {
          const response = await fetch(event.request);
          return response;
        } catch (error) {
          // Offline: serve app shell
          const cachedResponse = await caches.match('/index.html');
          if (cachedResponse) {
            return cachedResponse;
          }
          return caches.match('/');
        }
      }

      // Everything else: Stale-while-revalidate
      const response = await staleWhileRevalidate(event.request, cacheName);
      trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE);
      return response;
    })()
  );
});

// ============================================
// PUSH NOTIFICATIONS
// ============================================

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    console.log('[sw] push event received', { hasData: !!event.data });
    payload = event.data ? event.data.json() : {};
    console.log('[sw] push payload', payload);
    event.waitUntil(self.broadcastToClients('push-received', payload));
  } catch (error) {
    console.error('Unable to parse push payload', error);
  }

  // Handle app badge
  const deriveBadgeDetails = () => {
    const badgeSources = [
      payload.badgeCount,
      payload.unreadCount,
      payload.badge,
      payload?.meta?.badgeCount,
      payload?.meta?.unreadCount,
      payload?.meta?.badge,
    ];

    for (const candidate of badgeSources) {
      if (typeof candidate === 'number') {
        if (Number.isFinite(candidate) && candidate > 0) {
          return { type: 'count', value: Math.floor(candidate) };
        }
        if (candidate === 0) {
          return { type: 'clear' };
        }
      }
      if (typeof candidate === 'string') {
        const normalized = candidate.toLowerCase();
        if (normalized === 'dot') {
          return { type: 'dot' };
        }
        if (normalized === 'clear' || normalized === 'none') {
          return { type: 'clear' };
        }
      }
    }
    return null;
  };

  const badgeDetails = deriveBadgeDetails();

  if (badgeDetails && (self.registration.setAppBadge || self.registration.clearAppBadge)) {
    event.waitUntil(
      (async () => {
        try {
          if (badgeDetails.type === 'count' && self.registration.setAppBadge) {
            await self.registration.setAppBadge(badgeDetails.value);
            return;
          }
          if (badgeDetails.type === 'dot' && self.registration.setAppBadge) {
            await self.registration.setAppBadge();
            return;
          }
          if (self.registration.clearAppBadge) {
            await self.registration.clearAppBadge();
            return;
          }
          if (self.registration.setAppBadge) {
            await self.registration.setAppBadge(0);
          }
        } catch (error) {
          console.warn('[sw] Unable to update app badge', error);
        }
      })()
    );
  }

  const title = payload.title || 'Update';
  const options = {
    body: payload.body || '',
    icon: '/lovable-uploads/2f12a6ef-587b-4049-ad53-d83fb94064e3.png',
    badge: '/lovable-uploads/2f12a6ef-587b-4049-ad53-d83fb94064e3.png',
    data: {
      url: payload.url || '/',
      type: payload.type,
      meta: payload.meta || {}
    },
    actions: [{ action: 'open', title: 'Open' }],
    tag: payload.meta?.tag || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    renotify: true,
    silent: false,
  };

  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(title, options);
        console.log('[sw] notification shown');
        await self.broadcastToClients('notification-shown', { title, options });
      } catch (err) {
        console.error('[sw] showNotification failed', err);
        await self.broadcastToClients('notification-error', { error: String(err) });
      }
    })()
  );
});

// ============================================
// PUSH SUBSCRIPTION CHANGE
// ============================================

self.addEventListener('pushsubscriptionchange', (event) => {
  console.warn('[sw] pushsubscriptionchange event', event);
  event.waitUntil(self.broadcastToClients('pushsubscriptionchange', {}));
});

// ============================================
// NOTIFICATION CLICK
// ============================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      const absoluteTarget = new URL(targetUrl, self.location.origin).toString();
      const existingWindow = windows.find((windowClient) => {
        const url = new URL(windowClient.url);
        url.hash = '';
        url.search = '';
        return url.toString() === absoluteTarget;
      });

      if (existingWindow) {
        await self.broadcastToClients('notification-click', { url: targetUrl, reused: true });
        return existingWindow.focus();
      }

      await self.broadcastToClients('notification-click', { url: targetUrl, reused: false });
      return clients.openWindow(targetUrl);
    })()
  );
});

// ============================================
// MESSAGE HANDLER
// ============================================

self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};

  // Test notification
  if (type === 'sw:show-test') {
    event.waitUntil(
      (async () => {
        try {
          await self.registration.showNotification(data?.title || 'SW test', {
            body: data?.body || 'Local SW notification',
          });
          await self.broadcastToClients('test-notification-shown', {});
        } catch (e) {
          await self.broadcastToClients('test-notification-error', { error: String(e) });
        }
      })()
    );
  }

  // Ping/pong for health check
  else if (type === 'sw:ping') {
    event.source?.postMessage({ source: 'sw', type: 'sw:pong', ts: Date.now() });
  }

  // Force cache clear
  else if (type === 'sw:clear-cache') {
    event.waitUntil(
      (async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        await self.broadcastToClients('cache-cleared', {});
      })()
    );
  }

  // Precache specific URLs
  else if (type === 'sw:precache') {
    event.waitUntil(
      (async () => {
        const urls = data?.urls || [];
        const cache = await caches.open(DYNAMIC_CACHE);
        await cache.addAll(urls);
        await self.broadcastToClients('precache-complete', { urls });
      })()
    );
  }

  // Get cache stats
  else if (type === 'sw:cache-stats') {
    event.waitUntil(
      (async () => {
        const stats = {};
        const cacheNames = await caches.keys();

        for (const name of cacheNames) {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          stats[name] = keys.length;
        }

        event.source?.postMessage({
          source: 'sw',
          type: 'sw:cache-stats-response',
          data: stats,
          ts: Date.now()
        });
      })()
    );
  }
});

// ============================================
// PERIODIC BACKGROUND SYNC (if supported)
// ============================================

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'refresh-data') {
    event.waitUntil(
      (async () => {
        // Notify app to refresh data
        await self.broadcastToClients('periodic-sync', { tag: event.tag });
      })()
    );
  }
});

// ============================================
// BACKGROUND SYNC (if supported)
// ============================================

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-mutations') {
    event.waitUntil(
      (async () => {
        // Notify app to process offline queue
        await self.broadcastToClients('background-sync', { tag: event.tag });
      })()
    );
  }
});

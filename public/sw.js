// Build version - changes with every deployment to ensure iOS detects updates
// This ensures byte-difference in sw.js file, which is critical for iOS
const BUILD_VERSION = '__BUILD_TIMESTAMP__' // Will be replaced at build time

// Dynamic cache version that changes with each SW update
// This ensures old caches are cleared when deploying new versions
const CACHE_VERSION = 'v3-' + BUILD_VERSION + '-' + self.registration.scope
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`
// Hashed build assets (/assets/*) are immutable: the same URL always holds the
// same bytes. They live in an unversioned cache that survives deploys, so a
// chunk downloaded before an update still loads offline afterwards.
const ASSET_CACHE = `assets-v1-${self.registration.scope}`
const ASSET_CACHE_MAX_ENTRIES = 400

// Code needed to open the app shell, festival management, artist management and
// the tech app with no connection. Filled in at build time from the Vite manifest
// by scripts/inject-sw-version.mjs; empty in development.
const PRECACHE_ASSETS = [] /* __PRECACHE_ASSETS__ */
const PRECACHE_CONCURRENCY = 6

const APP_SHELL_FILES = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png'
]

const hostname = new URL(self.location.href).hostname
const isDevHost =
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname.endsWith('.github.dev')

const HTML_TIMEOUT_MS = 3000
const RUNTIME_CACHE_MAX_ENTRIES = 180

self.trimRuntimeCache = async (cache, maxEntries = RUNTIME_CACHE_MAX_ENTRIES) => {
  try {
    const keys = await cache.keys()
    if (keys.length <= maxEntries) return

    const staleKeys = keys.slice(0, keys.length - maxEntries)
    await Promise.all(staleKeys.map((key) => cache.delete(key)))
  } catch (e) {
    console.warn('[sw] Failed to trim runtime cache:', e)
  }
}

self.isHashedAsset = (url) => url.origin === self.location.origin && url.pathname.startsWith('/assets/')

// Best effort: an asset that fails to download must not block the update, it is
// fetched again on demand. Assets already cached (unchanged since the previous
// deploy) are not downloaded again.
self.precacheAssets = async () => {
  if (PRECACHE_ASSETS.length === 0) return
  const cache = await caches.open(ASSET_CACHE)
  const queue = [...PRECACHE_ASSETS]
  const worker = async () => {
    while (queue.length > 0) {
      const path = queue.shift()
      try {
        const existing = await cache.match(path)
        if (existing) {
          // Re-insert so trimming (oldest first) never evicts code the current
          // build still needs ahead of leftovers from older deploys.
          await cache.put(path, existing)
          continue
        }
        const response = await fetch(path, { cache: 'no-cache' })
        const contentType = response.headers.get('content-type') || ''
        if (response.ok && response.type === 'basic' && !contentType.includes('text/html')) {
          await cache.put(path, response)
        }
      } catch (e) {
        console.warn('[sw] Failed to precache asset:', path, e)
      }
    }
  }
  await Promise.all(Array.from({ length: PRECACHE_CONCURRENCY }, worker))
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (!isDevHost) {
        const cache = await caches.open(APP_SHELL_CACHE)
        await cache.addAll(APP_SHELL_FILES)
        await self.precacheAssets()
      }

      await self.skipWaiting()
    })()
  )
})

self.broadcastToClients = async (type, data) => {
  try {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const message = { source: 'sw', type, data, ts: Date.now() }
    for (const client of windows) {
      try {
        client.postMessage(message)
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // ignore
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      console.log('[sw] Activating service worker, build version:', BUILD_VERSION);

      if (!isDevHost) {
        // Clear ALL old caches to prevent stale asset issues after deployment
        const keys = await caches.keys()
        const currentCaches = [APP_SHELL_CACHE, RUNTIME_CACHE, ASSET_CACHE]
        await Promise.all(
          keys
            .filter((key) => !currentCaches.includes(key))
            .map((key) => {
              console.log('[sw] Deleting old cache:', key)
              return caches.delete(key)
            })
        )
      }

      await self.clients.claim()

      // Notify clients that a new SW has activated
      await self.broadcastToClients('sw-activated', {
        cacheVersion: CACHE_VERSION,
        buildVersion: BUILD_VERSION
      })
    })()
  )
})

self.addEventListener('fetch', (event) => {
  if (isDevHost || event.request.method !== 'GET') {
    return
  }

  const { request } = event
  const url = new URL(request.url)

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return
  }

  // Network-first strategy for HTML/navigation requests.
  // Serving stale HTML can cause chunk hash mismatches after a new deploy, so we
  // always attempt the network first and only fall back to cache when offline.
  if (request.mode === 'navigate' || request.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE)
        const storeHtml = (response) => {
          if (response && response.ok) {
            cache.put(request, response.clone()).catch((e) => {
              console.warn('[sw] Failed to cache HTML response:', e)
            })
          }
          return response
        }
        const cachedShell = async () =>
          (await cache.match(request)) || (await caches.match('/'))

        // One network request, raced against a timeout. On a connection that
        // reports "online" but cannot move data (venues, one signal bar) the
        // request can hang for minutes, so after the timeout the cached shell is
        // served and the request keeps running in the background to refresh it.
        const networkPromise = fetch(request).then(storeHtml)
        event.waitUntil(networkPromise.catch(() => undefined))

        let timeoutId
        const timedOut = new Promise((resolve) => {
          timeoutId = setTimeout(() => resolve('timeout'), HTML_TIMEOUT_MS)
        })
        try {
          const first = await Promise.race([networkPromise, timedOut])
          if (first !== 'timeout') return first
          const cached = await cachedShell()
          if (cached) return cached
          // Nothing cached yet (first visit): keep waiting for the network.
          return await networkPromise
        } catch {
          const cached = await cachedShell()
          return cached || new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          })
        } finally {
          clearTimeout(timeoutId)
        }
      })()
    )
    return
  }

  // Cache-first strategy for static assets (JS, CSS, images, fonts)
  // These have content hashes in their filenames, so safe to cache aggressively
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      // Not in cache, fetch from network and cache it
      return fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }

          // Detect stale SPA fallback: Cloudflare returned HTML for a JS/CSS/font asset.
          // This happens when a chunk hash no longer exists on the CDN after a deploy.
          // Return a 404 so the browser rejects the module load and triggers auto-reload.
          const contentType = response.headers.get('content-type') || ''
          const isAssetPath =
            url.pathname.startsWith('/assets/') ||
            url.pathname.endsWith('.js') ||
            url.pathname.endsWith('.css')
          if (isAssetPath && contentType.includes('text/html')) {
            console.warn('[sw] HTML response intercepted for asset:', url.pathname, '— stale SPA fallback detected')
            return new Response(null, { status: 404, statusText: 'Stale Asset' })
          }

          // Clone the response to cache it
          const responseToCache = response.clone()
          const targetCache = self.isHashedAsset(url) ? ASSET_CACHE : RUNTIME_CACHE
          caches.open(targetCache).then((cache) => {
            cache.put(request, responseToCache).then(() => {
              self.trimRuntimeCache(cache, targetCache === ASSET_CACHE ? ASSET_CACHE_MAX_ENTRIES : RUNTIME_CACHE_MAX_ENTRIES)
            }).catch((e) => {
              console.warn('[sw] Failed to cache asset response:', e)
            })
          }).catch((e) => {
            console.warn('[sw] Failed to open cache for assets:', e)
          })

          return response
        })
        .catch(() => {
          // Network failed - return appropriate response based on request type
          const destination = request.destination

          // For navigation/document requests, return cached HTML fallback
          if (request.mode === 'navigate' || destination === 'document') {
            return caches.match('/').then(fallback => {
              return fallback || new Response('Offline', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' }
              })
            })
          }

          // For other requests (JS, CSS, images, fonts), return network error
          // This allows the browser to handle the failure appropriately
          // (e.g., trigger onerror events, show broken image icons, etc.)
          console.warn('[sw] Network failed for asset:', request.url)
          return new Response(null, {
            status: 408,
            statusText: 'Request Timeout'
          })
        })
    })
  )
})

self.addEventListener('push', (event) => {
  let payload = {}

  try {
    // Basic visibility into push delivery
    console.log('[sw] push event received', { hasData: !!event.data })
    payload = event.data ? event.data.json() : {}
    console.log('[sw] push payload', payload)
    event.waitUntil(self.broadcastToClients('push-received', payload))
  } catch (error) {
    console.error('Unable to parse push payload', error)
  }

  const deriveBadgeDetails = () => {
    const badgeSources = [
      payload.badgeCount,
      payload.unreadCount,
      payload.badge,
      payload?.meta?.badgeCount,
      payload?.meta?.unreadCount,
      payload?.meta?.badge,
    ]

    for (const candidate of badgeSources) {
      if (typeof candidate === 'number') {
        if (Number.isFinite(candidate) && candidate > 0) {
          return { type: 'count', value: Math.floor(candidate) }
        }

        if (candidate === 0) {
          return { type: 'clear' }
        }
      }

      if (typeof candidate === 'string') {
        const normalized = candidate.toLowerCase()
        if (normalized === 'dot') {
          return { type: 'dot' }
        }
        if (normalized === 'clear' || normalized === 'none') {
          return { type: 'clear' }
        }
      }
    }

    return null
  }

  const badgeDetails = deriveBadgeDetails()

  if (badgeDetails && (self.registration.setAppBadge || self.registration.clearAppBadge)) {
    event.waitUntil(
      (async () => {
        try {
          if (badgeDetails.type === 'count' && self.registration.setAppBadge) {
            await self.registration.setAppBadge(badgeDetails.value)
            return
          }

          if (badgeDetails.type === 'dot' && self.registration.setAppBadge) {
            await self.registration.setAppBadge()
            return
          }

          if (self.registration.clearAppBadge) {
            await self.registration.clearAppBadge()
            return
          }

          if (self.registration.setAppBadge) {
            await self.registration.setAppBadge(0)
          }
        } catch (error) {
          console.warn('[sw] Unable to update app badge', error)
        }
      })()
    )
  }

  const title = payload.title || 'Nueva actualización'
  const options = {
    body: payload.body || '',
    icon: '/lovable-uploads/2f12a6ef-587b-4049-ad53-d83fb94064e3.png',
    badge: '/lovable-uploads/2f12a6ef-587b-4049-ad53-d83fb94064e3.png',
    data: {
      url: payload.url || '/',
      type: payload.type,
      meta: payload.meta || {}
    },
    actions: [{ action: 'open', title: 'Abrir' }],
    tag: payload.meta?.tag || payload.eventKey || payload.type || 'sector-pro',
    renotify: payload.meta?.renotify === true,
    silent: false,
  }

  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(title, options)
        console.log('[sw] notification shown')
        await self.broadcastToClients('notification-shown', { title, options })
      } catch (err) {
        console.error('[sw] showNotification failed', err)
        await self.broadcastToClients('notification-error', { error: String(err) })
      }
    })()
  )
})

// Helpful for diagnosing expiration/rotation issues on some browsers
self.addEventListener('pushsubscriptionchange', (event) => {
  console.warn('[sw] pushsubscriptionchange event', event)
  event.waitUntil(self.broadcastToClients('pushsubscriptionchange', {}))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const requestedUrl = event.notification.data?.url || '/'

  event.waitUntil(
    (async () => {
      let targetUrl = '/'
      try {
        const parsedTarget = new URL(requestedUrl, self.location.origin)
        if (
          typeof requestedUrl === 'string' &&
          parsedTarget.origin === self.location.origin &&
          !/[\\\u0000-\u001f\u007f]/.test(requestedUrl)
        ) {
          targetUrl = `${parsedTarget.pathname}${parsedTarget.search}${parsedTarget.hash}`
        }
      } catch (error) {
        console.warn('[sw] Rejected invalid notification URL', error)
      }
      const windows = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      })
      const absoluteTarget = new URL(targetUrl, self.location.origin).toString()
      const existingWindow = windows.find((windowClient) => windowClient.url === absoluteTarget)
      const reusableWindow = existingWindow || windows.find((windowClient) => {
        try {
          return new URL(windowClient.url).origin === self.location.origin
        } catch {
          return false
        }
      })

      if (reusableWindow) {
        await self.broadcastToClients('notification-click', { url: targetUrl, reused: true })
        if (reusableWindow.url !== absoluteTarget && reusableWindow.navigate) {
          await reusableWindow.navigate(targetUrl)
        }
        return reusableWindow.focus()
      }

      await self.broadcastToClients('notification-click', { url: targetUrl, reused: false })
      return clients.openWindow(targetUrl)
    })()
  )
})

// Allow page to invoke simple test notifications and ping
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {}
  if (type === 'SKIP_WAITING') {
    // Allow the page to trigger immediate activation of a waiting service worker
    self.skipWaiting()
  } else if (type === 'sw:show-test') {
    event.waitUntil(
      (async () => {
        try {
          await self.registration.showNotification(data?.title || 'Prueba local', {
            body: data?.body || 'Notificación local del service worker',
          })
          await self.broadcastToClients('test-notification-shown', {})
        } catch (e) {
          await self.broadcastToClients('test-notification-error', { error: String(e) })
        }
      })()
    )
  } else if (type === 'sw:ping') {
    event.source?.postMessage({ source: 'sw', type: 'sw:pong', ts: Date.now() })
  } else if (type === 'CLEAR_CACHES') {
    // Called by the app when a chunk load error is detected so the next reload
    // fetches all assets fresh from the network.
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => {
          event.source?.postMessage({ source: 'sw', type: 'CLEAR_CACHES_DONE', ts: Date.now() })
        })
        .catch((e) => {
          console.error('[sw] Failed to clear caches:', e)
          event.source?.postMessage({ source: 'sw', type: 'CLEAR_CACHES_ERROR', error: String(e), ts: Date.now() })
        })
    )
  }
})

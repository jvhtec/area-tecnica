// Dynamic cache version that changes with each SW update
// This ensures old caches are cleared when deploying new versions
const CACHE_VERSION = 'v2-' + self.registration.scope
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`

const APP_SHELL_FILES = [
  '/manifest.json',
  '/lovable-uploads/2f12a6ef-587b-4049-ad53-d83fb94064e3.png'
]

const hostname = new URL(self.location.href).hostname
const isDevHost =
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname.endsWith('.github.dev')

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (!isDevHost) {
        const cache = await caches.open(APP_SHELL_CACHE)
        await cache.addAll(APP_SHELL_FILES)
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
      if (!isDevHost) {
        // Clear ALL old caches to prevent stale asset issues after deployment
        const keys = await caches.keys()
        const currentCaches = [APP_SHELL_CACHE, RUNTIME_CACHE]
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
      await self.broadcastToClients('sw-activated', { cacheVersion: CACHE_VERSION })
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

  // Network-first strategy for HTML/navigation requests
  // This ensures users always get the latest HTML after deployment
  if (request.mode === 'navigate' || request.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response to cache it
          const responseToCache = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache).catch((e) => {
              console.warn('[sw] Failed to cache HTML response:', e)
            })
          }).catch((e) => {
            console.warn('[sw] Failed to open cache for HTML:', e)
          })
          return response
        })
        .catch(() => {
          // Offline fallback: serve cached HTML if available
          return caches.match(request).then((cached) => {
            return cached || caches.match('/')
          })
        })
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

          // Clone the response to cache it
          const responseToCache = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache).catch((e) => {
              console.warn('[sw] Failed to cache asset response:', e)
            })
          }).catch((e) => {
            console.warn('[sw] Failed to open cache for assets:', e)
          })

          return response
        })
        .catch(() => {
          // Network failed, try to serve offline fallback
          return caches.match('/')
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

  const title = payload.title || 'Update'
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
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      })
      const absoluteTarget = new URL(targetUrl, self.location.origin).toString()
      const existingWindow = windows.find((windowClient) => {
        const url = new URL(windowClient.url)
        url.hash = ''
        url.search = ''
        return url.toString() === absoluteTarget
      })

      if (existingWindow) {
        await self.broadcastToClients('notification-click', { url: targetUrl, reused: true })
        return existingWindow.focus()
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
          await self.registration.showNotification(data?.title || 'SW test', {
            body: data?.body || 'Local SW notification',
          })
          await self.broadcastToClients('test-notification-shown', {})
        } catch (e) {
          await self.broadcastToClients('test-notification-error', { error: String(e) })
        }
      })()
    )
  } else if (type === 'sw:ping') {
    event.source?.postMessage({ source: 'sw', type: 'sw:pong', ts: Date.now() })
  }
})

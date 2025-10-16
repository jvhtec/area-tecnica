const APP_SHELL_CACHE = 'app-shell-v1'
const APP_SHELL_FILES = [
  '/',
  '/index.html',
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

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (!isDevHost) {
        const keys = await caches.keys()
        await Promise.all(
          keys
            .filter((key) => key !== APP_SHELL_CACHE)
            .map((key) => caches.delete(key))
        )
      }

      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  if (isDevHost || event.request.method !== 'GET') {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(event.request).catch(() => caches.match('/'))
    })
  )
})

self.addEventListener('push', (event) => {
  let payload = {}

  try {
    payload = event.data ? event.data.json() : {}
  } catch (error) {
    console.error('Unable to parse push payload', error)
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
    actions: [{ action: 'open', title: 'Open' }]
  }

  event.waitUntil(self.registration.showNotification(title, options))
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
        return existingWindow.focus()
      }

      return clients.openWindow(targetUrl)
    })()
  )
})

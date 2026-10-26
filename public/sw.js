const CACHE_NAME = 'financie-offline-v2'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.add(OFFLINE_URL)
      await self.skipWaiting()
    }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      await self.clients.claim()
    }),
  )
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload = null
  try {
    payload = event.data.json()
  } catch {
    const text = event.data.text()
    payload = { title: 'Financie', body: text, url: '/finance/snapshots' }
  }

  const title = payload?.title || 'Financie'
  const options = {
    body: payload?.body || '',
    icon: '/tomag-icon.svg',
    badge: '/tomag-icon.svg',
    tag: payload?.category || 'financie-general',
    data: {
      url: payload?.url || '/finance/snapshots',
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/finance/snapshots'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    }),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return

  event.respondWith(
    fetch(event.request)
      .then(async (response) => {
        if (new URL(event.request.url).pathname === '/home' && response.ok) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put('/home', response.clone())
        }
        return response
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME)
        if (new URL(event.request.url).pathname === '/home') {
          const dashboard = await cache.match('/home')
          if (dashboard) return dashboard
        }
        return (await cache.match(OFFLINE_URL)) ?? Response.error()
      }),
  )
})

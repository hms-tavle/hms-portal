const CACHE = 'hms-v1'
const SHELL = ['/hms-portal/', '/hms-portal/index.html']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== location.origin) return

  // Navigation requests — network first, offline fallback to app shell
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/hms-portal/index.html'))
    )
    return
  }

  // Hashed assets (JS/CSS) — cache first (content-addressed, safe to cache forever)
  if (url.pathname.startsWith('/hms-portal/assets/')) {
    e.respondWith(
      caches.match(request).then(cached => cached ?? fetch(request).then(res => {
        caches.open(CACHE).then(c => c.put(request, res.clone()))
        return res
      }))
    )
    return
  }

  // Other static files (icons, manifest) — stale-while-revalidate
  if (url.pathname.startsWith('/hms-portal/')) {
    e.respondWith(
      caches.match(request).then(cached => {
        const fresh = fetch(request).then(res => {
          caches.open(CACHE).then(c => c.put(request, res.clone()))
          return res
        })
        return cached ?? fresh
      })
    )
  }
})

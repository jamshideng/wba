/*
 * WBA ilovasi — service worker.
 *
 * Qoida: shaxsiy ma'lumot (CRM sahifalari, RSC, API) HECH QACHON keshlanmaydi —
 * telefon boshqa odam qo'liga o'tsa yoki chiqib ketilsa, eski qarz/davomat
 * ko'rinib qolmasin. Keshga faqat:
 *   1) internetsiz sahifa (/offline.html) va ikonkalar — o'rnatilganda;
 *   2) /_next/static/* — nomida xesh bor, o'zgarmaydi (tezlik uchun).
 * Sahifa ochilmasa (internet yo'q) — /offline.html ko'rsatiladi.
 *
 * Telefon xabarnomalari (0055): server web-push bilan yuboradi — bu yerda
 * ko'rsatiladi; bosilsa ilova (yoki ochiq oynasi) kerakli sahifada ochiladi.
 *
 * Ikonkadagi raqam (badge): push kelganda +1 (ilova yopiq bo'lsa ham),
 * ilova ochilganda — yopilmagan bildirishnomalar soniga tenglashadi
 * (components/bildirishnomalar.tsx). Son BELGI keshida saqlanadi — u
 * versiya almashganda o'chirilmaydi.
 *
 * Yangilansa VERSIYA ni oshiring: eski kesh o'chadi.
 */
const VERSIYA = 'wba-v3'
const BELGI = 'wba-belgi'
const OLDINDAN = ['/offline.html', '/ikonka-192.png', '/logo-qizil.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSIYA).then((c) => c.addAll(OLDINDAN)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomlar) => Promise.all(nomlar.filter((n) => n !== VERSIYA && n !== BELGI).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const so = e.request
  if (so.method !== 'GET') return
  const url = new URL(so.url)
  if (url.origin !== self.location.origin) return

  // Sahifa: har doim tarmoqdan; bo'lmasa — internetsiz sahifa
  if (so.mode === 'navigate') {
    e.respondWith(fetch(so).catch(() => caches.match('/offline.html')))
    return
  }

  // Xeshli statik fayllar: avval kesh, yo'q bo'lsa tarmoqdan olib keshga
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(so).then(
        (bor) =>
          bor ||
          fetch(so).then((javob) => {
            if (javob.ok) {
              const nusxa = javob.clone()
              caches.open(VERSIYA).then((c) => c.put(so, nusxa))
            }
            return javob
          }),
      ),
    )
  }
  // Qolgan hammasi — brauzerning o'zi (keshsiz, aralashmaymiz)
})

self.addEventListener('push', (e) => {
  let x = {}
  try {
    x = e.data ? e.data.json() : {}
  } catch {
    x = { sarlavha: 'World Bridge Academy', matn: e.data ? e.data.text() : '' }
  }
  e.waitUntil(
    Promise.all([
      belgiOshir(),
      self.registration.showNotification(x.sarlavha || 'World Bridge Academy', {
        body: x.matn || '',
        icon: '/ikonka-192.png',
        badge: '/ikonka-maskable-192.png',
        tag: x.teg || undefined,
        lang: 'uz',
        data: { havola: x.havola || '/crm' },
      }),
    ]),
  )
})

async function belgiOshir() {
  try {
    const kesh = await caches.open(BELGI)
    const eski = await kesh.match('/belgi')
    const son = (eski ? Number(await eski.text()) || 0 : 0) + 1
    await kesh.put('/belgi', new Response(String(son)))
    if (self.navigator.setAppBadge) await self.navigator.setAppBadge(son)
  } catch {}
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const manzil = new URL(e.notification.data?.havola || '/crm', self.location.origin).href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((oynalar) => {
      for (const o of oynalar) {
        if (new URL(o.url).origin === self.location.origin && 'focus' in o) {
          o.navigate(manzil).catch(() => {})
          return o.focus()
        }
      }
      return self.clients.openWindow(manzil)
    }),
  )
})

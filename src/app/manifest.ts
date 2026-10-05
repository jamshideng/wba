import type { MetadataRoute } from 'next'

/**
 * Telefon ekraniga o'rnatiladigan ilova (PWA manifest).
 * Ikonkalar public/ da: oddiy (shaffof) va maskable (oq fon, logotip
 * markazdagi 66% xavfsiz zonada — Android doira/kvadrat qilib qirqadi).
 * Service worker — public/sw.js, ro'yxatdan o'tkazish — components/ilova.tsx.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/crm',
    name: 'World Bridge Academy',
    short_name: 'WBA',
    description: 'World Bridge Academy — o‘quv markazi tizimi',
    start_url: '/crm?manba=ilova',
    scope: '/',
    display: 'standalone',
    background_color: '#0D0A09',
    theme_color: '#0D0A09',
    lang: 'uz',
    categories: ['education'],
    icons: [
      { src: '/ikonka-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/ikonka-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/ikonka-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/ikonka-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

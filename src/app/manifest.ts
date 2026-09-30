import type { MetadataRoute } from 'next'

/** Telefon ekraniga qo'shish uchun (PWA manifest). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'World Bridge Academy',
    short_name: 'WBA',
    description: 'World Bridge Academy — o‘quv markazi tizimi',
    start_url: '/crm',
    display: 'standalone',
    background_color: '#0D0A09',
    theme_color: '#0D0A09',
    lang: 'uz',
    icons: [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }],
  }
}

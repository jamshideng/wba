import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'

const nextConfig: NextConfig = {
  // Ildizni shu papkaga qotiramiz. Aks holda Next yuqoridagi begona
  // package-lock.json ni ko'rib workspace ildizini noto'g'ri tanlaydi
  // (build ogohlantirishi + build traces xatosi).
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),

  experimental: {
    // Server action'lar faqat shu domenlardan chaqirilsin
    serverActions: {
      allowedOrigins: ['localhost:3000', 'wbalc.uz', 'www.wbalc.uz'],
    },
  },

  async rewrites() {
    return {
      // CRM /crm ostida (wbalc.uz/crm). Eski "app.wba.uz → /crm" rewrite'i
      // olib tashlandi: domen wbalc.uz, app.wbalc.uz esa boshqa loyihada.
      beforeFiles: [],
      afterFiles: [],
      fallback: [],
    }
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        ],
      },
    ]
  },
}

export default nextConfig

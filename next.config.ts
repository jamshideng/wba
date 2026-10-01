import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'

/**
 * Content-Security-Policy. script-src'da 'unsafe-inline' qoladi: Next
 * sahifaga inline skript qo'yadi (RSC ma'lumoti, layout'dagi tema skripti),
 * nonce esa har sahifani dinamik qilib qo'yardi. Asosiy foyda — tashqi
 * manbalar yopiq: skript/ulanish faqat o'z domen va Supabase'ga, sahifani
 * begona sayt ichiga olib bo'lmaydi, forma faqat o'zimizga yuboriladi.
 * Dev'da Next eval ishlatadi — 'unsafe-eval' faqat o'sha yerda.
 */
const dev = process.env.NODE_ENV !== 'production'

/** Lokal Supabase (127.0.0.1:58321) bilan `next start` ham ishlasin — env'dagi manzil ruxsatda. */
function supabaseManzil(): string {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    return u.hostname.endsWith('.supabase.co') ? '' : ` ${u.origin} ${u.origin.replace(/^http/, 'ws')}`
  } catch {
    return ''
  }
}

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Woblar Market rasmlari — Supabase Storage (0040)
  `img-src 'self' data: blob: https://*.supabase.co${supabaseManzil()}`,
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${supabaseManzil()}${dev ? ' ws://localhost:*' : ''}`,
  "frame-src https://yandex.uz https://yandex.ru https://yandex.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

const nextConfig: NextConfig = {
  // Ildizni shu papkaga qotiramiz. Aks holda Next yuqoridagi begona
  // package-lock.json ni ko'rib workspace ildizini noto'g'ri tanlaydi
  // (build ogohlantirishi + build traces xatosi).
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),

  experimental: {
    /* Brauzer xotirasi: yaqinda ochilgan sahifaga qaytish serverga bormaydi
       (React Router + TanStack Query'dagi kesh kabi). 30 soniyadan keyin yoki
       forma saqlanganda (revalidatePath) — yangidan olinadi. */
    staleTimes: { dynamic: 30, static: 180 },
    // Server action'lar faqat shu domenlardan chaqirilsin
    serverActions: {
      allowedOrigins: ['localhost:3000', 'wbalc.uz', 'www.wbalc.uz'],
      // Market mahsulot rasmi (3 MB gacha) forma bilan yuboriladi
      bodySizeLimit: '4mb',
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
          { key: 'Content-Security-Policy', value: CSP },
        ],
      },
    ]
  },
}

export default nextConfig

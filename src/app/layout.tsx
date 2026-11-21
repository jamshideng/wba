import type { Metadata, Viewport } from 'next'
import { Archivo, Manrope, IBM_Plex_Mono } from 'next/font/google'
import { saytManzil } from '@/lib/markaz'
import { IlovaSW } from '@/components/ilova'
import './globals.css'

const archivo = Archivo({
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-archivo',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
})

const SARLAVHA = 'World Bridge Academy — Toshkentda o‘quv markazi'
const TAVSIF =
  '2018 yildan beri Toshkentda. Ingliz, rus, arab, turk tili, matematika, Почемучка va IT — guruhda 12 kishidan ortiq emas, ' +
  'birinchi dars va daraja aniqlash bepul.'

export const metadata: Metadata = {
  metadataBase: new URL(saytManzil()),
  applicationName: 'World Bridge Academy',
  title: {
    default: SARLAVHA,
    template: '%s · World Bridge Academy',
  },
  description: TAVSIF,
  // Next openGraph/twitter'ga title va description'ni o'zi ko'chirmaydi —
  // yozilmasa Telegram/Facebook ulashganda sarlavha bo'sh chiqadi.
  openGraph: {
    type: 'website',
    locale: 'uz_UZ',
    siteName: 'World Bridge Academy',
    title: SARLAVHA,
    description: TAVSIF,
  },
  twitter: { card: 'summary_large_image', title: SARLAVHA, description: TAVSIF },
  // Telefon raqami iOS'da avtomatik havola bo'lib, dizaynni buzmasin
  formatDetection: { telephone: false },
  // iPhone: ekranga qo'shilganda ilova kabi (brauzer panelisiz) ochilsin.
  // Status bar 'black' — 'black-translucent' bo'lsa CRM sarlavhasi uning ostiga kirib qolardi.
  appleWebApp: { capable: true, title: 'WBA', statusBarStyle: 'black' },
}

export const viewport: Viewport = {
  themeColor: '#0D0A09',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

/**
 * Tema (yorug'/qorong'i) sahifa chizilishidan OLDIN o'rnatilsin —
 * aks holda qorong'i fon ko'rinib, keyin yorug'ga sakraydi (FOUC).
 * localStorage'dagi tanlov <html data-theme> ga qo'yiladi; tanlov
 * bo'lmasa hech narsa qo'yilmaydi va CSS tizim sozlamasiga tayanadi.
 */
const TEMA_SKRIPT = `(function(){try{var t=localStorage.getItem('wba-tema');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: tema (data-theme) va preloader (data-parda) skriptlari
    // <html> atributlarini React'dan OLDIN qo'yadi — bu ataylab, xato emas.
    <html
      lang="uz"
      suppressHydrationWarning
      className={`${archivo.variable} ${manrope.variable} ${plexMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_SKRIPT }} />
      </head>
      <body>
        {children}
        <IlovaSW />
      </body>
    </html>
  )
}

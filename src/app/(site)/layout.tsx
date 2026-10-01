import Link from 'next/link'
import { Logo } from '@/components/ui'
import { MARKAZ } from '@/lib/markaz'
import { SarlavhaBalandligi } from '@/components/sarlavha-balandligi'

const MENYU = [
  { href: '/#kurslar', nom: 'Kurslar' },
  { href: '/#dars', nom: 'Dars' },
  { href: '/#narxlar', nom: 'Narxlar' },
  { href: '/#aloqa', nom: 'Aloqa' },
]

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header id="sarlavha" className="sticky top-0 z-20 border-b border-line-soft bg-bg/90 backdrop-blur">
        <div
          className="mx-auto flex max-w-[1260px] flex-wrap items-center justify-between gap-4 px-5 py-3.5 lg:px-8"
          style={{ paddingTop: 'max(0.875rem, env(safe-area-inset-top, 0px))' }}
        >
          <Link href="/" aria-label={MARKAZ.nom}>
            <Logo />
          </Link>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {/* Oddiy <a>: bosh sahifada brauzer o'zi bo'limga silliq tushadi (scroll-padding-top) */}
            {MENYU.map((m) => (
              <a key={m.href} href={m.href} className="text-[14.5px] text-ink-2 hover:text-ink">
                {m.nom}
              </a>
            ))}
            <Link
              href="/ariza"
              className="inline-flex min-h-11 items-center rounded-[9px] bg-brand text-white px-5 text-[14px] font-bold transition hover:brightness-110"
            >
              Bepul sinov darsi
            </Link>
          </nav>
        </div>
      </header>
      <SarlavhaBalandligi />

      {children}

      <footer className="border-t border-line-soft">
        <div className="mx-auto flex max-w-[1260px] flex-wrap items-center justify-between gap-5 px-5 py-6 lg:px-8">
          <span className="lbl">
            {MARKAZ.nom} · Toshkent · {MARKAZ.tashkilYili}
          </span>
          <nav className="flex flex-wrap gap-5">
            <Link href="/#kurslar" className="text-[13px] text-ink-3 hover:text-ink">
              Kurslar
            </Link>
            <Link href="/#narxlar" className="text-[13px] text-ink-3 hover:text-ink">
              Narxlar
            </Link>
            <Link href="/#aloqa" className="text-[13px] text-ink-3 hover:text-ink">
              Aloqa
            </Link>
            <Link href="/kirish" className="text-[13px] text-ink-3 hover:text-ink">
              Tizimga kirish
            </Link>
          </nav>
        </div>
      </footer>
    </>
  )
}

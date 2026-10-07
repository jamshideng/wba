import Link from 'next/link'
import { Logo } from '@/components/ui'
import { MARKAZ } from '@/lib/markaz'
import { SarlavhaBalandligi } from '@/components/sarlavha-balandligi'
import { SaytMenyu } from '@/components/sayt-menyu'
import { TemaTugma } from '@/components/tema'

const MENYU = [
  { href: '/#kurslar', nom: 'Kurslar' },
  { href: '/#jadval', nom: 'Jadval' },
  { href: '/#narxlar', nom: 'Narxlar' },
  { href: '/#savollar', nom: 'Savollar' },
  { href: '/#aloqa', nom: 'Aloqa' },
]

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Klaviatura bilan yuradigan odam har sahifada shapkadagi 7 ta
          havolani bosib o'tmasin. Odatda ko'rinmaydi — faqat fokus
          tushganda chiqadi. */}
      <a
        href="#asosiy"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-[9px] focus:bg-brand focus:px-5 focus:text-[14px] focus:font-bold focus:text-white"
      >
        Asosiy mazmunga o‘tish
      </a>

      <header id="sarlavha" className="sayt-sarlavha sticky top-0 z-20 border-b border-line-soft bg-bg/90 backdrop-blur">
        <div
          className="mx-auto flex max-w-[1260px] items-center justify-between gap-3 px-4 py-2.5 sm:gap-4 sm:px-5 sm:py-3.5 lg:px-8"
          style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top, 0px))' }}
        >
          {/* Bosiladigan joy 44px dan kam bo'lmasin (CLAUDE.md qoidasi):
              logotipning o'zi 34px balandlikda edi. */}
          <Link href="/" aria-label={MARKAZ.nom} className="inline-flex min-h-11 items-center">
            <Logo />
          </Link>

          <nav className="flex items-center gap-2 sm:gap-x-6">
            {/* Oddiy <a>: bosh sahifada brauzer o'zi bo'limga silliq tushadi (scroll-padding-top) */}
            {MENYU.map((m) => (
              <a key={m.href} href={m.href} className="hidden min-h-11 items-center text-[14.5px] text-ink-2 hover:text-ink sm:inline-flex">
                {m.nom}
              </a>
            ))}
            <span className="flex items-center gap-2">
              {/* Yorug'/qorong'i — tanlov saqlanadi (wba-tema) */}
              <TemaTugma className="size-11! rounded-full!" />
              {/* O'quvchi va ustozlar tizimga kirishni darhol topsin */}
              <Link
                href="/kirish"
                className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-[14px] font-bold text-ink transition hover:border-ink sm:px-5"
              >
                Kirish
              </Link>
              <Link
                href="/ariza"
                className="sayt-tugma hidden min-h-11 items-center rounded-full bg-brand px-5 text-[14px] font-bold text-white transition hover:brightness-110 sm:inline-flex"
              >
                Bepul sinov darsi
              </Link>
              <SaytMenyu menyu={MENYU} />
            </span>
          </nav>
        </div>
      </header>
      <SarlavhaBalandligi />

      {/* tabIndex={-1} — fokus shu yerga haqiqatan ko'chsin (aks holda
          ba'zi brauzerlar faqat skroll qiladi, fokus shapkada qoladi). */}
      <div id="asosiy" tabIndex={-1}>
        {children}
      </div>

      <footer className="border-t border-line-soft">
        <div className="mx-auto flex max-w-[1260px] flex-wrap items-center justify-between gap-5 px-5 py-6 lg:px-8">
          <span className="lbl">
            {MARKAZ.nom} · Toshkent · {MARKAZ.tashkilYili}
          </span>
          <nav className="flex flex-wrap gap-x-5">
            <Link href="/#kurslar" className="inline-flex min-h-11 items-center text-[13px] text-ink-3 hover:text-ink">
              Kurslar
            </Link>
            <Link href="/#narxlar" className="inline-flex min-h-11 items-center text-[13px] text-ink-3 hover:text-ink">
              Narxlar
            </Link>
            <Link href="/#aloqa" className="inline-flex min-h-11 items-center text-[13px] text-ink-3 hover:text-ink">
              Aloqa
            </Link>
            <Link href="/kirish" className="inline-flex min-h-11 items-center text-[13px] text-ink-3 hover:text-ink">
              Tizimga kirish
            </Link>
          </nav>
        </div>
      </footer>
    </>
  )
}

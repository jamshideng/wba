'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { IconChevronDown } from '@/components/icons'

/** Yo'l shu havolaga tegishlimi (o'zi yoki ichki sahifasi). */
export function yolMos(yol: string, href: string): boolean {
  const asos = href.split('?')[0]
  return yol === asos || yol.startsWith(`${asos}/`)
}

/**
 * Bir nechta havoladan hozirgi yo'lga ENG ANIQ mos keladigani.
 * /crm/oquvchilar/takroriy da "Takroriylar" faol, "O'quvchilar" emas.
 */
export function faolHavola(yol: string, hreflar: string[]): string | null {
  let eng: string | null = null
  for (const h of hreflar) {
    if (h.includes('?') || !yolMos(yol, h)) continue
    if (!eng || h.length > eng.length) eng = h
  }
  return eng
}

/**
 * Yon menyudagi guruh (O'quvchilar ▾, Xodimlar ▾ …). Ichidagi bo'lim ochiq
 * bo'lsa — o'zi ochiladi. Menyu yig'ilganda (faqat ikonka) guruh birinchi
 * ichki bo'limga havola bo'lib qoladi.
 */
export function MenyuGuruh({
  nom,
  href,
  hreflar,
  ikonka,
  nishon,
  children,
}: {
  nom: string
  href: string
  hreflar: string[]
  ikonka: React.ReactNode
  nishon?: number
  children: React.ReactNode
}) {
  const yol = usePathname()
  const ichida = faolHavola(yol, hreflar) !== null
  const [ochiq, ochish] = useState<boolean | null>(null)
  const korinadi = ochiq ?? ichida

  const bosh = (
    <>
      {ikonka}
      <span className="flex-1 truncate text-left group-data-[menyu=yopiq]/qobiq:hidden">{nom}</span>
      {nishon ? (
        <span className="tnum font-[family-name:var(--font-mono)] text-[11px] text-brand group-data-[menyu=yopiq]/qobiq:hidden">
          {nishon}
        </span>
      ) : null}
    </>
  )
  const klass = `relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-[13.5px] whitespace-nowrap transition ${
    ichida ? 'font-semibold text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
  }`

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => ochish(!korinadi)}
        aria-expanded={korinadi}
        className={`${klass} group-data-[menyu=yopiq]/qobiq:hidden`}
      >
        {bosh}
        <IconChevronDown size={14} className={`shrink-0 text-ink-3 transition-transform ${korinadi ? 'rotate-180' : ''}`} />
      </button>
      <Link
        href={href}
        title={nom}
        className={`${klass} hidden justify-center px-0 group-data-[menyu=yopiq]/qobiq:flex ${ichida ? 'bg-brand-soft' : ''}`}
      >
        {ikonka}
      </Link>
      {korinadi && (
        <div className="ml-[22px] flex flex-col gap-0.5 border-l border-line-soft pl-2 group-data-[menyu=yopiq]/qobiq:hidden">
          {children}
        </div>
      )}
    </div>
  )
}

export type TabGuruh = { nom: string; bandlar: { href: string; nom: string; tayyor: boolean }[] }

/**
 * Sahifa tepasidagi ichki bo'limlar (SoffCRM uslubi): hozirgi sahifa qaysi
 * guruhda bo'lsa — o'sha guruhning hamma bo'limlari tab bo'lib chiqadi.
 */
export function BolimTablari({ guruhlar }: { guruhlar: TabGuruh[] }) {
  const yol = usePathname()
  const g = guruhlar.find((x) => faolHavola(yol, x.bandlar.map((b) => b.href)) !== null)
  if (!g) return null
  const faol = faolHavola(yol, g.bandlar.map((b) => b.href))

  return (
    <nav
      aria-label={`${g.nom} bo‘limlari`}
      className="flex gap-1.5 overflow-x-auto border-b border-line-soft px-5 pt-3 [scrollbar-width:none] lg:px-7"
    >
      {g.bandlar.map((b) =>
        b.tayyor ? (
          <Link
            key={b.href}
            href={b.href}
            aria-current={b.href === faol ? 'page' : undefined}
            className={`-mb-px flex min-h-11 shrink-0 items-center border-b-2 px-3 text-[13px] whitespace-nowrap transition ${
              b.href === faol ? 'border-brand font-semibold text-ink' : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            {b.nom}
          </Link>
        ) : (
          <span
            key={b.href}
            aria-disabled="true"
            className="-mb-px flex min-h-11 shrink-0 cursor-not-allowed items-center border-b-2 border-transparent px-3 text-[13px] whitespace-nowrap text-ink-4"
          >
            {b.nom} · tez orada
          </span>
        ),
      )}
    </nav>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconLogout, IconSettings, IconChevronDown } from '@/components/icons'

/**
 * Yuqori o'ng burchak: ism (yoki telefonda — bosh harflar) bosilganda
 * ikki band ochiladi: "Profil" va uning tagida qizil "Chiqish".
 * Tashqariga bosilsa, Escape yoki boshqa sahifaga o'tilsa — yopiladi.
 */
export function ProfilMenyu({
  ism,
  rolMatn,
  boshHarf,
  chiqish,
  ixcham = false,
}: {
  ism: string
  rolMatn: string
  boshHarf: string
  chiqish: () => Promise<void>
  /** Telefon sarlavhasi — faqat doira va rol */
  ixcham?: boolean
}) {
  const [ochiq, setOchiq] = useState(false)
  const quti = useRef<HTMLDivElement>(null)
  const yol = usePathname()

  useEffect(() => setOchiq(false), [yol])

  useEffect(() => {
    if (!ochiq) return
    const bos = (e: MouseEvent) => {
      if (!quti.current?.contains(e.target as Node)) setOchiq(false)
    }
    const tugma = (e: KeyboardEvent) => e.key === 'Escape' && setOchiq(false)
    document.addEventListener('mousedown', bos)
    document.addEventListener('keydown', tugma)
    return () => {
      document.removeEventListener('mousedown', bos)
      document.removeEventListener('keydown', tugma)
    }
  }, [ochiq])

  return (
    <div ref={quti} className="relative">
      <button
        type="button"
        onClick={() => setOchiq((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={ochiq}
        className="flex min-h-11 items-center gap-2.5 rounded-[10px] px-2 py-1.5 transition hover:bg-surface-2"
      >
        <span className={`flex min-w-0 flex-col items-end ${ixcham ? 'max-w-[140px]' : ''}`}>
          {!ixcham && <span className="truncate text-[12.5px] font-semibold">{ism}</span>}
          <span className="lbl truncate text-[9px] text-brand">{rolMatn}</span>
        </span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand font-[family-name:var(--font-display)] text-xs font-bold text-white">
          {boshHarf}
        </span>
        {!ixcham && <IconChevronDown size={15} className={`text-ink-3 transition ${ochiq ? 'rotate-180' : ''}`} />}
      </button>

      {ochiq && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-40 flex w-56 flex-col overflow-hidden rounded-[12px] border border-line bg-surface shadow-lg"
        >
          <span className="flex flex-col gap-0.5 bg-brand px-4 py-3 text-white">
            <span className="truncate text-[13.5px] font-semibold">{ism}</span>
            <span className="truncate text-[10.5px] uppercase tracking-[0.08em] opacity-85">{rolMatn}</span>
          </span>
          <Link
            role="menuitem"
            href="/crm/profil"
            className="flex min-h-11 items-center gap-3 px-4 text-[13.5px] text-ink-2 transition hover:bg-surface-2 hover:text-ink"
          >
            <IconSettings size={16} />
            Profil sozlamalari
          </Link>
          <form action={chiqish} className="border-t border-line-soft">
            <button
              role="menuitem"
              type="submit"
              className="flex min-h-11 w-full items-center gap-3 px-4 text-[13.5px] font-semibold text-brand transition hover:bg-brand-soft"
            >
              <IconLogout size={16} />
              Chiqish
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

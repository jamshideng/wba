'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MARKAZ, NARX } from '@/lib/markaz'

type Reja = 'oylik' | 'uch'

/**
 * "1 650 000" — minglar oddiy bo'shliq bilan. Intl('uz-UZ') Node va brauzerda
 * turli bo'shliq belgisi beradi (hydration xatosi) — shu yerda qo'lda.
 */
function pul(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** Narx o'zgarganda raqam silliq "aylanib" boradi */
function useSanoq(qiymat: number): number {
  const [joriy, setJoriy] = useState(qiymat)
  const oldingi = useRef(qiymat)

  useEffect(() => {
    const boshi = oldingi.current
    oldingi.current = qiymat
    if (boshi === qiymat || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setJoriy(qiymat)
      return
    }
    let kadr = 0
    const t0 = performance.now()
    const qadam = (t: number) => {
      const p = Math.min(1, (t - t0) / 600)
      const e = 1 - Math.pow(1 - p, 3)
      setJoriy(Math.round((boshi + (qiymat - boshi) * e) / 1000) * 1000)
      if (p < 1) kadr = requestAnimationFrame(qadam)
    }
    kadr = requestAnimationFrame(qadam)
    return () => cancelAnimationFrame(kadr)
  }, [qiymat])

  return joriy
}

/**
 * Narxlar darhol ko'rinmaydi: avval "birinchi dars — 0 so'm" va tugma.
 * Bosilganda blok ochiladi: 1 oylik / 3 oylik almashtirgich va hisob.
 * Sotuv qoidasi (CLAUDE.md): avval ehtiyoj va qiymat, keyin narx.
 */
export function Narx() {
  const [ochiq, setOchiq] = useState(false)
  const [reja, setReja] = useState<Reja>('uch')
  const asosiy = reja === 'uch' ? NARX.uchOylik : NARX.tanishuvOyi
  const sanoq = useSanoq(ochiq ? asosiy : 0)
  const tejash = NARX.uchOylikAsl - NARX.uchOylik

  return (
    <div className="overflow-hidden rounded-[28px] border border-line bg-surface">
      <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="flex flex-col gap-3">
          <span className="lbl text-brand">Birinchi qadam</span>
          <p className="flex items-baseline gap-3">
            <span className="h-display text-[64px] leading-none sm:text-[96px]">0</span>
            <span className="text-[18px] font-semibold text-ink-2 sm:text-[22px]">so‘m</span>
          </p>
          <p className="max-w-[46ch] text-[15.5px] leading-relaxed text-ink-2">
            Sinov darsi va daraja aniqlash — bepul. To‘lov faqat dars yoqqandan keyin, hech qanday oldindan to‘lovsiz.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={ochiq}
          aria-controls="narx-tafsil"
          onClick={() => setOchiq((v) => !v)}
          className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-full border border-ink px-7 text-[15px] font-bold text-ink transition hover:bg-ink hover:text-bg"
        >
          {ochiq ? 'Narxlarni yopish' : 'Keyingi oylar narxini ko‘rish'}
          <span aria-hidden="true" className={`transition-transform duration-500 ${ochiq ? 'rotate-180' : ''}`}>
            ↓
          </span>
        </button>
      </div>

      {/* grid-rows 0fr → 1fr: balandlikni JS'siz silliq ochish */}
      <div
        id="narx-tafsil"
        className={`grid transition-[grid-template-rows] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          ochiq ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="min-h-0 overflow-hidden" inert={!ochiq}>
          <div className="grid gap-4 border-t border-line p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
            <div className="flex flex-col gap-6">
              <div role="radiogroup" aria-label="To‘lov rejasi" className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
                {(
                  [
                    ['oylik', 'Oyma-oy'],
                    ['uch', '3 oy birdaniga'],
                  ] as const
                ).map(([id, nom]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={reja === id}
                    onClick={() => setReja(id)}
                    className={`min-h-12 rounded-full text-[14px] font-bold transition ${
                      reja === id ? 'bg-ink text-bg shadow-sm' : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    {nom}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2" aria-live="polite">
                <span className="lbl">{reja === 'uch' ? '3 oy uchun jami' : 'Birinchi oy (tanishuv)'}</span>
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="h-display tnum text-[52px] leading-none sm:text-[72px]">{pul(sanoq)}</span>
                  <span className="text-[16px] text-ink-3">so‘m</span>
                </p>
                {reja === 'uch' ? (
                  <p className="flex flex-wrap items-center gap-2.5 text-[14.5px] text-ink-2">
                    <span className="tnum font-[family-name:var(--font-mono)] text-ink-3 line-through">{pul(NARX.uchOylikAsl)}</span>
                    <span className="rounded-full bg-brand px-3 py-1 text-[12.5px] font-bold text-white">
                      {pul(tejash)} so‘m tejaysiz
                    </span>
                  </p>
                ) : (
                  <p className="text-[14.5px] text-ink-2">
                    Ikkinchi oydan — <b className="tnum text-ink">{pul(NARX.standart)} so‘m</b> / oy
                  </p>
                )}
              </div>
            </div>

            <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line">
              {[
                reja === 'uch'
                  ? 'Uchala oy ham tanishuv narxida qoladi'
                  : 'Birinchi oy arzonroq — guruh va ustozni sinab ko‘rasiz',
                `Haftada ${MARKAZ.darsHaftada} dars, ${MARKAZ.darsDaqiqa} daqiqadan`,
                `Guruhda ${MARKAZ.guruhMaksimal} kishidan ortiq emas`,
                'Davomat va baholar shaxsiy sahifada',
                'Ikki fan, aka-uka yoki do‘st bilan kelsangiz — chegirma',
              ].map((t) => (
                <li key={t} className="flex items-center gap-3 px-5 py-3.5 text-[14.5px]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
                    <path d="M3 8.4l3 2.9 7-7" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t}
                </li>
              ))}
              <li className="px-5 py-4">
                <Link
                  href="/ariza"
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-[15px] font-bold text-white transition hover:brightness-110"
                >
                  Bepul sinov darsidan boshlash →
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

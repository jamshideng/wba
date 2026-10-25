'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Dars jadvali uchun zoom: − / foiz / + (va kompyuterda Ctrl + g'ildirak).
 * Setka o'lchamlari CSS o'zgaruvchilari orqali: --soat (bir soat balandligi)
 * va --karta (bitta dars kartasining eng kam kengligi). Tanlangan kattalik shu
 * brauzerda eslab qolinadi.
 */
const KALIT = 'wba-jadval-zoom'
const ENG_KAM = 0.5
const ENG_KOP = 2.5
const QADAM = 0.25
const SOAT = 72
/** Bitta dars kartasining eng kam kengligi (100% da) */
const KARTA = 96

const chegarala = (z: number) => Math.min(ENG_KOP, Math.max(ENG_KAM, Math.round(z * 100) / 100))

export function JadvalZoom({ yolaklar, children }: { yolaklar: number; children: React.ReactNode }) {
  const [z, setZ] = useState(1)
  const quti = useRef<HTMLDivElement>(null)

  /** Butun hafta ekran kengligiga sig'adigan kattalik (umumiy ko'rinish) */
  const sigdir = () => {
    const keng = quti.current?.clientWidth ?? 0
    return keng ? Math.min(1, (keng - 56) / (yolaklar * KARTA)) : 1
  }

  useEffect(() => {
    let v = 0
    try {
      v = Number(localStorage.getItem(KALIT))
    } catch {}
    setZ(chegarala(v || sigdir()))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat birinchi ochilishda
  }, [])

  // Faqat foydalanuvchi o'zgartirganda saqlanadi
  const ozgartir = (f: (x: number) => number) =>
    setZ((x) => {
      const y = chegarala(f(x))
      try {
        localStorage.setItem(KALIT, String(y))
      } catch {}
      return y
    })

  const ozgartirRef = useRef(ozgartir)
  ozgartirRef.current = ozgartir

  // Ctrl + g'ildirak (trackpad'da ikki barmoq bilan ham) — sahifa emas, faqat jadval
  useEffect(() => {
    const el = quti.current
    if (!el) return
    const g = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      ozgartirRef.current((x) => x - Math.sign(e.deltaY) * 0.1)
    }
    el.addEventListener('wheel', g, { passive: false })
    return () => el.removeEventListener('wheel', g)
  }, [])

  const tugma =
    'flex min-h-11 min-w-11 items-center justify-center rounded-[10px] border border-line bg-surface text-[18px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink disabled:opacity-40'

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-end gap-2 border-b border-line px-3 py-2">
        <span className="mr-auto text-[12px] text-ink-3">Kattalashtirsangiz, guruhlar to‘liq ko‘rinadi</span>
        <button type="button" className={tugma} onClick={() => ozgartir((x) => x - QADAM)} disabled={z <= ENG_KAM} aria-label="Kichraytirish">
          −
        </button>
        <button
          type="button"
          onClick={() => ozgartir(() => sigdir())}
          className="tnum min-h-11 min-w-16 rounded-[10px] px-2 font-[family-name:var(--font-mono)] text-[13px] text-ink-2 hover:text-ink"
          title="Ekranga sig‘dirish"
        >
          {Math.round(z * 100)}%
        </button>
        <button type="button" className={tugma} onClick={() => ozgartir((x) => x + QADAM)} disabled={z >= ENG_KOP} aria-label="Kattalashtirish">
          +
        </button>
      </div>
      {/* Telefonda setka o'z ichida suriladi (sahifa emas); soat ustuni joyida qoladi */}
      <div
        ref={quti}
        className="overflow-x-auto"
        style={
          {
            '--soat': `${SOAT * z}px`,
            '--karta': `${KARTA * z}px`,
            '--jadval-min': `calc(56px + ${yolaklar} * var(--karta))`,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </div>
  )
}

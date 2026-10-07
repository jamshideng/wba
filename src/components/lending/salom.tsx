'use client'

import { useEffect, useState } from 'react'

/** Markazda o'qitiladigan tillarda "salom" — hero kartasida navbatma-navbat. */
const SOZLAR = [
  { soz: 'Salom', til: 'o‘zbekcha', dir: 'ltr' },
  { soz: 'Hello', til: 'ingliz tili', dir: 'ltr' },
  { soz: 'Привет', til: 'rus tili', dir: 'ltr' },
  { soz: 'مرحبا', til: 'arab tili', dir: 'rtl' },
  { soz: 'Merhaba', til: 'turk tili', dir: 'ltr' },
] as const

const ORALIQ_MS = 2200

export function Salom() {
  const [i, setI] = useState(0)

  useEffect(() => {
    // Harakatni o'chirgan odamga so'z almashib turmaydi
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((n) => (n + 1) % SOZLAR.length), ORALIQ_MS)
    return () => clearInterval(t)
  }, [])

  const s = SOZLAR[i]

  return (
    <div translate="no" className="flex flex-col items-center gap-2 text-center">
      {/* Ekran o'quvchiga almashib turadigan so'z o'qilmaydi — bitta jumla yetarli */}
      <span className="sr-only">Salom: ingliz, rus, arab va turk tillarida</span>
      <span
        key={s.soz}
        aria-hidden="true"
        dir={s.dir}
        lang={s.dir === 'rtl' ? 'ar' : undefined}
        className={`lb-soz text-[56px] leading-[1.15] sm:text-[72px] ${
          s.dir === 'rtl' ? 'lb-arab' : 'h-display'
        }`}
      >
        {s.soz}
      </span>
      <span aria-hidden="true" className="flex items-center gap-2">
        {SOZLAR.map((v, n) => (
          <span
            key={v.soz}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              n === i ? 'w-6 bg-brand' : 'w-1.5 bg-line'
            }`}
          />
        ))}
        <span key={s.til} className="lb-soz lbl ml-1.5 text-ink-2">
          {s.til}
        </span>
      </span>
    </div>
  )
}

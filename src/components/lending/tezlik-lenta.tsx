'use client'

import { useEffect, useRef } from 'react'
import { skrollTezligi } from '@/lib/harakat'

/**
 * Ikki qator lenta — qarama-qarshi tomonga oqadi, skroll tezlashsa lenta ham
 * tezlashadi va qiyshayadi (portfolio'dagi velocity-marquee). Bezak.
 */

type Bolak = { s: string; r: string; arab?: boolean }

const QATOR_1: Bolak[] = [
  { s: 'Ingliz tili', r: 'var(--color-osmon)' },
  { s: 'Hello', r: 'var(--color-osmon)' },
  { s: 'Rus tili', r: 'var(--color-brand)' },
  { s: 'Привет', r: 'var(--color-brand)' },
  { s: 'Arab tili', r: 'var(--color-accent)' },
  { s: 'مرحبا', r: 'var(--color-accent)', arab: true },
  { s: 'Turk tili', r: 'var(--color-firuza)' },
  { s: 'Merhaba', r: 'var(--color-firuza)' },
]
const QATOR_2: Bolak[] = [
  { s: 'Matematika', r: 'var(--color-binafsha)' },
  { s: 'a² + b² = c²', r: 'var(--color-binafsha)' },
  { s: 'Pochemuchka', r: 'var(--color-ok)' },
  { s: 'Nima uchun?', r: 'var(--color-ok)' },
  { s: 'AI & IT', r: 'var(--color-brand)' },
  { s: 'Web dasturlash', r: 'var(--color-osmon)' },
  { s: 'Scratch', r: 'var(--color-accent)' },
  { s: 'IELTS · DTM', r: 'var(--color-firuza)' },
]

function Qator({ bolaklar, yonalish }: { bolaklar: Bolak[]; yonalish: 1 | -1 }) {
  const ichki = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ichki.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let x = 0
    let qiya = 0
    let kadr = 0
    let korinadi = true
    const qadam = () => {
      const v = skrollTezligi()
      const yarim = el.scrollWidth / 2
      x -= (0.6 + Math.min(Math.abs(v) * 0.35, 14)) * yonalish
      if (x <= -yarim) x += yarim
      if (x > 0) x -= yarim
      qiya += (Math.max(-8, Math.min(8, v * 0.4)) - qiya) * 0.1
      el.style.transform = `translate3d(${x.toFixed(1)}px,0,0) skewX(${(-qiya).toFixed(2)}deg)`
      kadr = korinadi ? requestAnimationFrame(qadam) : 0
    }
    const kuzat = new IntersectionObserver(([e]) => {
      korinadi = e.isIntersecting
      if (korinadi && !kadr) kadr = requestAnimationFrame(qadam)
    })
    kuzat.observe(el)
    kadr = requestAnimationFrame(qadam)
    return () => {
      cancelAnimationFrame(kadr)
      kuzat.disconnect()
    }
  }, [yonalish])

  const bir = bolaklar.map((b) => (
    <span
      key={b.s}
      dir={b.arab ? 'rtl' : undefined}
      className={`mr-3 inline-flex shrink-0 items-center rounded-full px-6 py-3 text-[22px] leading-none text-white sm:mr-4 sm:px-8 sm:py-4 sm:text-[34px] ${
        b.arab ? 'lb-arab' : 'h-display'
      }`}
      style={{ background: `color-mix(in oklab, ${b.r} 84%, black)` }}
    >
      {b.s}
    </span>
  ))

  return (
    <div className="overflow-hidden">
      <div ref={ichki} className="flex w-max will-change-transform">
        <div className="flex">{bir}</div>
        <div className="flex">{bir}</div>
      </div>
    </div>
  )
}

export function TezlikLenta() {
  return (
    <div aria-hidden="true" translate="no" className="flex flex-col gap-3 py-10 sm:gap-4 sm:py-16">
      <Qator bolaklar={QATOR_1} yonalish={1} />
      <Qator bolaklar={QATOR_2} yonalish={-1} />
    </div>
  )
}

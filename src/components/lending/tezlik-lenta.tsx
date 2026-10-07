'use client'

import { useEffect, useRef } from 'react'
import { skrollTezligi } from '@/lib/harakat'
import { YONALISHLAR } from '@/lib/markaz'

/**
 * Ikki qator yo'nalishlar lentasi — qarama-qarshi tomonga oqadi, skroll
 * tezlashsa lenta ham tezlashadi. Monoxrom: birinchi qator to'liq, ikkinchisi
 * kontur. Ajratuvchi — brend qizil kvadrat. Bezak, ekran o'quvchiga yashirin.
 */
const NOMLAR = YONALISHLAR.map((y) => y.nom)

function Qator({ kontur, yonalish }: { kontur?: boolean; yonalish: 1 | -1 }) {
  const ichki = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ichki.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let x = yonalish === 1 ? 0 : -el.scrollWidth / 4
    let kadr = 0
    let korinadi = true
    const qadam = () => {
      const yarim = el.scrollWidth / 2
      x -= (0.5 + Math.min(Math.abs(skrollTezligi()) * 0.3, 12)) * yonalish
      if (x <= -yarim) x += yarim
      if (x > 0) x -= yarim
      el.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`
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

  const bir = NOMLAR.map((s) => (
    <span key={s} className="flex shrink-0 items-center">
      <span className={`h-display px-5 text-[38px] leading-none whitespace-nowrap sm:px-8 sm:text-[72px] ${kontur ? 'lb-kontur' : ''}`}>
        {s}
      </span>
      <span className="size-2.5 shrink-0 bg-brand sm:size-3.5" />
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
    <div aria-hidden="true" translate="no" className="flex flex-col gap-2 border-y border-line py-7 sm:gap-4 sm:py-12">
      <Qator yonalish={1} />
      <Qator kontur yonalish={-1} />
    </div>
  )
}

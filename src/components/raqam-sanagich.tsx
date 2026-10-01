'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Raqam ko'rinishga kirganda 0 dan o'z qiymatigacha sanab chiqadi.
 * Ekran o'quvchiga va harakatni o'chirganlarga darhol yakuniy qiymat beriladi.
 */
export function RaqamSanagich({ qiymat, davomiylik = 1400 }: { qiymat: number; davomiylik?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [joriy, setJoriy] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (qiymat === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setJoriy(qiymat)
      return
    }

    let kadr = 0
    const boshla = () => {
      const t0 = performance.now()
      const qadam = (t: number) => {
        const p = Math.min(1, (t - t0) / davomiylik)
        setJoriy(Math.round(qiymat * (1 - Math.pow(1 - p, 3))))
        if (p < 1) kadr = requestAnimationFrame(qadam)
      }
      kadr = requestAnimationFrame(qadam)
    }

    const kuzat = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          kuzat.disconnect()
          boshla()
        }
      },
      { threshold: 0.4 },
    )
    kuzat.observe(el)
    return () => {
      kuzat.disconnect()
      cancelAnimationFrame(kadr)
    }
  }, [qiymat, davomiylik])

  return (
    <span ref={ref} className="tnum">
      <span className="sr-only">{qiymat}</span>
      <span aria-hidden="true">{joriy}</span>
    </span>
  )
}

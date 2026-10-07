'use client'

import { useEffect, useState } from 'react'

/** Hero'dagi almashib turadigan fan nomi */
const FANLAR = ['ingliz tili', 'matematika', 'arab tili', 'rus tili', 'turk tili', 'Pochemuchka', 'IT va AI'] as const

const ORALIQ_MS = 2000

export function FanAylanma() {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((n) => (n + 1) % FANLAR.length), ORALIQ_MS)
    return () => clearInterval(t)
  }, [])

  return (
    <span className="relative inline-flex overflow-hidden py-[0.08em] align-bottom leading-[1.15]">
      <span className="sr-only">ingliz, rus, arab, turk tili, matematika, Pochemuchka, IT</span>
      <span key={FANLAR[i]} aria-hidden="true" className="lb-fan inline-block text-brand">
        {FANLAR[i]}
      </span>
    </span>
  )
}

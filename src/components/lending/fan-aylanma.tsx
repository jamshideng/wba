'use client'

import { useEffect, useState } from 'react'

/** Hero'dagi almashib turadigan fan nomi — har biri o'z rangida */
const FANLAR = [
  { nom: 'ingliz tili', r: 'var(--color-osmon)' },
  { nom: 'matematika', r: 'var(--color-binafsha)' },
  { nom: 'arab tili', r: 'var(--color-accent)' },
  { nom: 'rus tili', r: 'var(--color-brand)' },
  { nom: 'turk tili', r: 'var(--color-firuza)' },
  { nom: 'Pochemuchka', r: 'var(--color-ok)' },
  { nom: 'IT va AI', r: 'var(--color-brand)' },
] as const

const ORALIQ_MS = 2000

export function FanAylanma() {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((n) => (n + 1) % FANLAR.length), ORALIQ_MS)
    return () => clearInterval(t)
  }, [])

  const f = FANLAR[i]
  return (
    <span className="relative inline-flex overflow-hidden py-[0.1em] align-middle leading-[1.2]">
      <span className="sr-only">ingliz, rus, arab, turk tili, matematika, Pochemuchka, IT</span>
      <span
        key={f.nom}
        aria-hidden="true"
        className="lb-fan inline-block rounded-[0.18em] px-[0.22em] text-white"
        style={{ background: `color-mix(in oklab, ${f.r} 84%, black)` }}
      >
        {f.nom}
      </span>
    </span>
  )
}

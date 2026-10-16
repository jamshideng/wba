'use client'

import { useState } from 'react'

/** Matnni nusxalash tugmasi (taklif havolasi va h.k.). */
export function NusxaTugma({ matn, nom = 'Nusxalash' }: { matn: string; nom?: string }) {
  const [tayyor, belgila] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(matn)
          belgila(true)
          setTimeout(() => belgila(false), 1800)
        } catch {}
      }}
      className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[9px] border border-line bg-surface px-3.5 text-[13px] font-semibold hover:border-accent-line hover:text-accent"
    >
      {tayyor ? 'Nusxalandi' : nom}
    </button>
  )
}

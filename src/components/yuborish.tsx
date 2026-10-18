'use client'

import { useFormStatus } from 'react-dom'

const TUR = {
  // Qizil fonda matn doim oq (ui.tsx TUGMA bilan bir xil)
  asosiy: 'bg-brand text-white font-semibold hover:brightness-110',
  // Och, yorqin — woblar berish (tanga rangi)
  yorqin: 'bg-tanga text-tanga-ink font-bold shadow-sm shadow-tanga/30 hover:brightness-105 active:brightness-95',
  ikkilamchi: 'border border-line bg-surface text-ink-2 hover:text-ink hover:border-ink-3',
  ok: 'border border-ok bg-ok-soft text-ok font-semibold hover:brightness-125',
  xavfli: 'border border-brand-line bg-brand-soft text-brand font-semibold hover:brightness-125',
} as const

/**
 * Formani yuboradigan tugma. Yuborilayotganda o'chadi — admin ikki
 * marta bosib, to'lovni ikki marta yozib yubormasin.
 */
export function Yuborish({
  children,
  tur = 'asosiy',
  kutish = 'Saqlanmoqda…',
  className = '',
  name,
  value,
}: {
  children: React.ReactNode
  tur?: keyof typeof TUR
  kutish?: string
  className?: string
  name?: string
  value?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[9px] px-5 text-[13.5px] transition disabled:cursor-not-allowed disabled:opacity-50 ${TUR[tur]} ${className}`}
    >
      {pending ? kutish : children}
    </button>
  )
}

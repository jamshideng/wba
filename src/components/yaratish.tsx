'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { IconChevronDown, IconGroups, IconLeads, IconAlert, IconPayments, IconStudents } from '@/components/icons'

/**
 * Tepadagi "+ Yaratish" — eng ko'p qilinadigan ishlar bir joyda
 * (LeaderCRM'dagi kabi). Har band mavjud sahifaga olib boradi; forma
 * o'sha sahifaning o'zida, shuning uchun qoida va huquq bir xil qoladi.
 */
export function Yaratish({ direktor }: { direktor: boolean }) {
  const [ochiq, setOchiq] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ochiq) return
    const yop = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOchiq(false)
    }
    document.addEventListener('mousedown', yop)
    document.addEventListener('keydown', yop)
    return () => {
      document.removeEventListener('mousedown', yop)
      document.removeEventListener('keydown', yop)
    }
  }, [ochiq])

  const bandlar = [
    { href: '/crm/tolovlar/yangi', nom: 'To‘lov kiritish', Icon: IconPayments },
    { href: '/crm/lidlar?yangi=1', nom: 'Yangi lid', Icon: IconLeads },
    { href: '/crm/oquvchilar/yangi', nom: 'Yangi o‘quvchi', Icon: IconStudents },
    { href: '/crm/vazifalar?yangi=1', nom: 'Yangi vazifa', Icon: IconAlert },
    ...(direktor ? [{ href: '/crm/guruhlar/yangi', nom: 'Yangi guruh', Icon: IconGroups }] : []),
  ]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOchiq((o) => !o)}
        aria-expanded={ochiq}
        aria-haspopup="menu"
        className="flex min-h-10 items-center gap-1.5 rounded-[10px] bg-brand px-4 text-[13.5px] font-semibold text-white shadow-sm shadow-brand/25 transition hover:brightness-110"
      >
        <span aria-hidden="true" className="text-[17px] leading-none">+</span> Yaratish
        <IconChevronDown size={14} className={`transition ${ochiq ? 'rotate-180' : ''}`} />
      </button>
      {ochiq && (
        <div role="menu" className="absolute right-0 z-30 mt-1.5 flex w-56 flex-col rounded-[12px] border border-line bg-surface p-1.5 shadow-xl">
          {bandlar.map((b) => (
            <Link
              key={b.href}
              href={b.href}
              role="menuitem"
              onClick={() => setOchiq(false)}
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13.5px] text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              <b.Icon size={16} className="text-ink-3" />
              {b.nom}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

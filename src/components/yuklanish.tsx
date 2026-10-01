'use client'

import { useEffect, useRef, useState } from 'react'
import { useLinkStatus } from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Sahifadan sahifaga o'tishda DARHOL ko'rinadigan javob.
 *
 * Sahifalar serverda chiziladi: server javob berguncha eski sahifa turadi
 * va "bosdim — hech narsa bo'lmadi" degan tuyg'u qoladi. loading.tsx bu
 * yerda ishlatilmaydi — u server action redirect bilan sahifani osib
 * qo'ygan edi (fb0ea3a). Buning o'rniga:
 *   · YuklanishChizigi — tepadagi ingichka chiziq (ichki havola bosilganda)
 *   · HavolaHolati     — bosilgan menyu bandida aylanuvchi belgi
 */

/** Tepadagi chiziq. Ichki havola bosilganda boshlanadi, manzil o'zgarganda tugaydi. */
export function YuklanishChizigi() {
  const yol = usePathname()
  const sorov = useSearchParams()
  const [holat, setHolat] = useState<'yoq' | 'bormoqda' | 'tugadi'>('yoq')
  const taymer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Manzil o'zgardi — yangi sahifa keldi
  useEffect(() => {
    setHolat((h) => (h === 'bormoqda' ? 'tugadi' : h))
    if (taymer.current) clearTimeout(taymer.current)
    taymer.current = setTimeout(() => setHolat('yoq'), 350)
  }, [yol, sorov])

  useEffect(() => {
    const bosildi = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a')
      if (!a || a.target === '_blank' || a.hasAttribute('download') || !a.href) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin) return
      if (url.pathname === location.pathname && url.search === location.search) return
      if (taymer.current) clearTimeout(taymer.current)
      setHolat('bormoqda')
    }
    document.addEventListener('click', bosildi, true)
    return () => document.removeEventListener('click', bosildi, true)
  }, [])

  if (holat === 'yoq') return null
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2.5px]">
      <div
        className="h-full bg-brand shadow-[0_0_8px_var(--color-brand)]"
        style={{
          width: holat === 'bormoqda' ? '85%' : '100%',
          opacity: holat === 'tugadi' ? 0 : 1,
          transition:
            holat === 'bormoqda'
              ? 'width 6s cubic-bezier(0.1, 0.7, 0.2, 1)'
              : 'width 0.2s ease-out, opacity 0.3s ease 0.15s',
        }}
      />
    </div>
  )
}

/** <Link> ichida: shu havola yuklanayotganda kichik aylanuvchi belgi */
export function HavolaHolati() {
  const { pending } = useLinkStatus()
  return (
    <span
      aria-hidden
      className={`ml-auto size-3.5 shrink-0 rounded-full border-2 border-brand border-t-transparent transition-opacity group-data-[menyu=yopiq]/qobiq:hidden ${
        pending ? 'animate-spin opacity-100' : 'opacity-0'
      }`}
    />
  )
}

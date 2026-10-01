'use client'

import { useEffect, useRef, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Jonli qidiruv/filtr formasi — "Qidirish" tugmasisiz.
 *
 * Matn yozilganda (qisqa kutishdan keyin) va ro'yxat/katak o'zgarganda
 * darhol manzil yangilanadi, sahifa serverda qayta chiziladi va natija
 * shu zahoti chiqadi. Kiritish maydoni qayta yaratilmaydi — kursor ham,
 * yozilgan matn ham joyida qoladi. Sahifa raqami (sahifa=) tushib qoladi:
 * yangi qidiruv doim birinchi sahifadan.
 *
 * Enter ham ishlaydi; JavaScript o'chiq bo'lsa oddiy GET forma bo'lib qoladi.
 */
export function JonliForma({
  children,
  className,
  kechikish = 220,
}: {
  children: React.ReactNode
  className?: string
  kechikish?: number
}) {
  const router = useRouter()
  const yol = usePathname()
  const forma = useRef<HTMLFormElement>(null)
  const taymer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [kutilmoqda, boshla] = useTransition()
  const manzil = useSearchParams()

  /* Manzil tashqaridan o'zgarsa ("Tozalash", orqaga tugmasi) — maydonlar
     ham moslashadi. Hozir yozilayotgan maydonga tegilmaydi. */
  useEffect(() => {
    const f = forma.current
    if (!f) return
    for (const el of Array.from(f.elements)) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) continue
      if (!el.name || el.type === 'hidden' || el === document.activeElement) continue
      if (el instanceof HTMLInputElement && el.type === 'checkbox') {
        el.checked = manzil.getAll(el.name).includes(el.value)
      } else {
        // Manzilda yo'q bo'lsa — tanlovda server qo'ygan standart variant qoladi
        // (bo'sh qiymat qo'yilsa <select> hech narsani ko'rsatmay qolardi)
        const standart = el instanceof HTMLSelectElement
          ? (Array.from(el.options).find((o) => o.defaultSelected)?.value ?? '')
          : ''
        const v = manzil.get(el.name) ?? standart
        if (el.value !== v) el.value = v
      }
    }
  }, [manzil])

  useEffect(() => () => {
    if (taymer.current) clearTimeout(taymer.current)
  }, [])

  function yangila(darhol: boolean) {
    if (taymer.current) clearTimeout(taymer.current)
    taymer.current = setTimeout(
      () => {
        if (!forma.current) return
        const p = new URLSearchParams()
        for (const [k, v] of new FormData(forma.current)) {
          if (typeof v === 'string' && v.trim()) p.append(k, v.trim())
        }
        const qs = p.toString()
        boshla(() => router.replace(qs ? `${yol}?${qs}` : yol, { scroll: false }))
      },
      darhol ? 0 : kechikish,
    )
  }

  return (
    <form
      ref={forma}
      role="search"
      aria-busy={kutilmoqda}
      className={className}
      onSubmit={(e) => {
        e.preventDefault()
        yangila(true)
      }}
      onInput={(e) => {
        const el = e.target as HTMLInputElement
        const matnli = el.tagName === 'INPUT' && ['text', 'search', 'tel', ''].includes(el.type)
        yangila(!matnli)
      }}
    >
      {children}
      <span aria-live="polite" className={`lbl self-center transition-opacity ${kutilmoqda ? 'opacity-100' : 'opacity-0'}`}>
        qidirilmoqda…
      </span>
    </form>
  )
}

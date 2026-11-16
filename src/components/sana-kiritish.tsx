'use client'

/**
 * Sana maydoni — doim kun/oy/yil (16/11/2026) ko'rinishida, brauzer tilidan qat'i nazar.
 * Formaga esa oddiy <input type="date"> qiymati (2026-11-16) ketadi: u ko'rinmas holda
 * ostida turadi — name, min/max, required tekshiruvi va kalendar (📅 tugma) o'shandan.
 */
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange'> & {
  defaultValue?: string | null
  onChange?: (iso: string) => void
}

const isoDan = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : ''
}

function isoga(matn: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(matn)
  if (!m) return null
  const [, d, o, y] = m
  const dt = new Date(`${y}-${o}-${d}T00:00:00Z`)
  return dt.getUTCDate() === Number(d) && dt.getUTCMonth() + 1 === Number(o) ? `${y}-${o}-${d}` : null
}

/** Faqat raqam; 2 va 4 raqamdan keyin "/" o'zi qo'yiladi */
function niqob(v: string): string {
  const r = v.replace(/\D/g, '').slice(0, 8)
  return [r.slice(0, 2), r.slice(2, 4), r.slice(4)].filter(Boolean).join('/')
}

/** Kenglikni o'rovchiga beramiz — aks holda flex qatorda w-full ishlamay qoladi */
const TASHQI = /^((sm|md|lg|xl):)?(w-|min-w-|max-w-|flex-|grow|shrink|basis-|col-span|self-|order-)/

export function SanaKiritish({ defaultValue, onChange, className = '', disabled, id, placeholder, ...qolgan }: Props) {
  const asl = useRef<HTMLInputElement>(null)
  const [matn, setMatn] = useState(isoDan(defaultValue ?? ''))
  const [xato, setXato] = useState(false)

  const sinflar = className.split(/\s+/).filter(Boolean)
  const tashqi = sinflar.filter((s) => TASHQI.test(s)).join(' ')
  const ichki = sinflar.filter((s) => !TASHQI.test(s)).join(' ')

  // Forma tozalansa (reset / server action'dan keyin) ko'rinishni ham qaytaramiz
  useEffect(() => {
    const el = asl.current
    const forma = el?.form
    if (!el || !forma) return
    const qayt = () => setTimeout(() => { setMatn(isoDan(el.value)); setXato(false) }, 0)
    forma.addEventListener('reset', qayt)
    return () => forma.removeEventListener('reset', qayt)
  }, [])

  function yoz(iso: string) {
    const el = asl.current
    if (!el || el.value === iso) return
    el.value = iso
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    onChange?.(iso)
  }

  return (
    <span className={`relative grid ${tashqi}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder ?? 'kk/oo/yyyy'}
        value={matn}
        disabled={disabled}
        aria-invalid={xato || undefined}
        className={`w-full pr-10 tnum ${ichki} ${xato ? 'border-danger' : ''}`}
        // JonliForma har harfda qidirmasin — faqat sana to'liq bo'lganda (pastdagi yoz())
        onInput={(e) => e.stopPropagation()}
        onChange={(e) => {
          const v = niqob(e.target.value)
          setMatn(v)
          const iso = isoga(v)
          setXato(v.length === 10 && !iso)
          // Chala yoki noto'g'ri sana: forma yuborilmaydi (eski qiymat ketib qolmasin), jonli filtr esa eski qiymatda turadi
          asl.current?.setCustomValidity(v && !iso ? 'Sanani kun/oy/yil ko‘rinishida to‘liq yozing, masalan 16/11/2026' : '')
          if (iso || v === '') yoz(iso ?? '')
        }}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => {
          if (matn && !isoga(matn)) setXato(true)
        }}
      />
      <input
        ref={asl}
        type="date"
        tabIndex={-1}
        aria-hidden
        defaultValue={defaultValue ?? ''}
        disabled={disabled}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        onChange={(e) => {
          setMatn(isoDan(e.target.value))
          setXato(false)
          onChange?.(e.target.value)
        }}
        {...qolgan}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Kalendardan tanlash"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-3 hover:text-ink disabled:opacity-40"
        onClick={() => {
          try { asl.current?.showPicker() } catch { asl.current?.focus() }
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>
    </span>
  )
}

'use client'

import { useState } from 'react'

/** Ko'z ikonasi — parolni ko'rsatish/yashirish. */
function Koz({ ochiq }: { ochiq: boolean }) {
  return ochiq ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.61" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}

/**
 * Parol maydoni — ko'rsatish/yashirish tugmasi bilan.
 * Server action bilan ishlaydi: uncontrolled input, `name` orqali yuboriladi.
 */
export function ParolInput({
  name = 'parol',
  placeholder,
  autoComplete = 'current-password',
  required = true,
  minLength,
  className = '',
}: {
  name?: string
  placeholder?: string
  autoComplete?: string
  required?: boolean
  minLength?: number
  className?: string
}) {
  const [ochiq, setOchiq] = useState(false)
  return (
    <div className="relative">
      <input
        name={name}
        type={ochiq ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`min-h-12 w-full rounded-[10px] border border-line bg-surface px-3.5 pr-11 text-[14px] text-ink outline-none transition focus:border-brand-line ${className}`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setOchiq((s) => !s)}
        aria-label={ochiq ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
        className="absolute inset-y-0 right-0 grid grid-cols-1 w-11 place-items-center text-ink-4 transition hover:text-ink-2"
      >
        <Koz ochiq={ochiq} />
      </button>
    </div>
  )
}

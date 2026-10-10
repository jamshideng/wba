'use client'

import { useEffect, useRef, useState } from 'react'
import { skrollQulf } from '@/lib/harakat'
import { Test } from '@/components/lending/test'
import { SAVOL_SONI, TEST_FANLAR } from '@/lib/test-savollar'

/**
 * Mini-test sahifada yopiq turadi (narxlar kabi). "Testni boshlash" bosilganda
 * alohida oynada (native <dialog>) ochiladi: orqadagi sahifa skrolli to'xtaydi,
 * fokus oyna ichida qoladi, Esc yoki ✕ bilan yopiladi. Har ochilishda test yangidan.
 */
export function TestOyna() {
  const oyna = useRef<HTMLDialogElement>(null)
  const [ochiq, setOchiq] = useState(false)
  const [kalit, setKalit] = useState(0)

  useEffect(() => {
    const d = oyna.current
    if (!d) return
    const yopildi = () => {
      setOchiq(false)
      skrollQulf(false)
    }
    d.addEventListener('close', yopildi)
    return () => d.removeEventListener('close', yopildi)
  }, [])

  function och() {
    setKalit((k) => k + 1)
    setOchiq(true)
    skrollQulf(true)
    oyna.current?.showModal()
  }

  return (
    <>
      <div className="flex flex-col gap-6 rounded-[28px] border border-line bg-surface p-6 sm:p-9">
        <div className="grid grid-cols-3 divide-x divide-line rounded-[18px] border border-line">
          {[
            [String(TEST_FANLAR.length), 'fan'],
            [String(SAVOL_SONI), 'savol'],
            ['1', 'daqiqa'],
          ].map(([n, t]) => (
            <div key={t} className="flex flex-col items-center gap-1 px-2 py-4">
              <span className="h-display text-[24px] leading-none sm:text-[30px]">{n}</span>
              <span className="text-[12.5px] text-ink-3">{t}</span>
            </div>
          ))}
        </div>
        <p className="flex flex-wrap gap-2" aria-label="Test fanlari">
          {TEST_FANLAR.map((f) => (
            <span key={f.id} className="rounded-full border border-line px-3.5 py-1.5 text-[13.5px] font-semibold text-ink-2">
              {f.nom}
            </span>
          ))}
        </p>
        <button
          type="button"
          onClick={och}
          aria-haspopup="dialog"
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-ink px-7 text-[15.5px] font-bold text-bg transition hover:bg-brand hover:text-white"
        >
          Testni boshlash <span aria-hidden="true">→</span>
        </button>
      </div>

      <dialog
        ref={oyna}
        aria-label="Mini-test"
        data-lenis-prevent
        className="lb-oyna m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm sm:m-auto sm:h-auto sm:max-w-[720px] sm:p-4"
        onClick={(e) => {
          // Fonga bosilganda yopish (kompyuterda)
          if (e.target === e.currentTarget) oyna.current?.close()
        }}
      >
        <div className="relative flex h-full flex-col bg-bg sm:h-auto sm:rounded-[30px]">
          <div className="flex items-center justify-between gap-4 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sm:px-7 sm:pt-6">
            <span className="lbl text-brand">Mini-test</span>
            <button
              type="button"
              onClick={() => oyna.current?.close()}
              aria-label="Testni yopish"
              className="flex size-11 items-center justify-center rounded-full border border-line text-[18px] transition hover:border-ink"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-4">
            {ochiq && <Test key={kalit} />}
          </div>
        </div>
      </dialog>
    </>
  )
}

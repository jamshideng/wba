'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { telefon } from '@/lib/format'

/** farzand_ustozi() qatori (0116) */
export type UstozMalumot = { ism: string; telefon: string | null; telegram_user: string | null }

/**
 * Ota-ona farzandining ustozi ismini bosganda — ekran o'rtasida oyna:
 * FISH, telefon va (admin kiritgan bo'lsa) Telegram. Ma'lumotni
 * farzand_ustozi() faqat o'z farzandining ustozi uchun beradi.
 * Yopish: ×, fon yoki Esc.
 */
export function UstozKarta({ u }: { u: UstozMalumot }) {
  const [ochiq, setOchiq] = useState(false)

  useEffect(() => {
    if (!ochiq) return
    const tugma = (e: KeyboardEvent) => { if (e.key === 'Escape') setOchiq(false) }
    document.addEventListener('keydown', tugma)
    return () => document.removeEventListener('keydown', tugma)
  }, [ochiq])

  return (
    <>
      <button
        type="button"
        onClick={() => setOchiq(true)}
        className="inline-flex min-h-11 items-center font-semibold text-ink underline decoration-dotted underline-offset-4 hover:text-brand"
      >
        {u.ism}
      </button>
      {ochiq &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] grid grid-cols-1 place-items-center bg-black/40 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label={`Ustoz: ${u.ism}`}
            onClick={() => setOchiq(false)}
          >
            <div
              className="bn-tushish flex w-full max-w-[360px] flex-col gap-3 rounded-[18px] border border-line bg-surface p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex flex-col gap-0.5">
                  <span className="lbl">Ustoz</span>
                  <span className="text-[17px] font-bold text-ink">{u.ism}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setOchiq(false)}
                  aria-label="Yopish"
                  className="grid size-11 shrink-0 place-items-center rounded-[10px] text-[20px] text-ink-3 hover:bg-surface-2 hover:text-ink"
                >
                  ×
                </button>
              </div>
              {u.telefon ? (
                <a
                  href={`tel:${u.telefon.replace(/[^\d+]/g, '')}`}
                  className="flex min-h-11 items-center justify-between rounded-[10px] border border-line px-4 text-[14px] hover:border-ink-3"
                >
                  <span className="text-ink-3">Telefon</span>
                  <span className="font-semibold text-brand">{telefon(u.telefon)}</span>
                </a>
              ) : (
                <span className="flex min-h-11 items-center rounded-[10px] bg-surface-2 px-4 text-[13px] text-ink-3">Telefon kiritilmagan</span>
              )}
              {u.telegram_user && (
                <a
                  href={`https://t.me/${u.telegram_user}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center justify-between rounded-[10px] border border-line px-4 text-[14px] hover:border-ink-3"
                >
                  <span className="text-ink-3">Telegram</span>
                  <span className="font-semibold text-brand">@{u.telegram_user}</span>
                </a>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

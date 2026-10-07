'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * Ingliz tili — 1 daqiqalik mini-test. 8 savol, osondan qiyinga (A1 → B2).
 * Natija TAXMINIY: aniq daraja markazda bepul aniqlanadi (shuni aytamiz ham).
 * Hech narsa yuborilmaydi va saqlanmaydi — hammasi brauzerda.
 */
const SAVOLLAR = [
  { s: 'I ___ a student.', v: ['am', 'is', 'are'], t: 0 },
  { s: 'She ___ to school every day.', v: ['go', 'goes', 'going'], t: 1 },
  { s: 'Yesterday we ___ a film.', v: ['watch', 'watched', 'have watched'], t: 1 },
  { s: 'Look at those clouds! It ___ rain.', v: ['is going to', 'goes to', 'go to'], t: 0 },
  { s: 'I have lived in Tashkent ___ 2018.', v: ['for', 'since', 'from'], t: 1 },
  { s: 'This book ___ by millions of people.', v: ['has read', 'has been read', 'was reading'], t: 1 },
  { s: 'If I ___ you, I would accept the offer.', v: ['am', 'were', 'will be'], t: 1 },
  { s: 'Hardly ___ the door when the phone rang.', v: ['I had opened', 'had I opened', 'I opened'], t: 1 },
] as const

/** To'g'ri javoblar soni → WBA bosqichlari (markaz.ts dagi ingliz tili ro'yxatidan) */
function natija(togri: number): { daraja: string; izoh: string } {
  if (togri <= 2) return { daraja: 'Beginner', izoh: 'Asoslardan boshlash kerak — bu juda yaxshi start nuqtasi.' }
  if (togri <= 4) return { daraja: 'Elementary', izoh: 'Asosiy grammatika tanish. Endi so‘z boyligi va gapirishni oshirish vaqti.' }
  if (togri <= 6) return { daraja: 'Pre-Intermediate', izoh: 'Yaxshi poydevor bor. Murakkab zamonlar va erkin nutq ustida ishlaymiz.' }
  if (togri === 7) return { daraja: 'Intermediate', izoh: 'Kuchli daraja. Pre-IELTS va IELTS sari to‘g‘ri yo‘ldasiz.' }
  return { daraja: 'Pre-IELTS', izoh: 'A’lo! IELTS tayyorgarligini boshlash mumkin.' }
}

export function Test() {
  const [qadam, setQadam] = useState(0)
  const [togri, setTogri] = useState(0)
  const [tanlov, setTanlov] = useState<number | null>(null)

  const tugadi = qadam >= SAVOLLAR.length
  const q = SAVOLLAR[Math.min(qadam, SAVOLLAR.length - 1)]

  function javob(i: number) {
    if (tanlov !== null) return
    setTanlov(i)
    if (i === q.t) setTogri((n) => n + 1)
    // Javob rangini ko'rsatib, keyingi savolga o'tamiz
    setTimeout(() => {
      setTanlov(null)
      setQadam((n) => n + 1)
    }, 650)
  }

  function qaytadan() {
    setQadam(0)
    setTogri(0)
    setTanlov(null)
  }

  const r = natija(togri)

  return (
    <div className="overflow-hidden rounded-[28px] border border-line bg-surface">
      {/* Progress */}
      <div className="h-1 bg-surface-2" aria-hidden="true">
        <div
          className="h-full bg-brand transition-[width] duration-500 ease-out"
          style={{ width: `${(Math.min(qadam, SAVOLLAR.length) / SAVOLLAR.length) * 100}%` }}
        />
      </div>

      <div className="flex min-h-[380px] flex-col gap-6 p-6 sm:min-h-[340px] sm:p-10">
        {!tugadi ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="lbl">
                Savol {qadam + 1} / {SAVOLLAR.length}
              </span>
              <span className="lbl text-ink-3">Taxminiy daraja</span>
            </div>
            <p key={qadam} className="lb-savol h-display text-[26px] leading-tight sm:text-[38px]" translate="no" lang="en">
              {q.s}
            </p>
            <div className="grid gap-2.5 sm:grid-cols-3" role="group" aria-label="Javob variantlari">
              {q.v.map((v, i) => {
                const holat =
                  tanlov === null ? '' : i === q.t ? 'border-ink bg-ink text-bg' : i === tanlov ? 'border-brand text-brand' : 'opacity-40'
                return (
                  <button
                    key={v}
                    type="button"
                    lang="en"
                    translate="no"
                    disabled={tanlov !== null}
                    onClick={() => javob(i)}
                    className={`flex min-h-14 items-center justify-between gap-3 rounded-[16px] border border-line px-5 text-left text-[16px] font-semibold transition hover:border-ink ${holat}`}
                  >
                    <span>{v}</span>
                    <span className="font-[family-name:var(--font-mono)] text-[12px] text-ink-3" aria-hidden="true">
                      {String.fromCharCode(65 + i)}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className="lb-savol flex flex-1 flex-col justify-between gap-6" aria-live="polite">
            <div className="flex flex-col gap-3">
              <span className="lbl text-brand">
                {togri} / {SAVOLLAR.length} to‘g‘ri javob
              </span>
              <p className="text-[15px] text-ink-2">Taxminiy darajangiz:</p>
              <p className="h-display text-[44px] leading-none sm:text-[64px]" translate="no">
                {r.daraja}
              </p>
              <p className="max-w-[52ch] text-[15.5px] leading-relaxed text-ink-2">
                {r.izoh} Bu — tezkor test. Aniq darajani markazda <b className="text-ink">bepul</b> aniqlaymiz va mos guruhga
                qo‘shamiz.
              </p>
            </div>
            <div className="grid gap-3 sm:flex sm:items-center">
              <Link
                href="/ariza?yonalish=ingliz-tili"
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-brand px-7 text-[15px] font-bold text-white transition hover:brightness-110"
              >
                Aniq darajani bepul bilish →
              </Link>
              <button
                type="button"
                onClick={qaytadan}
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-line px-6 text-[15px] font-semibold text-ink-2 transition hover:border-ink hover:text-ink"
              >
                Qaytadan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

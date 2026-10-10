'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TEST_FANLAR, testDaraja, testFoiz, testTanla, type Savol, type TestFan } from '@/lib/test-savollar'

/**
 * Mini-test: avval fan tanlanadi, keyin bankdan 8 savol osondan qiyinga —
 * har urinishda boshqa savollar va boshqa variant tartibi.
 * Natija TAXMINIY — aniq daraja markazda bepul aniqlanadi. Natija faqat
 * "yozilish" bosilganda arizaga o'tadi (URL orqali), boshqa joyga yuborilmaydi.
 */
export function Test() {
  const [fan, setFan] = useState<TestFan | null>(null)
  const [savollar, setSavollar] = useState<Savol[]>([])
  const [qadam, setQadam] = useState(0)
  const [togri, setTogri] = useState(0)
  const [tanlov, setTanlov] = useState<number | null>(null)

  // Savollar faqat bosilganda tanlanadi — server va brauzer render'i farq qilmaydi
  function fanniTanla(f: TestFan) {
    setSavollar(testTanla(f))
    setFan(f)
  }

  if (!fan || !savollar.length) return <FanTanlash onTanla={fanniTanla} />

  const jami = savollar.length
  const tugadi = qadam >= jami
  const q = savollar[Math.min(qadam, jami - 1)]

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

  function boshqaFan() {
    setFan(null)
    setSavollar([])
    setQadam(0)
    setTogri(0)
    setTanlov(null)
  }

  const r = testDaraja(fan, togri)
  const foiz = testFoiz(togri, jami)
  const havola = `/ariza?${new URLSearchParams({ yonalish: fan.yonalish, test: fan.id, togri: String(togri) })}`

  return (
    <div className="overflow-hidden rounded-[28px] border border-line bg-surface">
      <div className="h-1 bg-surface-2" aria-hidden="true">
        <div
          className="h-full bg-brand transition-[width] duration-500 ease-out"
          style={{ width: `${(Math.min(qadam, jami) / jami) * 100}%` }}
        />
      </div>

      <div className="flex min-h-[380px] flex-col gap-6 p-6 sm:min-h-[340px] sm:p-10">
        {!tugadi ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="lbl">
                {fan.nom} · {qadam + 1} / {jami}
              </span>
              <button type="button" onClick={boshqaFan} className="lbl min-h-11 text-ink-3 transition hover:text-ink">
                ← Fan
              </button>
            </div>
            <p key={qadam} className="lb-savol h-display text-[26px] leading-tight sm:text-[38px]" translate="no" lang={fan.til}>
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
                    lang={fan.til}
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
                {fan.nom} · {togri} / {jami} · {foiz}%
              </span>
              <p className="h-display text-[44px] leading-none sm:text-[64px]" translate="no">
                {r.nom}
              </p>
              <p className="max-w-[52ch] text-[15.5px] leading-relaxed text-ink-2">
                {r.izoh} Natija arizangizga qo‘shiladi — aniq darajani sinov darsida <b className="text-ink">bepul</b> aniqlaymiz.
              </p>
            </div>
            <div className="grid gap-3 sm:flex sm:items-center">
              <Link
                href={havola}
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-brand px-7 text-[15px] font-bold text-white transition hover:brightness-110"
              >
                Natija bilan sinov darsiga yozilish →
              </Link>
              <button
                type="button"
                onClick={boshqaFan}
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-line px-6 text-[15px] font-semibold text-ink-2 transition hover:border-ink hover:text-ink"
              >
                Boshqa fan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FanTanlash({ onTanla }: { onTanla: (f: TestFan) => void }) {
  return (
    <div className="lb-savol flex flex-col gap-5 rounded-[28px] border border-line bg-surface p-6 sm:p-10">
      <div className="flex flex-col gap-1.5">
        <span className="lbl">1-qadam</span>
        <p className="h-display text-[28px] leading-tight sm:text-[36px]">Qaysi fandan test?</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {TEST_FANLAR.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onTanla(f)}
            className="group flex min-h-24 flex-col items-start justify-between gap-3 rounded-[18px] border border-line p-4 text-left transition hover:border-ink hover:bg-ink hover:text-bg"
          >
            <span className="h-display text-[26px] leading-none text-brand transition group-hover:text-white" translate="no">
              {f.belgi}
            </span>
            <span className="text-[15px] font-bold">{f.nom}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

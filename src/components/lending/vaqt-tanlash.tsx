'use client'

import { useState } from 'react'
import Link from 'next/link'
import { HAFTA, KUN_TURLARI, VAQTLAR, type KunTuri, type Vaqt } from '@/lib/markaz'
import { IconMoon, IconSun } from '@/components/icons'

/**
 * "O'zingizga qulay vaqtni tanlang": kun turi + kun qismi. Tanlov ariza
 * formasiga o'tadi (/ariza?kun=…&vaqt=…) — guruhni shu bo'yicha tanlaymiz.
 * Ichki jadval (qaysi guruh qachon) ataylab ko'rsatilmaydi.
 */
function Tong({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M3 13h12M5.5 13a3.5 3.5 0 0 1 7 0M9 4.5v2M3.8 7.6l1.3 1.1M14.2 7.6l-1.3 1.1" />
    </svg>
  )
}

const VAQT_IKONKA: Record<Vaqt, React.ReactNode> = {
  ertalab: <Tong />,
  kunduzi: <IconSun size={20} />,
  kechqurun: <IconMoon size={20} />,
}

export function VaqtTanlash() {
  const [kun, setKun] = useState<KunTuri | null>(null)
  const [vaqt, setVaqt] = useState<Vaqt | null>(null)

  const kunlar: readonly string[] = kun ? KUN_TURLARI.find((k) => k.id === kun)!.kunlar : []
  const params = new URLSearchParams()
  if (kun) params.set('kun', kun)
  if (vaqt) params.set('vaqt', vaqt)
  const havola = `/ariza${params.size ? `?${params}` : ''}`
  const tayyor = kun && vaqt

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div className="flex flex-col gap-7 rounded-[28px] border border-line bg-surface p-6 sm:p-9">
        {/* 1. Kunlar */}
        <fieldset className="flex flex-col gap-3">
          <legend className="lbl mb-3 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-ink text-[11px] text-bg">1</span>
            Qaysi kunlar qulay?
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {KUN_TURLARI.map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={kun === k.id}
                onClick={() => setKun(k.id)}
                className={`flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-[16px] border px-4 py-3 text-left transition ${
                  kun === k.id ? 'border-ink bg-ink text-bg' : 'border-line hover:border-ink-3'
                }`}
              >
                <span className="text-[15px] font-bold">{k.nom}</span>
                <span className={`text-[12.5px] ${kun === k.id ? 'text-bg/70' : 'text-ink-3'}`}>{k.kunlar.join(' · ')}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* 2. Kun qismi */}
        <fieldset className="flex flex-col gap-3">
          <legend className="lbl mb-3 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-ink text-[11px] text-bg">2</span>
            Qaysi vaqt qulay?
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {VAQTLAR.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={vaqt === v.id}
                onClick={() => setVaqt(v.id)}
                className={`flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-[16px] border px-2 py-3 text-center transition ${
                  vaqt === v.id ? 'border-ink bg-ink text-bg' : 'border-line hover:border-ink-3'
                }`}
              >
                <span className={vaqt === v.id ? 'text-bg' : 'text-brand'}>{VAQT_IKONKA[v.id]}</span>
                <span className="text-[14px] font-bold">{v.nom}</span>
                <span className={`tnum text-[11.5px] ${vaqt === v.id ? 'text-bg/70' : 'text-ink-3'}`}>{v.oraliq}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Natija */}
      <div className="flex flex-col justify-between gap-6 rounded-[28px] bg-ink p-6 text-bg sm:p-9">
        <div className="flex flex-col gap-5">
          <span className="lbl text-bg/60">Sizning haftangiz</span>
          <div className="grid grid-cols-7 gap-1.5" aria-hidden="true">
            {HAFTA.map((h) => {
              const bor = kunlar.includes(h)
              return (
                <span
                  key={h}
                  className={`flex aspect-square items-center justify-center rounded-[12px] text-[12px] font-bold transition duration-300 sm:text-[13px] ${
                    bor ? 'scale-100 bg-brand text-white' : 'border border-bg/15 text-bg/40'
                  }`}
                >
                  {h}
                </span>
              )
            })}
          </div>
          <p className="h-display text-[26px] leading-tight sm:text-[32px]" aria-live="polite">
            {tayyor
              ? `${KUN_TURLARI.find((k) => k.id === kun)!.nom}, ${VAQTLAR.find((v) => v.id === vaqt)!.nom.toLowerCase()}`
              : kun
                ? 'Endi vaqtni tanlang'
                : 'Kunlar va vaqtni tanlang'}
          </p>
          <p className="text-[14px] leading-relaxed text-bg/70">
            Darslar haftada 3 marta, 90 daqiqadan. Tanlovingiz bo‘yicha mos guruhni topib, qo‘ng‘iroqda aytamiz.
          </p>
        </div>
        <Link
          href={havola}
          className={`inline-flex min-h-14 items-center justify-center rounded-full px-6 text-[15px] font-bold transition ${
            tayyor ? 'bg-brand text-white hover:brightness-110' : 'bg-bg/10 text-bg/70 hover:bg-bg/15'
          }`}
        >
          {tayyor ? 'Shu vaqtga bepul darsga yozilish →' : 'Keyin tanlayman — yozilish →'}
        </Link>
      </div>
    </div>
  )
}

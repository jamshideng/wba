'use client'

import { useState } from 'react'
import Link from 'next/link'
import { HAFTA, JADVAL, KUN_TURLARI, STATISTIKA, YONALISHLAR } from '@/lib/markaz'

type KunTuri = (typeof KUN_TURLARI)[number]['id']

/**
 * "Qulay vaqtni toping" — faol guruhlarning haqiqiy vaqtlari (bazadan surat).
 * Kun turini tanlaysiz → haftada qaysi kunlar va qaysi fan qachon boshlanadi.
 */
export function Jadval() {
  const [tur, setTur] = useState<KunTuri>('toq')
  const joriy = KUN_TURLARI.find((k) => k.id === tur)!
  const qatorlar = YONALISHLAR.flatMap((y) => {
    const vaqtlar = JADVAL[tur][y.id]
    return vaqtlar ? [{ id: y.id, nom: y.nom, vaqtlar }] : []
  })

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col gap-5 rounded-[28px] border border-line bg-surface p-6 sm:p-8">
        <div role="tablist" aria-label="Kun turi" className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
          {KUN_TURLARI.map((k) => (
            <button
              key={k.id}
              type="button"
              role="tab"
              aria-selected={tur === k.id}
              onClick={() => setTur(k.id)}
              className={`min-h-11 rounded-full px-2 text-[13px] font-bold transition sm:text-[14px] ${
                tur === k.id ? 'bg-ink text-bg shadow-sm' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {k.nom.replace(' kunlari', '').replace(' kunlar', '')}
            </button>
          ))}
        </div>

        {/* Hafta: tanlangan kun turidagi kunlar ajralib turadi */}
        <div className="grid grid-cols-7 gap-1.5" aria-label={`${joriy.nom}: ${joriy.kunlar.join(', ')}`}>
          {HAFTA.map((kun) => {
            const bor = (joriy.kunlar as readonly string[]).includes(kun)
            return (
              <span
                key={kun}
                aria-hidden="true"
                className={`flex aspect-square flex-col items-center justify-center rounded-[14px] text-[12.5px] font-bold transition duration-300 sm:text-[14px] ${
                  bor ? 'bg-brand text-white' : 'border border-line text-ink-3'
                }`}
              >
                {kun}
              </span>
            )
          })}
        </div>

        <p className="text-[14.5px] leading-relaxed text-ink-2">
          Darslar haftada 3 marta, 90 daqiqadan — ertalab <b className="text-ink">08:00</b> dan kechqurun{' '}
          <b className="text-ink">21:00</b> gacha. Shanba juft va dam olish guruhlari uchun umumiy.
        </p>
        <p className="mt-auto text-[12.5px] text-ink-3">
          Vaqtlar {STATISTIKA.holatiga} holatiga. Bo‘sh joy bor-yo‘qligini qo‘ng‘iroqda aniqlaymiz.
        </p>
      </div>

      <div className="flex flex-col overflow-hidden rounded-[28px] border border-line bg-surface">
        <div key={tur} className="lb-savol flex flex-col divide-y divide-line">
          {qatorlar.map((q) => (
            <div key={q.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-7">
              <span className="h-display shrink-0 text-[20px] sm:w-[170px]">{q.nom}</span>
              <span className="flex flex-wrap gap-1.5 sm:justify-end">
                {q.vaqtlar.map((v) => (
                  <span
                    key={v}
                    className="tnum rounded-full border border-line px-3 py-1.5 font-[family-name:var(--font-mono)] text-[13px] text-ink"
                  >
                    {v}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-3 border-t border-line bg-surface-2 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <span className="text-[14px] text-ink-2">Kerakli vaqt ro‘yxatda yo‘qmi? Qo‘ng‘iroqda boshqa variantlarni aytamiz.</span>
          <Link
            href="/ariza"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-ink px-5 text-[14px] font-bold text-bg transition hover:bg-brand hover:text-white"
          >
            Vaqtni band qilish →
          </Link>
        </div>
      </div>
    </div>
  )
}

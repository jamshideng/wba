'use client'

import { useState } from 'react'
import Link from 'next/link'
import { YONALISHLAR, type Yonalish } from '@/lib/markaz'

type Yosh = 'hammasi' | 'kichik' | 'maktab' | 'katta'

const YOSHLAR: { id: Yosh; nom: string }[] = [
  { id: 'hammasi', nom: 'Hammasi' },
  { id: 'kichik', nom: '4–6 yosh' },
  { id: 'maktab', nom: 'Maktab o‘quvchilari' },
  { id: 'katta', nom: 'Kattalar' },
]

/**
 * Har yo'nalishning ko'rinishi va qaysi yoshga mosligi.
 * Yosh — markaz.ts dagi `yosh_chegarasi` dan: Pochemuchka 4–6, matematika
 * 5 yoshdan 11-sinfgacha, Scratch 16 yoshgacha. Tillar va IT maktabdan boshlab.
 */
const USLUB: Record<
  Yonalish['id'],
  { belgi: string; rang: string; yosh: Yosh[]; keng?: boolean; arab?: boolean }
> = {
  'ingliz-tili': { belgi: 'Aa', rang: 'var(--color-osmon)', yosh: ['maktab', 'katta'], keng: true },
  'rus-tili': { belgi: 'Бб', rang: 'var(--color-brand)', yosh: ['maktab', 'katta'] },
  'arab-tili': { belgi: 'ع', rang: 'var(--color-accent)', yosh: ['maktab', 'katta'], arab: true },
  'turk-tili': { belgi: 'Çç', rang: 'var(--color-firuza)', yosh: ['maktab', 'katta'] },
  matematika: { belgi: 'π', rang: 'var(--color-binafsha)', yosh: ['kichik', 'maktab'], keng: true },
  pochemuchka: { belgi: '?', rang: 'var(--color-ok)', yosh: ['kichik'] },
  'ai-it': { belgi: 'AI', rang: 'var(--color-brand)', yosh: ['maktab', 'katta'] },
  'web-dasturlash': { belgi: '</>', rang: 'var(--color-osmon)', yosh: ['maktab', 'katta'] },
  scratch: { belgi: '{ }', rang: 'var(--color-accent)', yosh: ['maktab'] },
}

/** Ingliz tili bosqichlari — tavsifdagi ro'yxatdan */
const INGLIZ_BOSQICH = YONALISHLAR[0].qisqa_tavsif.replace(/\.$/, '').split(', ')
const MATEM_YOL = ['Maktab dasturi', 'Milliy sertifikat', 'DTM']

export function Kurslar() {
  const [yosh, setYosh] = useState<Yosh>('hammasi')
  const mos = (id: Yonalish['id']) => yosh === 'hammasi' || USLUB[id].yosh.includes(yosh)
  const soni = YONALISHLAR.filter((y) => mos(y.id)).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div role="group" aria-label="Yosh bo‘yicha tanlash" className="flex flex-wrap gap-2">
          {YOSHLAR.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={yosh === v.id}
              onClick={() => setYosh(v.id)}
              className={`min-h-11 rounded-full border px-4 text-[14px] font-semibold transition ${
                yosh === v.id
                  ? 'border-brand bg-brand text-white shadow-[0_10px_24px_-12px_var(--color-brand)]'
                  : 'border-line text-ink-2 hover:border-ink-3 hover:text-ink'
              }`}
            >
              {v.nom}
            </button>
          ))}
        </div>
        <p aria-live="polite" className="text-[13.5px] text-ink-3">
          {soni} ta yo‘nalish mos keladi
        </p>
      </div>

      <div className="grid grid-flow-dense gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {YONALISHLAR.map((y) => {
          const u = USLUB[y.id]
          return (
            <Link
              key={y.id}
              href={`/ariza?yonalish=${y.id}`}
              data-mos={mos(y.id) ? 'ha' : 'yoq'}
              aria-label={`${y.nom} — bepul sinov darsiga yozilish`}
              style={{ '--r': u.rang } as React.CSSProperties}
              className={`lb-kurs group flex sm:min-h-[230px] flex-col gap-4 rounded-[20px] p-6 ${
                u.keng ? 'sm:col-span-2' : ''
              }`}
            >
              <span
                aria-hidden="true"
                translate="no"
                className={`lb-soya-belgi pointer-events-none absolute -right-3 -bottom-8 select-none text-[150px] leading-none ${
                  u.arab ? 'lb-arab' : 'h-display'
                }`}
              >
                {u.belgi}
              </span>

              <span className="flex items-start justify-between gap-3">
                <span
                  aria-hidden="true"
                  translate="no"
                  className={`lb-belgi inline-flex size-14 items-center justify-center rounded-[14px] bg-surface-2 text-[26px] leading-none ${
                    u.arab ? 'lb-arab text-[30px]' : 'h-display'
                  }`}
                >
                  {u.belgi}
                </span>
                <span className="lbl rounded-full border border-line px-2.5 py-1 text-[10.5px]">{y.yorliq}</span>
              </span>

              <span className="flex flex-col gap-2">
                <span className="h-display text-[24px]">{y.nom}</span>
                <span className="max-w-[46ch] text-[14px] leading-relaxed text-ink-2">{y.qisqa_tavsif}</span>
              </span>

              {y.id === 'ingliz-tili' && (
                <span aria-hidden="true" className="flex items-end gap-1.5">
                  {INGLIZ_BOSQICH.map((b, n) => (
                    <span key={b} className="flex flex-1 flex-col items-center gap-1.5">
                      <span
                        className="w-full rounded-[4px] bg-[var(--r)]"
                        style={{ height: 8 + n * 6, opacity: 0.35 + n * 0.1 }}
                      />
                      <span className="hidden text-[10px] leading-none text-ink-3 lg:block">{b.replace('Pre-', 'Pre-⁠')}</span>
                    </span>
                  ))}
                </span>
              )}

              {y.id === 'matematika' && (
                <span className="flex flex-wrap gap-2">
                  {MATEM_YOL.map((m) => (
                    <span key={m} className="rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold text-ink-2">
                      {m}
                    </span>
                  ))}
                </span>
              )}

              <span className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
                <span className="text-[12.5px] text-ink-3">{y.yosh_chegarasi}</span>
                <span className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[var(--r)]">
                  Yozilish <span className="lb-strelka" aria-hidden="true">→</span>
                </span>
              </span>
            </Link>
          )
        })}

        {/* Oxirgi katak — tanlay olmaganlar uchun */}
        <Link
          href="/ariza"
          className="lb-kurs flex sm:min-h-[230px] flex-col justify-between gap-4 rounded-[20px] bg-brand p-6 text-white"
          style={{ '--r': 'var(--color-brand)', background: 'var(--color-brand)' } as React.CSSProperties}
        >
          <span className="h-display text-[24px] leading-tight">Qaysi biri mos — bilmayapsizmi?</span>
          <span className="text-[14px] leading-relaxed text-white/85">
            Birinchi kelganda darajani bepul aniqlaymiz va mos guruhni o‘zimiz taklif qilamiz.
          </span>
          <span className="inline-flex items-center gap-1.5 text-[14px] font-bold">
            Bepul maslahat <span className="lb-strelka" aria-hidden="true">→</span>
          </span>
        </Link>
      </div>
    </div>
  )
}

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
 * Har yo'nalishning belgisi va qaysi yoshga mosligi.
 * Yosh — markaz.ts dagi `yosh_chegarasi` dan: Почемучка 4–6, matematika
 * 5 yoshdan 11-sinfgacha, Scratch 16 yoshgacha. Tillar va IT maktabdan boshlab.
 */
const USLUB: Record<Yonalish['id'], { belgi: string; yosh: Yosh[]; keng?: boolean; arab?: boolean }> = {
  'ingliz-tili': { belgi: 'Aa', yosh: ['maktab', 'katta'], keng: true },
  'rus-tili': { belgi: 'Бб', yosh: ['maktab', 'katta'] },
  'arab-tili': { belgi: 'ع', yosh: ['maktab', 'katta'], arab: true },
  'turk-tili': { belgi: 'Çç', yosh: ['maktab', 'katta'] },
  matematika: { belgi: 'π', yosh: ['kichik', 'maktab'], keng: true },
  pochemuchka: { belgi: '?', yosh: ['kichik'] },
  'ai-it': { belgi: 'AI', yosh: ['maktab', 'katta'] },
  'web-dasturlash': { belgi: '</>', yosh: ['maktab', 'katta'] },
  scratch: { belgi: '{ }', yosh: ['maktab'] },
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
      <div data-ochil className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        {/* Telefonda tugmalar bir qatorda, yon tomonga suriladi */}
        <div
          role="group"
          aria-label="Yosh bo‘yicha tanlash"
          className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {YOSHLAR.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={yosh === v.id}
              onClick={() => setYosh(v.id)}
              className={`min-h-11 shrink-0 rounded-full border px-5 text-[14px] font-semibold whitespace-nowrap transition ${
                yosh === v.id ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:border-ink-3 hover:text-ink'
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

      <div className="grid grid-flow-dense gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {YONALISHLAR.map((y, n) => {
          const u = USLUB[y.id]
          return (
            <Link
              key={y.id}
              href={`/ariza?yonalish=${y.id}`}
              data-mos={mos(y.id) ? 'ha' : 'yoq'}
              data-ochil={(n % 4) * 0.05}
              aria-label={`${y.nom} — bepul sinov darsiga yozilish`}
              className={`lb-kurs group flex flex-col gap-5 rounded-[22px] p-5 sm:min-h-[260px] sm:p-7 ${u.keng ? 'sm:col-span-2' : ''}`}
            >
              <span className="flex items-start justify-between gap-3">
                <span
                  aria-hidden="true"
                  translate="no"
                  className={`lb-belgi inline-flex size-14 items-center justify-center rounded-[16px] text-[24px] leading-none sm:size-16 sm:text-[27px] ${
                    u.arab ? 'lb-arab text-[30px] sm:text-[33px]' : 'h-display'
                  }`}
                >
                  {u.belgi}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[13px] text-ink-3 tnum">
                  {String(n + 1).padStart(2, '0')}
                </span>
              </span>

              <span className="flex flex-col gap-2">
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="h-display text-[26px] leading-none sm:text-[30px]">{y.nom}</span>
                  <span className="lbl text-brand">{y.yorliq}</span>
                </span>
                <span className="max-w-[48ch] text-[14.5px] leading-relaxed text-ink-2">{y.qisqa_tavsif}</span>
              </span>

              {y.id === 'ingliz-tili' && (
                <span aria-hidden="true" className="hidden items-end gap-1.5 sm:flex">
                  {INGLIZ_BOSQICH.map((b, k) => (
                    <span key={b} className="flex flex-1 flex-col items-center gap-1.5">
                      <span
                        className={`w-full rounded-[4px] ${k === INGLIZ_BOSQICH.length - 1 ? 'bg-brand' : 'bg-ink'}`}
                        style={{ height: 6 + k * 6, opacity: k === INGLIZ_BOSQICH.length - 1 ? 1 : 0.12 + k * 0.08 }}
                      />
                      <span className="hidden text-[10px] leading-none text-ink-3 lg:block">{b}</span>
                    </span>
                  ))}
                </span>
              )}

              {y.id === 'matematika' && (
                <span className="flex flex-wrap gap-2">
                  {MATEM_YOL.map((m) => (
                    <span key={m} className="rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-2">
                      {m}
                    </span>
                  ))}
                </span>
              )}

              <span className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
                <span className="text-[13px] text-ink-3">{y.yosh_chegarasi}</span>
                <span className="lb-yozil inline-flex items-center gap-2 text-[14px] font-bold">
                  Yozilish
                  <span aria-hidden="true" className="lb-strelka flex size-8 items-center justify-center rounded-full border border-line">
                    →
                  </span>
                </span>
              </span>
            </Link>
          )
        })}

        {/* Oxirgi katak — tanlay olmaganlar uchun (sahifadagi kam sonli qizil joylardan biri) */}
        <Link
          href="/ariza"
          data-ochil="0.15"
          className="lb-kurs-qizil group flex flex-col justify-between gap-5 rounded-[22px] p-5 text-white sm:min-h-[260px] sm:p-7"
        >
          <span className="h-display text-[26px] leading-[1.05] sm:text-[28px]">Qaysi biri mos — bilmayapsizmi?</span>
          <span className="text-[14.5px] leading-relaxed text-white/85">
            Birinchi kelganda darajani bepul aniqlaymiz va mos guruhni o‘zimiz taklif qilamiz.
          </span>
          <span className="inline-flex items-center gap-2 text-[14px] font-bold">
            Bepul maslahat
            <span aria-hidden="true" className="lb-strelka flex size-8 items-center justify-center rounded-full bg-white text-brand">
              →
            </span>
          </span>
        </Link>
      </div>
    </div>
  )
}

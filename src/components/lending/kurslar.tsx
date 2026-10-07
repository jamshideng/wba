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

/** Kartani sichqoncha tomonga og'diradi va yaltirashni kursor ostiga qo'yadi */
function ogdir(e: React.PointerEvent<HTMLElement>) {
  if (e.pointerType !== 'mouse') return
  const el = e.currentTarget
  const b = el.getBoundingClientRect()
  const px = (e.clientX - b.left) / b.width
  const py = (e.clientY - b.top) / b.height
  el.style.setProperty('--ry', `${((px - 0.5) * 10).toFixed(2)}deg`)
  el.style.setProperty('--rx', `${((0.5 - py) * 10).toFixed(2)}deg`)
  el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
  el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
}
function tekisla(e: React.PointerEvent<HTMLElement>) {
  e.currentTarget.style.setProperty('--rx', '0deg')
  e.currentTarget.style.setProperty('--ry', '0deg')
}

export function Kurslar() {
  const [yosh, setYosh] = useState<Yosh>('hammasi')
  const mos = (id: Yonalish['id']) => yosh === 'hammasi' || USLUB[id].yosh.includes(yosh)
  const soni = YONALISHLAR.filter((y) => mos(y.id)).length

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3" data-ochil>
        <div role="group" aria-label="Yosh bo‘yicha tanlash" className="flex flex-wrap gap-2">
          {YOSHLAR.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={yosh === v.id}
              onClick={() => setYosh(v.id)}
              className={`min-h-12 rounded-full border-2 px-5 text-[14.5px] font-bold transition ${
                yosh === v.id ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:border-ink hover:text-ink'
              }`}
            >
              {v.nom}
            </button>
          ))}
        </div>
        <p aria-live="polite" className="text-[14px] font-semibold text-ink-3">
          {soni} ta yo‘nalish mos keladi
        </p>
      </div>

      <div className="grid grid-flow-dense gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {YONALISHLAR.map((y, n) => {
          const u = USLUB[y.id]
          return (
            <Link
              key={y.id}
              href={`/ariza?yonalish=${y.id}`}
              data-mos={mos(y.id) ? 'ha' : 'yoq'}
              data-kursor="Yozilish"
              data-ochil={(n % 4) * 0.06}
              aria-label={`${y.nom} — bepul sinov darsiga yozilish`}
              onPointerMove={ogdir}
              onPointerLeave={tekisla}
              style={{ '--r': u.rang } as React.CSSProperties}
              className={`lb-kurs group flex flex-col gap-5 rounded-[26px] p-6 text-white sm:min-h-[270px] sm:p-7 ${
                u.keng ? 'sm:col-span-2' : ''
              }`}
            >
              <span
                aria-hidden="true"
                translate="no"
                className={`lb-soya-belgi pointer-events-none absolute -right-4 -bottom-10 select-none text-[190px] leading-none ${
                  u.arab ? 'lb-arab' : 'h-display'
                }`}
              >
                {u.belgi}
              </span>

              <span className="flex items-start justify-between gap-3">
                <span
                  aria-hidden="true"
                  translate="no"
                  className={`lb-belgi inline-flex size-16 items-center justify-center rounded-[18px] bg-white text-[28px] leading-none ${
                    u.arab ? 'lb-arab text-[34px]' : 'h-display'
                  }`}
                >
                  {u.belgi}
                </span>
                <span className="lbl rounded-full bg-black/20 px-3 py-1.5 text-[10.5px] text-white">{y.yorliq}</span>
              </span>

              <span className="flex flex-col gap-2">
                <span className="h-display text-[30px] leading-none sm:text-[34px]">{y.nom}</span>
                <span className="max-w-[46ch] text-[14.5px] leading-relaxed font-medium text-white/90">{y.qisqa_tavsif}</span>
              </span>

              {y.id === 'ingliz-tili' && (
                <span aria-hidden="true" className="flex items-end gap-1.5">
                  {INGLIZ_BOSQICH.map((b, k) => (
                    <span key={b} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className="w-full rounded-[5px] bg-white" style={{ height: 8 + k * 7, opacity: 0.35 + k * 0.1 }} />
                      <span className="hidden text-[10px] leading-none text-white/80 lg:block">{b}</span>
                    </span>
                  ))}
                </span>
              )}

              {y.id === 'matematika' && (
                <span className="flex flex-wrap gap-2">
                  {MATEM_YOL.map((m) => (
                    <span key={m} className="rounded-full bg-white/20 px-3.5 py-1.5 text-[13px] font-bold">
                      {m}
                    </span>
                  ))}
                </span>
              )}

              <span className="mt-auto flex items-center justify-between gap-3 border-t border-white/25 pt-4">
                <span className="text-[13px] font-semibold text-white/85">{y.yosh_chegarasi}</span>
                <span className="lb-yozil inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13.5px] font-bold">
                  Yozilish <span className="lb-strelka" aria-hidden="true">→</span>
                </span>
              </span>
            </Link>
          )
        })}

        {/* Oxirgi katak — tanlay olmaganlar uchun */}
        <Link
          href="/ariza"
          data-kursor="Maslahat"
          data-ochil="0.18"
          onPointerMove={ogdir}
          onPointerLeave={tekisla}
          className="lb-kurs lb-kurs-qora flex flex-col justify-between gap-5 rounded-[26px] p-6 sm:min-h-[270px] sm:p-7"
        >
          <span className="h-display text-[28px] leading-[1.05]">Qaysi biri mos — bilmayapsizmi?</span>
          <span className="text-[14.5px] leading-relaxed text-ink-2">
            Birinchi kelganda darajani bepul aniqlaymiz va mos guruhni o‘zimiz taklif qilamiz.
          </span>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-[14px] font-bold text-white">
            Bepul maslahat <span className="lb-strelka" aria-hidden="true">→</span>
          </span>
        </Link>
      </div>
    </div>
  )
}

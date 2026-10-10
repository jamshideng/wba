'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { kirishKlass } from '@/components/forma'
import { bozorXarid } from '../actions'

function Tolov({ ball }: { ball: number }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 flex-1 rounded-[10px] bg-brand px-5 text-[14.5px] font-bold text-white transition hover:brightness-110 disabled:opacity-60"
    >
      {pending ? 'To‘lanmoqda…' : `Tasdiqlash — ${ball.toLocaleString('ru-RU')} woblar`}
    </button>
  )
}

/**
 * An'anaviy bozor xaridi: o'quvchi nom va woblarni o'zi yozadi.
 * "To'lov qilish" → sahifa ichida tasdiq → woblar yechiladi (market_bozor_xarid).
 * Balans bazada qayta tekshiriladi — bu yer faqat ko'rsatadi.
 */
export function BozorXaridForma({ balans }: { balans: number }) {
  const [nom, setNom] = useState('')
  const [ball, setBall] = useState('')
  const [tasdiq, setTasdiq] = useState(false)
  const son = Number(ball.replace(/\s/g, ''))
  const togri = nom.trim().length >= 2 && Number.isInteger(son) && son >= 1
  const qoladi = balans - (togri ? son : 0)
  const yetadi = qoladi >= 0

  return (
    <form action={bozorXarid} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="lbl">Nima sotib oldingiz?</span>
        <input
          name="nom"
          required
          maxLength={120}
          autoComplete="off"
          value={nom}
          onChange={(e) => { setNom(e.target.value); setTasdiq(false) }}
          placeholder="Masalan: shokolad, ruchka, brelok…"
          className={kirishKlass}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="lbl">Necha woblar?</span>
        <input
          name="ball"
          required
          inputMode="numeric"
          pattern="[0-9 ]*"
          autoComplete="off"
          value={ball}
          onChange={(e) => { setBall(e.target.value.replace(/[^\d ]/g, '')); setTasdiq(false) }}
          placeholder="Masalan: 50"
          className={`${kirishKlass} tnum`}
        />
      </label>

      {!tasdiq ? (
        <button
          type="button"
          disabled={!togri || !yetadi}
          onClick={() => setTasdiq(true)}
          className="min-h-12 rounded-[10px] bg-brand px-5 text-[15px] font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3"
        >
          {!togri
            ? 'To‘lov qilish'
            : yetadi
              ? `To‘lov qilish — ${son.toLocaleString('ru-RU')} woblar`
              : `Woblar yetmaydi: yana ${(-qoladi).toLocaleString('ru-RU')} kerak`}
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-[12px] border border-accent-line bg-accent-soft p-4">
          <p className="text-[13.5px] leading-relaxed text-ink">
            <b>{nom.trim()}</b> uchun <b>{son.toLocaleString('ru-RU')} woblar</b> yechiladi, sizda{' '}
            <b>{qoladi.toLocaleString('ru-RU')}</b> qoladi. Keyin chek chiqadi — uni adminga ko‘rsatib, narsangizni olasiz.
          </p>
          <div className="flex flex-wrap gap-2">
            <Tolov ball={son} />
            <button
              type="button"
              onClick={() => setTasdiq(false)}
              className="min-h-12 rounded-[10px] border border-line bg-surface px-5 text-[14px] text-ink-2 hover:text-ink"
            >
              Bekor
            </button>
          </div>
        </div>
      )}
    </form>
  )
}

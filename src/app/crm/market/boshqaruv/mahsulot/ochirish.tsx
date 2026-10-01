'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { mahsulotOchir } from '../../actions'

function Tasdiq() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-[10px] bg-brand px-5 text-[13.5px] font-bold text-white transition hover:brightness-110 disabled:opacity-60"
    >
      {pending ? 'O‘chirilmoqda…' : 'Ha, butunlay o‘chirish'}
    </button>
  )
}

/** "Mahsulotni o'chirish" — sahifa ichida tasdiq (brauzer confirm emas) */
export function MahsulotOchirish({ id, nom, ochiq, berilgan }: { id: string; nom: string; ochiq: number; berilgan: number }) {
  const [ochildi, setOchildi] = useState(false)

  return (
    <section className="flex flex-col gap-3 rounded-[12px] border border-brand/30 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <span className="text-[14px] font-bold text-ink">Mahsulotni o‘chirish</span>
          <span className="text-[12.5px] text-ink-3">Vitrinadan, boshqaruvdan va rasmlari bilan butunlay o‘chadi.</span>
        </span>
        {!ochildi && (
          <button
            type="button"
            onClick={() => setOchildi(true)}
            className="min-h-11 rounded-[10px] border border-brand px-5 text-[13.5px] font-semibold text-brand transition hover:bg-brand-soft"
          >
            O‘chirish
          </button>
        )}
      </div>

      {ochildi && (
        <form action={mahsulotOchir} className="flex flex-col gap-3 rounded-[10px] bg-brand-soft p-3.5">
          <input type="hidden" name="id" value={id} />
          <p className="text-[13px] leading-relaxed text-ink">
            <b>“{nom}”</b> butunlay o‘chiriladi, qaytarib bo‘lmaydi.
            {ochiq > 0 && (
              <>
                {' '}<b>{ochiq} ta ochiq buyurtma</b> bekor qilinadi — woblar o‘quvchilarga qaytadi va ularga xabar boradi.
              </>
            )}
            {berilgan > 0 && <> Berib bo‘lingan {berilgan} ta buyurtma tarixda nomi bilan qoladi.</>}
          </p>
          <div className="flex flex-wrap gap-2">
            <Tasdiq />
            <button
              type="button"
              onClick={() => setOchildi(false)}
              className="min-h-11 rounded-[10px] border border-line bg-surface px-5 text-[13.5px] text-ink-2 hover:text-ink"
            >
              Bekor
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

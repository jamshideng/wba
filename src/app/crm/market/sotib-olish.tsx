'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { buyurtmaBer } from './actions'

function Tasdiq({ jami }: { jami: number }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 flex-1 rounded-[10px] bg-brand px-5 text-[14.5px] font-bold text-white transition hover:brightness-110 disabled:opacity-60"
    >
      {pending ? 'Buyurtma berilmoqda…' : `Tasdiqlash — ${jami.toLocaleString('ru-RU')} woblar`}
    </button>
  )
}

/**
 * "Olish" — soni tanlanadi, keyin sahifa ichida tasdiq (brauzer confirm emas).
 * Balans va ombor bazada qayta tekshiriladi (market_buyurtma), bu yer faqat
 * ko'rsatadi.
 */
export function SotibOlish({
  rewardId,
  narx,
  balans,
  maks,
  oldindan = false,
}: {
  rewardId: string
  narx: number
  balans: number
  /** Bir buyurtmada eng ko'p dona (ombor va 5 dan oshmaydi) */
  maks: number
  /** Oldindan buyurtma — tovar keyin keladi */
  oldindan?: boolean
}) {
  const [soni, setSoni] = useState(1)
  const [tasdiq, setTasdiq] = useState(false)
  const jami = narx * soni
  const qoladi = balans - jami
  const yetadi = qoladi >= 0

  return (
    <form action={buyurtmaBer} className="flex flex-col gap-3">
      <input type="hidden" name="reward_id" value={rewardId} />
      <input type="hidden" name="soni" value={soni} />

      {maks > 1 && (
        <div className="flex items-center gap-3">
          <span className="lbl">Soni</span>
          <span className="flex items-center rounded-[10px] border border-line">
            <button
              type="button"
              onClick={() => { setSoni((v) => Math.max(1, v - 1)); setTasdiq(false) }}
              className="size-11 text-[18px] text-ink-2 hover:text-ink disabled:opacity-40"
              disabled={soni <= 1}
              aria-label="Kamaytirish"
            >
              −
            </button>
            <span className="tnum w-10 text-center text-[15px] font-bold">{soni}</span>
            <button
              type="button"
              onClick={() => { setSoni((v) => Math.min(maks, v + 1)); setTasdiq(false) }}
              className="size-11 text-[18px] text-ink-2 hover:text-ink disabled:opacity-40"
              disabled={soni >= maks}
              aria-label="Ko‘paytirish"
            >
              +
            </button>
          </span>
        </div>
      )}

      {!tasdiq ? (
        <button
          type="button"
          disabled={!yetadi}
          onClick={() => setTasdiq(true)}
          className="min-h-12 rounded-[10px] bg-brand px-5 text-[15px] font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3"
        >
          {yetadi
            ? `${oldindan ? 'Oldindan olish' : 'Olish'} — ${jami.toLocaleString('ru-RU')} woblar`
            : `Yana ${(-qoladi).toLocaleString('ru-RU')} woblar kerak`}
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-[12px] border border-accent-line bg-accent-soft p-4">
          <p className="text-[13.5px] leading-relaxed text-ink">
            <b>{jami.toLocaleString('ru-RU')} woblar</b> {oldindan ? 'band qilinadi' : 'yechiladi'}, sizda <b>{qoladi.toLocaleString('ru-RU')}</b> qoladi.{' '}
            {oldindan
              ? 'Chek kodi beriladi. Tovar kelganda xabar olasiz — keyin kodni adminga ko‘rsatib, sovg‘ani olasiz.'
              : 'Buyurtmadan keyin chek kodi beriladi — uni adminga ko‘rsatib, sovg‘ani olasiz.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Tasdiq jami={jami} />
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

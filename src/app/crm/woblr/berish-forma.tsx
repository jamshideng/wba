'use client'

import { useMemo, useState } from 'react'
import { Maydon, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { woblrBer } from './actions'

export type BerishOquvchi = { id: string; fish: string; guruhlar: string[] }

/** Qidiruv uchun: kichik harf, tutuq belgilarsiz */
const tekis = (s: string) => s.toLowerCase().replace(/[ʻʼ’‘`´']/g, '').replace(/\s+/g, ' ').trim()

/**
 * Woblar berish: guruh → o'quvchi. Ism yoki ID (S015) bo'yicha qidirilsa,
 * birinchi mos o'quvchi ro'yxatda o'zi tanlanadi. Ro'yxatni server beradi:
 * ustozga — faqat o'z o'quvchilari, adminga — hamma (RLS ham tekshiradi).
 */
export function WoblarBerishForma({
  guruhlar,
  oquvchilar,
  boshGuruh,
  chegara,
  admin,
  qaytish,
  limit,
}: {
  guruhlar: { id: string; nom: string }[]
  oquvchilar: BerishOquvchi[]
  boshGuruh: string | null
  chegara: number
  admin: boolean
  /** Berilgandan keyin shu ko'rinishga qaytadi (reyting tanlovi saqlanadi) */
  qaytish: string
  /** Ustozning oylik limiti (0064): guruh → qoldi; admin uchun null */
  limit: { jami: number; guruhlar: Record<string, number> } | null
}) {
  const [guruh, setGuruh] = useState(boshGuruh && guruhlar.some((g) => g.id === boshGuruh) ? boshGuruh : '')
  const [qidiruv, setQidiruv] = useState('')
  const [tanlangan, setTanlangan] = useState('')

  const royxat = useMemo(() => {
    const q = tekis(qidiruv)
    return oquvchilar
      .filter((o) => !guruh || o.guruhlar.includes(guruh))
      .filter((o) => !q || tekis(o.fish).includes(q) || o.id.toLowerCase().includes(q))
  }, [oquvchilar, guruh, qidiruv])

  // Qidiruvda tanlangan o'quvchi ro'yxatdan chiqib ketsa — birinchi mosi tanlanadi
  const qiymat = royxat.some((o) => o.id === tanlangan) ? tanlangan : qidiruv.trim() && royxat[0] ? royxat[0].id : ''
  const boshqaGuruh = guruh || oquvchilar.find((o) => o.id === qiymat)?.guruhlar[0] || ''

  return (
    <form action={woblrBer} className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.3fr_1.2fr_1.6fr_0.8fr_1fr_1.3fr_auto] xl:items-end">
      <input type="hidden" name="guruh" value={boshqaGuruh} />
      <input type="hidden" name="qaytish" value={qaytish} />
      <Maydon nom="Guruh">
        <select value={guruh} onChange={(e) => { setGuruh(e.target.value); setTanlangan('') }} className={kirishKlass}>
          <option value="">{admin ? 'Barcha guruhlar' : 'Barcha guruhlarim'}</option>
          {guruhlar.map((g) => (
            <option key={g.id} value={g.id}>{g.nom}{limit ? ` · qoldi ${limit.guruhlar[g.id] ?? 0}` : ''}</option>
          ))}
        </select>
      </Maydon>
      <Maydon nom="Qidiruv">
        <input
          type="search"
          value={qidiruv}
          onChange={(e) => setQidiruv(e.target.value)}
          placeholder="Ism yoki ID (S015)"
          autoComplete="off"
          className={kirishKlass}
        />
      </Maydon>
      <Maydon nom={`O‘quvchi · ${royxat.length}`}>
        <select name="student_id" required value={qiymat} onChange={(e) => setTanlangan(e.target.value)} className={kirishKlass}>
          <option value="" disabled>{royxat.length ? 'Tanlang…' : 'Topilmadi'}</option>
          {royxat.map((o) => (
            <option key={o.id} value={o.id}>{o.fish} · {o.id}</option>
          ))}
        </select>
      </Maydon>
      <Maydon nom="Woblar" izoh={admin ? 'Chegara yo‘q (admin)' : `−${chegara}…+${chegara}`}>
        <input name="ball" type="number" min={-chegara} max={chegara} step={1} defaultValue={1} required className={kirishKlass} />
      </Maydon>
      <Maydon nom="Sabab">
        <select name="sabab" defaultValue="faollik" className={kirishKlass}>
          <option value="faollik">Faollik</option>
          <option value="uy_vazifasi">Uy vazifasi</option>
          <option value="yordam">Yordam berdi</option>
          <option value="qoida">Qoida buzdi</option>
          <option value="boshqa">Boshqa</option>
        </select>
      </Maydon>
      <Maydon nom="Izoh">
        <input name="izoh" placeholder="Ixtiyoriy" className={kirishKlass} />
      </Maydon>
      <Yuborish>Berish</Yuborish>
      {limit && (
        <p className="text-[12.5px] text-ink-2 sm:col-span-full">
          Oylik limit:{' '}
          {boshqaGuruh ? (
            <>
              shu guruh uchun <b className="tnum">{limit.guruhlar[boshqaGuruh] ?? 0}</b> qoldi ·{' '}
            </>
          ) : null}
          jami <b className="tnum">{limit.jami}</b> qoldi. O‘quvchining guruhi avtomatik topiladi — woblar o‘sha guruh limitidan ham ayriladi.
        </p>
      )}
    </form>
  )
}

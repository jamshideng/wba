'use client'

import { useMemo, useState } from 'react'
import { Card, Empty } from '@/components/ui'
import { Maydon, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { pul, sanaQisqa } from '@/lib/format'
import { shaxsiyMatn } from '@/lib/elon'
import { qarzEslatmaYubor } from './actions'

export type EslatmaQarzdor = {
  id: string
  fish: string
  guruhlar: string | null
  qarz: number
  oxirgi: string | null
  telegram: { oquvchi: boolean; ota_ona: boolean }
}

const ANDOZA =
  'Assalomu alaykum! {ism} bo‘yicha to‘lov qarzi: {qarz}. Iltimos, to‘lovni o‘z vaqtida amalga oshiring. Savollar bo‘lsa, qabulxonaga murojaat qiling. — WBA o‘quv markazi'

export function EslatmaForma({ qarzdorlar }: { qarzdorlar: EslatmaQarzdor[] }) {
  const [min, setMin] = useState('')
  const [olibTashlangan, setOlibTashlangan] = useState<Set<string>>(new Set())
  const [matn, setMatn] = useState(ANDOZA)

  const minSumma = Number(min.replace(/\s/g, '')) || 0
  const korinadi = useMemo(() => qarzdorlar.filter((q) => q.qarz >= minSumma), [qarzdorlar, minSumma])
  const belgili = korinadi.filter((q) => !olibTashlangan.has(q.id))
  const jami = belgili.reduce((s, q) => s + q.qarz, 0)
  const namuna = belgili[0]

  const almashtir = (id: string) =>
    setOlibTashlangan((x) => {
      const y = new Set(x)
      if (y.has(id)) y.delete(id)
      else y.add(id)
      return y
    })

  if (!qarzdorlar.length) return <Empty>Qarzdor yo‘q — eslatma yuboradigan odam yo‘q.</Empty>

  return (
    <form action={qarzEslatmaYubor} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card className="flex flex-col">
        <div className="flex flex-wrap items-end gap-3 border-b border-line-soft px-5 py-3">
          <Maydon nom="Qarzi kamida (so‘m)" className="w-48">
            <input
              inputMode="numeric"
              value={min}
              onChange={(e) => setMin(e.target.value.replace(/[^\d\s]/g, ''))}
              placeholder="0"
              className={kirishKlass}
            />
          </Maydon>
          <button type="button" onClick={() => setOlibTashlangan(new Set())} className="min-h-11 rounded-[9px] border border-line px-3 text-[13px] text-ink-2 hover:text-ink">
            Hammasini belgilash
          </button>
          <button type="button" onClick={() => setOlibTashlangan(new Set(korinadi.map((q) => q.id)))} className="min-h-11 rounded-[9px] border border-line px-3 text-[13px] text-ink-2 hover:text-ink">
            Belgini olib tashlash
          </button>
          <span className="ml-auto text-[13px] text-ink-3">
            Belgilangan: <b className="text-ink">{belgili.length}</b> / {korinadi.length} · <span className="tnum">{pul(jami)}</span> so‘m
          </span>
        </div>

        {korinadi.length === 0 ? (
          <div className="p-5"><Empty>Bu summadan ko‘p qarzi bor o‘quvchi yo‘q.</Empty></div>
        ) : (
          <ul>
            {korinadi.map((q) => {
              const bor = !olibTashlangan.has(q.id)
              return (
                <li key={q.id} className="border-b border-line-soft last:border-0">
                  <label className="flex min-h-14 cursor-pointer flex-wrap items-center gap-3 px-5 py-2.5">
                    <input type="checkbox" name="s" value={q.id} checked={bor} onChange={() => almashtir(q.id)} className="size-5 accent-brand" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[13.5px] font-semibold">{q.fish}</span>
                      <span className="truncate text-[11.5px] text-ink-3">
                        {q.guruhlar ?? '—'} · Telegram: {q.telegram.oquvchi ? 'o‘quvchi' : ''}{q.telegram.oquvchi && q.telegram.ota_ona ? ', ' : ''}{q.telegram.ota_ona ? 'ota-ona' : ''}{!q.telegram.oquvchi && !q.telegram.ota_ona ? 'ulanmagan' : ''}
                        {' · '}{q.oxirgi ? `oxirgi eslatma ${sanaQisqa(q.oxirgi)}` : 'eslatilmagan'}
                      </span>
                    </span>
                    <span className="tnum font-[family-name:var(--font-mono)] text-[14px] text-brand">{pul(q.qarz)}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card className="flex h-fit flex-col gap-3.5 p-5 xl:sticky xl:top-4">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="lbl mb-1.5">Kimga</legend>
          <div className="flex flex-wrap gap-2">
            {[['oquvchi', 'O‘quvchiga'], ['ota_ona', 'Ota-onaga']].map(([v, n]) => (
              <label key={v} className="flex min-h-11 items-center gap-2 rounded-[9px] border border-line bg-surface px-3 text-[13px]">
                <input type="checkbox" name="k" value={v} defaultChecked className="size-4 accent-brand" />
                {n}
              </label>
            ))}
          </div>
        </fieldset>

        <Maydon nom="Sarlavha (sayt va ilovada)">
          <input name="sarlavha" defaultValue="To‘lov eslatmasi" maxLength={120} className={kirishKlass} />
        </Maydon>

        <Maydon nom="Matn" izoh="{ism} — o‘quvchi ismi, {qarz} — uning qarzi, {oy} — joriy oy. Har kimga o‘z summasi bilan boradi.">
          <textarea name="matn" value={matn} onChange={(e) => setMatn(e.target.value)} rows={6} maxLength={1500} className={`${kirishKlass} py-2.5`} />
        </Maydon>

        {namuna && (
          <div className="rounded-[10px] border border-line-soft bg-surface-2 p-3 text-[12.5px] leading-snug text-ink-2">
            <span className="lbl mb-1 block">Namuna — {namuna.fish}</span>
            {shaxsiyMatn(matn, { ism: namuna.fish, qarz: namuna.qarz })}
          </div>
        )}

        <p className="text-[11.5px] leading-snug text-ink-3">
          Uchala kanal birga: Telegram (botga ulanganlarga), sayt va ilova ichida, telefon xabarnomasi. Saytdagi eslatma {10} kun turadi, qarz uzilsa darhol yo‘qoladi; qayta yuborilsa oldingisi yopiladi.
        </p>

        <Yuborish kutish="Yuborilmoqda…" className="min-h-11">
          {belgili.length} ta qarzdorga yuborish
        </Yuborish>
      </Card>
    </form>
  )
}

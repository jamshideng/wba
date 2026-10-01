'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { kirishKlass } from '@/components/forma'
import { mahsulotSaqla } from '../../actions'
import { RASM_MAKS_BAYT, RASM_TURLARI, type Mahsulot } from '@/lib/market'
import { MahsulotRasm } from '../../bolaklar'

function Saqlash({ yangi }: { yangi: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 rounded-[10px] bg-brand px-6 text-[14px] font-bold text-white transition hover:brightness-110 disabled:opacity-60"
    >
      {pending ? 'Saqlanmoqda…' : yangi ? 'Marketga qo‘shish' : 'Saqlash'}
    </button>
  )
}

function Maydon({ nom, izoh, children }: { nom: string; izoh?: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="lbl">{nom}</span>
      {children}
      {izoh && <span className="text-[11.5px] leading-snug text-ink-3">{izoh}</span>}
    </label>
  )
}

/** Mahsulot qo'shish/tahrirlash. Rasm tanlanganda darhol oldindan ko'rinadi. */
export function MahsulotForma({ m, toifalar }: { m: Mahsulot | null; toifalar: string[] }) {
  const [cheksiz, setCheksiz] = useState(m?.cheksiz ?? false)
  const [korinish, setKorinish] = useState<string | null>(m?.rasm_url ?? null)
  const [olib, setOlib] = useState(false)
  const [rasmXato, setRasmXato] = useState<string | null>(null)

  return (
    <form action={mahsulotSaqla} className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
      {m && <input type="hidden" name="id" value={m.id} />}
      <input type="hidden" name="rasm_olib" value={olib ? '1' : ''} />

      <div className="flex flex-col gap-2">
        <span className="lbl">Rasm</span>
        <div className="overflow-hidden rounded-[14px] border border-line">
          <MahsulotRasm url={olib ? null : korinish} nom={m?.nom ?? 'Yangi mahsulot'} />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border border-line bg-surface px-4 text-[13px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink">
          {korinish && !olib ? 'Boshqa rasm tanlash' : 'Rasm tanlash'}
          <input
            type="file"
            name="rasm"
            accept={RASM_TURLARI.join(',')}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              setRasmXato(null)
              if (!f) return
              if (!RASM_TURLARI.includes(f.type as (typeof RASM_TURLARI)[number])) {
                setRasmXato('Faqat JPG, PNG yoki WEBP.')
                e.target.value = ''
                return
              }
              if (f.size > RASM_MAKS_BAYT) {
                setRasmXato('Rasm 3 MB dan katta. Kichikroq rasm tanlang.')
                e.target.value = ''
                return
              }
              setOlib(false)
              setKorinish(URL.createObjectURL(f))
            }}
          />
        </label>
        {m?.rasm_url && !olib && (
          <button
            type="button"
            onClick={() => setOlib(true)}
            className="min-h-11 text-[12.5px] text-ink-3 hover:text-brand"
          >
            Rasmni olib tashlash
          </button>
        )}
        {rasmXato && <span role="alert" className="text-[12px] text-brand">{rasmXato}</span>}
        <span className="text-[11.5px] text-ink-3">Kvadrat rasm yaxshi ko‘rinadi. JPG/PNG/WEBP, 3 MB gacha.</span>
      </div>

      <div className="flex flex-col gap-4">
        <Maydon nom="Nomi">
          <input name="nom" required maxLength={120} defaultValue={m?.nom ?? ''} placeholder="Masalan: WBA daftar" className={kirishKlass} />
        </Maydon>

        <div className="grid gap-4 sm:grid-cols-2">
          <Maydon nom="Narxi (woblarda)">
            <input name="narx_ball" type="number" required min={1} step={1} inputMode="numeric" defaultValue={m?.narx_ball ?? ''} className={kirishKlass} />
          </Maydon>
          <Maydon nom="Toifa" izoh="Vitrinada filtr bo‘lib chiqadi">
            <input name="toifa" list="market-toifalar" maxLength={40} defaultValue={m?.toifa ?? ''} placeholder="Kanselyariya, Kiyim…" className={kirishKlass} />
            <datalist id="market-toifalar">
              {toifalar.map((t) => <option key={t} value={t} />)}
            </datalist>
          </Maydon>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Maydon nom="Omborda nechta">
            <input
              name="qolgan_soni"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              disabled={cheksiz}
              defaultValue={m && !m.cheksiz ? m.qolgan_soni : ''}
              placeholder={cheksiz ? 'Cheksiz' : '0'}
              className={`${kirishKlass} disabled:opacity-50`}
            />
          </Maydon>
          <label className="flex min-h-11 items-center gap-2.5 self-end text-[13.5px] text-ink-2">
            <input type="checkbox" name="cheksiz" value="1" checked={cheksiz} onChange={(e) => setCheksiz(e.target.checked)} className="size-5 accent-brand" />
            Cheksiz (soni sanalmaydi)
          </label>
        </div>

        <Maydon nom="Tavsif">
          <textarea name="tavsif" rows={4} maxLength={1000} defaultValue={m?.tavsif ?? ''} placeholder="O‘lchami, rangi, qanday narsa…" className={`${kirishKlass} py-2.5`} />
        </Maydon>

        <div className="grid gap-4 sm:grid-cols-2">
          <Maydon nom="Holati">
            <select name="holat" defaultValue={m?.holat ?? 'faol'} className={kirishKlass}>
              <option value="faol">Sotuvda</option>
              <option value="yopilgan">Yopilgan (vitrinada ko‘rinmaydi)</option>
            </select>
          </Maydon>
          <Maydon nom="Tartib" izoh="Kattasi vitrinada birinchi turadi">
            <input name="tartib" type="number" step={1} inputMode="numeric" defaultValue={m?.tartib ?? 0} className={kirishKlass} />
          </Maydon>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Saqlash yangi={!m} />
        </div>
      </div>
    </form>
  )
}

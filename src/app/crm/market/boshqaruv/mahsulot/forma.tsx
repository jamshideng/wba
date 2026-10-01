'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { kirishKlass } from '@/components/forma'
import { createClient } from '@/lib/supabase/client'
import { mahsulotSaqla } from '../../actions'
import { RASM_MAKS_BAYT, RASM_MAKS_SONI, RASM_TURLARI, kunOy, type Mahsulot } from '@/lib/market'
import { MahsulotRasm } from '../../bolaklar'

type Rejim = 'sotuvda' | 'oldindan' | 'yopilgan'

function Saqlash({ yangi, band }: { yangi: boolean; band: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || band}
      className="min-h-12 rounded-[10px] bg-brand px-6 text-[14px] font-bold text-white transition hover:brightness-110 disabled:opacity-60"
    >
      {band ? 'Rasmlar yuklanmoqda…' : pending ? 'Saqlanmoqda…' : yangi ? 'Marketga qo‘shish' : 'Saqlash'}
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

const REJIMLAR: { k: Rejim; nom: string; izoh: string }[] = [
  { k: 'sotuvda', nom: 'Sotuvda', izoh: 'Tovar markazda bor — o‘quvchi oladi va shu zahoti olib ketadi.' },
  { k: 'oldindan', nom: 'Oldindan buyurtma', izoh: 'Vitrinada ko‘rinadi, o‘quvchi zakaz beradi. Tovar bozor kuni (yoki siz belgilagan sanada) keladi.' },
  { k: 'yopilgan', nom: 'Yopilgan', izoh: 'Vitrinada ko‘rinmaydi. Berilgan buyurtmalar saqlanadi.' },
]

/**
 * Mahsulot qo'shish/tahrirlash.
 * Rasmlar brauzerdan to'g'ridan-to'g'ri Storage'ga yuklanadi (serverga
 * faqat manzillar boradi — Vercel so'rov hajmi cheklovi ~4,5 MB).
 */
export function MahsulotForma({
  m,
  toifalar,
  bozor,
  zakazlar,
}: {
  m: Mahsulot | null
  toifalar: string[]
  bozor: string | null
  /** Shu mahsulotning kelishi kutilayotgan oldindan buyurtmalari soni */
  zakazlar: number
}) {
  const boshRejim: Rejim = !m ? 'sotuvda' : m.holat !== 'faol' ? 'yopilgan' : m.rejim
  const [rejim, setRejim] = useState<Rejim>(boshRejim)
  const [cheksiz, setCheksiz] = useState(m?.cheksiz ?? false)
  const [rasmlar, setRasmlar] = useState<string[]>(m?.rasmlar?.length ? m.rasmlar : m?.rasm_url ? [m.rasm_url] : [])
  const [yuklanmoqda, setYuklanmoqda] = useState(0)
  const [rasmXato, setRasmXato] = useState<string | null>(null)
  const [tanlangan, setTanlangan] = useState(0)

  async function yukla(fayllar: FileList | null) {
    setRasmXato(null)
    if (!fayllar?.length) return
    const joy = RASM_MAKS_SONI - rasmlar.length
    const royxat = Array.from(fayllar)
    if (royxat.length > joy) setRasmXato(`Ko‘pi bilan ${RASM_MAKS_SONI} ta rasm. ${joy} tasi olindi.`)
    const supabase = createClient()
    const olindi = royxat.slice(0, Math.max(0, joy))
    setYuklanmoqda((n) => n + olindi.length)
    for (const f of olindi) {
      try {
        if (!RASM_TURLARI.includes(f.type as (typeof RASM_TURLARI)[number])) throw new Error(`${f.name}: faqat JPG, PNG yoki WEBP.`)
        if (f.size > RASM_MAKS_BAYT) throw new Error(`${f.name}: 3 MB dan katta.`)
        const kengaytma = f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : 'jpg'
        const yol = `${crypto.randomUUID()}.${kengaytma}`
        const { error } = await supabase.storage.from('market').upload(yol, f, { contentType: f.type, cacheControl: '31536000' })
        if (error) throw new Error(`${f.name}: ${error.message}`)
        const url = supabase.storage.from('market').getPublicUrl(yol).data.publicUrl
        setRasmlar((r) => [...r, url].slice(0, RASM_MAKS_SONI))
      } catch (e) {
        setRasmXato(e instanceof Error ? e.message : 'Rasm yuklanmadi.')
      } finally {
        setYuklanmoqda((n) => n - 1)
      }
    }
  }

  const asosiy = (i: number) => {
    setRasmlar((r) => [r[i], ...r.filter((_, j) => j !== i)])
    setTanlangan(0)
  }
  const olib = (i: number) => {
    setRasmlar((r) => r.filter((_, j) => j !== i))
    setTanlangan(0)
  }
  const korinadi = rasmlar[Math.min(tanlangan, rasmlar.length - 1)] ?? null
  const ozgardiRejim = m && boshRejim !== rejim

  return (
    <form action={mahsulotSaqla} className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
      {m && <input type="hidden" name="id" value={m.id} />}
      <input type="hidden" name="rasmlar" value={JSON.stringify(rasmlar)} />

      {/* ── Rasmlar ── */}
      <div className="flex flex-col gap-2">
        <span className="lbl">Rasmlar · {rasmlar.length}/{RASM_MAKS_SONI}</span>
        <div className="overflow-hidden rounded-[14px] border border-line">
          <MahsulotRasm url={korinadi} nom={m?.nom ?? 'Yangi mahsulot'} />
        </div>

        {rasmlar.length > 0 && (
          <ul className="grid grid-cols-4 gap-2">
            {rasmlar.map((u, i) => (
              <li key={u} className="group relative">
                <button
                  type="button"
                  onClick={() => setTanlangan(i)}
                  aria-label={`${i + 1}-rasmni ko‘rish`}
                  className={`block w-full overflow-hidden rounded-[9px] border-2 ${i === tanlangan ? 'border-brand' : 'border-transparent'}`}
                >
                  <MahsulotRasm url={u} nom="" />
                </button>
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 rounded bg-brand px-1 text-[9.5px] font-bold text-white">asosiy</span>
                )}
                <span className="absolute top-1 right-1 flex gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                  {i > 0 && (
                    <button type="button" onClick={() => asosiy(i)} title="Asosiy qilish"
                      className="rounded bg-surface/90 px-1.5 text-[11px] font-bold text-ink shadow">1</button>
                  )}
                  <button type="button" onClick={() => olib(i)} title="Olib tashlash" aria-label="Rasmni olib tashlash"
                    className="rounded bg-surface/90 px-1.5 text-[12px] font-bold text-brand shadow">×</button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {rasmlar.length < RASM_MAKS_SONI && (
          <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border border-dashed border-line bg-surface px-4 text-[13px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink">
            {yuklanmoqda > 0 ? `Yuklanmoqda… (${yuklanmoqda})` : rasmlar.length ? '+ Yana rasm qo‘shish' : 'Rasm tanlash (bir nechta bo‘ladi)'}
            <input
              type="file"
              multiple
              accept={RASM_TURLARI.join(',')}
              className="sr-only"
              onChange={(e) => {
                void yukla(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        )}
        {rasmXato && <span role="alert" className="text-[12px] text-brand">{rasmXato}</span>}
        <span className="text-[11.5px] leading-snug text-ink-3">
          Birinchi rasm vitrinada chiqadi. Kvadrat rasm chiroyli ko‘rinadi. JPG/PNG/WEBP, har biri 3 MB gacha.
        </span>
      </div>

      {/* ── Ma'lumot ── */}
      <div className="flex flex-col gap-4">
        <Maydon nom="Nomi">
          <input name="nom" required maxLength={120} defaultValue={m?.nom ?? ''} placeholder="Masalan: WBA daftar" className={kirishKlass} />
        </Maydon>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        {/* Sotuv rejimi */}
        <fieldset className="flex flex-col gap-2">
          <legend className="lbl mb-1.5">Holati</legend>
          <input type="hidden" name="rejim" value={rejim} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {REJIMLAR.map((r) => (
              <button
                key={r.k}
                type="button"
                onClick={() => setRejim(r.k)}
                aria-pressed={rejim === r.k}
                className={`flex min-h-11 flex-col items-start gap-0.5 rounded-[10px] border px-3 py-2.5 text-left transition ${
                  rejim === r.k ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-ink-3'
                }`}
              >
                <span className="text-[13.5px] font-bold text-ink">{r.nom}</span>
                <span className="text-[11.5px] leading-snug text-ink-3">{r.izoh}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {rejim === 'oldindan' && (
          <Maydon
            nom="Qachon keladi"
            izoh={bozor ? `Bo‘sh qoldirsangiz — keyingi bozor kuni (${kunOy(bozor)}).` : 'Bo‘sh qoldirsangiz — bozor kuni (Boshqaruvda belgilanadi).'}
          >
            <input name="kelish_sana" type="date" defaultValue={m?.kelish_sana ?? ''} className={kirishKlass} />
          </Maydon>
        )}

        {ozgardiRejim && boshRejim === 'oldindan' && rejim === 'sotuvda' && (
          <p className="rounded-[10px] border border-accent-line bg-accent-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink">
            Tovar keldi deb belgilanadi: {zakazlar > 0 ? <b>{zakazlar} ta oldindan buyurtma</b> : 'oldindan buyurtmalar'} “tayyor” bo‘ladi
            va egalariga “zakazingiz keldi, markazdan olib keting” degan xabar boradi.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Maydon nom={rejim === 'oldindan' ? 'Nechta buyurtma olinadi' : 'Omborda nechta'}>
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

        <Maydon nom="Tartib" izoh="Kattasi vitrinada birinchi turadi">
          <input name="tartib" type="number" step={1} inputMode="numeric" defaultValue={m?.tartib ?? 0} className={`${kirishKlass} sm:max-w-40`} />
        </Maydon>

        {rejim !== 'yopilgan' && (!m || ozgardiRejim) && (
          <label className="flex min-h-11 items-start gap-2.5 rounded-[10px] border border-line bg-surface px-3.5 py-3 text-[13px] text-ink-2">
            <input type="checkbox" name="xabar" value="1" defaultChecked className="mt-0.5 size-5 shrink-0 accent-brand" />
            <span>
              <b className="text-ink">O‘quvchilarga Telegram’da e’lon qilish</b>
              <br />
              {rejim === 'oldindan'
                ? '“Oldindan buyurtma ochildi — hoziroq zakaz bering” degan xabar boradi.'
                : '“Marketda yangi tovar — endi bemalol olsa bo‘ladi” degan xabar boradi.'}
            </span>
          </label>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Saqlash yangi={!m} band={yuklanmoqda > 0} />
        </div>
      </div>
    </form>
  )
}

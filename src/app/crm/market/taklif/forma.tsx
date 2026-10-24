'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { RASM_MAKS_BAYT, RASM_TURLARI } from '@/lib/market'
import { taklifYubor } from '../actions'

export type TugaganMahsulot = { id: string; nom: string; rasm_url: string | null; narx_ball: number }

const VARIANT = 'flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-line px-3.5 text-[13.5px] has-checked:border-brand has-checked:bg-brand-soft'

/**
 * Taklif formasi (0065). Rasm ixtiyoriy — "market" bucketiga
 * takliflar/<uid>/ ostiga yuklanadi (storage siyosati faqat shu yo'lga ruxsat beradi).
 * "Tugagan mahsulot" (0089) tanlansa — faqat vitrinadagi tugagan mahsulot
 * tanlanadi, boshqa maydonlar yo'qoladi.
 */
export function TaklifForma({ uid, bozorBor, tugaganlar }: { uid: string; bozorBor: boolean; tugaganlar: TugaganMahsulot[] }) {
  const [qachon, setQachon] = useState<'keyingi_bozor' | 'umumiy' | 'tugagan'>(bozorBor ? 'keyingi_bozor' : 'umumiy')
  const tugagan = qachon === 'tugagan'
  const [rasm, setRasm] = useState<string | null>(null)
  const [yuklanmoqda, setYuklanmoqda] = useState(false)
  const [rasmXato, setRasmXato] = useState<string | null>(null)

  async function yukla(f: File | undefined) {
    setRasmXato(null)
    if (!f) return
    if (!RASM_TURLARI.includes(f.type as (typeof RASM_TURLARI)[number])) return setRasmXato('Faqat JPG, PNG yoki WEBP rasm.')
    if (f.size > RASM_MAKS_BAYT) return setRasmXato('Rasm 3 MB dan katta.')
    setYuklanmoqda(true)
    try {
      const supabase = createClient()
      const kengaytma = f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : 'jpg'
      const yol = `takliflar/${uid}/${crypto.randomUUID()}.${kengaytma}`
      const { error } = await supabase.storage.from('market').upload(yol, f, { contentType: f.type, cacheControl: '31536000' })
      if (error) throw new Error(error.message)
      setRasm(supabase.storage.from('market').getPublicUrl(yol).data.publicUrl)
    } catch (e) {
      setRasmXato(e instanceof Error ? `Rasm yuklanmadi: ${e.message}` : 'Rasm yuklanmadi.')
    } finally {
      setYuklanmoqda(false)
    }
  }

  return (
    <form action={taklifYubor} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="lbl mb-1.5">Qachon uchun</legend>
        <div className="flex flex-wrap gap-2">
          {bozorBor && (
            <label className={VARIANT}>
              <input type="radio" name="qachon" value="keyingi_bozor" checked={qachon === 'keyingi_bozor'} onChange={() => setQachon('keyingi_bozor')} /> Keyingi bozorga
            </label>
          )}
          <label className={VARIANT}>
            <input type="radio" name="qachon" value="umumiy" checked={qachon === 'umumiy'} onChange={() => setQachon('umumiy')} /> Umuman taklif
          </label>
          {tugaganlar.length > 0 && (
            <label className={VARIANT}>
              <input type="radio" name="qachon" value="tugagan" checked={tugagan} onChange={() => setQachon('tugagan')} /> Tugagan mahsulot
            </label>
          )}
        </div>
      </fieldset>

      {tugagan ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="lbl mb-1.5">Qaysi mahsulot qayta kelsin? *</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {tugaganlar.map((m) => (
              <label key={m.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border border-line p-2.5 has-checked:border-brand has-checked:bg-brand-soft">
                <input type="radio" name="mahsulot_id" value={m.id} required className="shrink-0" />
                {m.rasm_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.rasm_url} alt="" className="size-12 shrink-0 rounded-[8px] border border-line object-cover" />
                ) : (
                  <span className="size-12 shrink-0 rounded-[8px] bg-surface-2" />
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[13.5px] font-semibold">{m.nom}</span>
                  <span className="tnum text-[12px] text-ink-3">{m.narx_ball} woblar · tugagan</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
      <>
      <input type="hidden" name="rasm_url" value={rasm ?? ''} />
      <label className="flex flex-col gap-1.5">
        <span className="lbl">Nima istaysiz? *</span>
        <input name="nom" required minLength={2} maxLength={120} placeholder="Masalan: Lego to‘plami, futbol to‘pi…" className={kirishKlass} />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="lbl">Rasm (bo‘lsa)</span>
        {rasm ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={rasm} alt="Taklif rasmi" className="size-20 rounded-[10px] border border-line object-cover" />
            <button type="button" onClick={() => setRasm(null)} className="min-h-11 rounded-[10px] border border-line px-4 text-[13px] text-ink-2 hover:text-ink">
              Olib tashlash
            </button>
          </div>
        ) : (
          <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border border-dashed border-line px-4 text-[13px] text-ink-2 hover:border-ink-3 hover:text-ink">
            {yuklanmoqda ? 'Yuklanmoqda…' : 'Rasm tanlash (JPG, PNG, WEBP · 3 MB gacha)'}
            <input type="file" accept={RASM_TURLARI.join(',')} className="sr-only" disabled={yuklanmoqda} onChange={(e) => yukla(e.target.files?.[0])} />
          </label>
        )}
        {rasmXato && <span className="text-[12px] text-brand">{rasmXato}</span>}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="lbl">Havola (URL, bo‘lsa)</span>
        <input name="havola" type="url" maxLength={500} placeholder="https://uzum.uz/…" className={kirishKlass} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="lbl">Tavsifi</span>
        <textarea name="tavsif" rows={3} maxLength={1000} placeholder="Rangi, o‘lchami, qanday narsa…" className={`${kirishKlass} py-2.5`} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="lbl">Taxminan necha woblar bo‘lsa olardingiz?</span>
        <input name="taxminiy_narx" type="number" min={1} max={100000} step={1} inputMode="numeric" placeholder="Ixtiyoriy" className={`${kirishKlass} tnum sm:max-w-48`} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="lbl">Yana nimadir</span>
        <input name="izoh" maxLength={500} placeholder="Ixtiyoriy" className={kirishKlass} />
      </label>
      </>
      )}

      <Yuborish kutish="Yuborilmoqda…">Taklif yuborish</Yuborish>
    </form>
  )
}

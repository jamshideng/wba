'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { RASM_MAKS_BAYT, RASM_TURLARI } from '@/lib/market'
import { taklifYubor } from '../actions'

/**
 * Taklif formasi (0065). Rasm ixtiyoriy — "market" bucketiga
 * takliflar/<uid>/ ostiga yuklanadi (storage siyosati faqat shu yo'lga ruxsat beradi).
 */
export function TaklifForma({ uid, bozorBor }: { uid: string; bozorBor: boolean }) {
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
      <input type="hidden" name="rasm_url" value={rasm ?? ''} />
      <label className="flex flex-col gap-1.5">
        <span className="lbl">Nima istaysiz? *</span>
        <input name="nom" required minLength={2} maxLength={120} placeholder="Masalan: Lego to‘plami, futbol to‘pi…" className={kirishKlass} />
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="lbl mb-1.5">Qachon uchun</legend>
        <div className="flex flex-wrap gap-2">
          {bozorBor && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-line px-3.5 text-[13.5px] has-checked:border-brand has-checked:bg-brand-soft">
              <input type="radio" name="qachon" value="keyingi_bozor" defaultChecked /> Keyingi bozorga
            </label>
          )}
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-line px-3.5 text-[13.5px] has-checked:border-brand has-checked:bg-brand-soft">
            <input type="radio" name="qachon" value="umumiy" defaultChecked={!bozorBor} /> Umuman taklif
          </label>
        </div>
      </fieldset>

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

      <Yuborish kutish="Yuborilmoqda…">Taklif yuborish</Yuborish>
    </form>
  )
}

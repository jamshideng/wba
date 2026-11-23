'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { RASM_MAKS_BAYT, RASM_TURLARI } from '@/lib/market'
import { taklifTahrir, taklifYubor } from './taklif-actions'

export type TaklifQiymat = {
  id: string; nom: string; subject_id: string; soni: number; sabab: string; rasm_url: string; havola: string | null
}

/**
 * Ustoz kitob taklifi formasi (0144). Muqova MAJBURIY — "kitoblar" bucketiga
 * takliflar/<uid>/ ostiga yuklanadi (storage siyosati faqat shu yo'lga ruxsat beradi).
 * Internetdan topilgan rasm — avval saqlab, keyin fayl sifatida yuklanadi.
 */
export function TaklifForma({ uid, fanlar, qiymat }: { uid: string; fanlar: { id: string; nom: string }[]; qiymat?: TaklifQiymat }) {
  const [rasm, setRasm] = useState<string | null>(qiymat?.rasm_url ?? null)
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
      const { error } = await supabase.storage.from('kitoblar').upload(yol, f, { contentType: f.type, cacheControl: '31536000' })
      if (error) throw new Error(error.message)
      setRasm(supabase.storage.from('kitoblar').getPublicUrl(yol).data.publicUrl)
    } catch (e) {
      setRasmXato(e instanceof Error ? `Rasm yuklanmadi: ${e.message}` : 'Rasm yuklanmadi.')
    } finally {
      setYuklanmoqda(false)
    }
  }

  return (
    <form action={qiymat ? taklifTahrir : taklifYubor} className="flex flex-col gap-3">
      {qiymat && <input type="hidden" name="id" value={qiymat.id} />}
      {qiymat && <input type="hidden" name="eski_rasm" value={qiymat.rasm_url} />}
      <input type="hidden" name="rasm_url" value={rasm ?? ''} />

      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex min-w-56 flex-1 flex-col gap-1">
          <span className="lbl">Kitob nomi *</span>
          <input name="nom" required minLength={2} maxLength={200} defaultValue={qiymat?.nom} className={kirishKlass} placeholder="Masalan: Round Up 2" />
        </label>
        <label className="flex min-w-44 flex-col gap-1">
          <span className="lbl">Fan *</span>
          <select name="fan" required className={kirishKlass} defaultValue={qiymat?.subject_id ?? ''}>
            <option value="" disabled>— tanlang —</option>
            {fanlar.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
        </label>
        <label className="flex w-32 flex-col gap-1">
          <span className="lbl">Kerakli soni *</span>
          <input type="number" name="soni" required min={1} max={500} defaultValue={qiymat?.soni} className={`${kirishKlass} tnum`} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="lbl">Nima uchun kerak *</span>
        <textarea name="sabab" required minLength={3} maxLength={1000} rows={2} defaultValue={qiymat?.sabab}
          className={`${kirishKlass} py-2`} placeholder="Masalan: yangi guruh ochildi, 8 o‘quvchiga darslik yo‘q" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="lbl">Havola (ixtiyoriy)</span>
        <input name="havola" type="url" maxLength={500} defaultValue={qiymat?.havola ?? ''} className={kirishKlass} placeholder="https://…" />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        {rasm && (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase storage rasmi, o'lchami kichik
          <img src={rasm} alt="Muqova" className="h-28 w-20 rounded-md border border-line object-cover" />
        )}
        <label className="flex flex-col gap-1">
          <span className="lbl">Muqova rasmi * {qiymat ? '(almashtirish ixtiyoriy)' : ''}</span>
          <input type="file" accept={RASM_TURLARI.join(',')} onChange={(e) => yukla(e.target.files?.[0])} className="text-[13px]" />
          <span className="text-[11.5px] text-ink-3">Internetdan topsangiz — rasmni saqlab, shu yerga yuklang. JPG/PNG/WEBP, 3 MB gacha.</span>
        </label>
      </div>
      {yuklanmoqda && <p className="text-[12px] text-ink-3">Rasm yuklanmoqda…</p>}
      {rasmXato && <p className="text-[12px] text-crit">{rasmXato}</p>}

      <div>
        <Yuborish kutish="Yuborilmoqda…">
          {qiymat ? 'Saqlash' : 'Taklif yuborish'}
        </Yuborish>
      </div>
      {!rasm && !yuklanmoqda && <p className="text-[11.5px] text-ink-3">Muqova yuklanmaguncha taklif qabul qilinmaydi.</p>}
    </form>
  )
}

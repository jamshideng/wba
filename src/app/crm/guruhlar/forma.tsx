import { createClient } from '@/lib/supabase/server'
import { Maydon, FormaBolim, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { HAFTA_KUNLARI } from '@/lib/format'

export type GuruhQiymati = {
  id?: string
  nom?: string
  subject_id?: string | null
  level_id?: number | null
  teacher_id?: string | null
  boshlanish?: string
  tugash?: string
  kunlar?: number[]
  oylik_narx?: number
  sigim?: number
  holat?: string
}

/** Guruh qo'shish va tahrirlash — bitta forma. */
export async function GuruhFormasi({
  amal,
  qiymat = {},
  tugma,
}: {
  amal: (fd: FormData) => Promise<void>
  qiymat?: GuruhQiymati
  tugma: string
}) {
  const supabase = await createClient()
  const [{ data: fanlar }, { data: bosqichlar }, { data: ustozlar }, { data: narx }] = await Promise.all([
    supabase.from('subjects').select('id, nom').order('tartib'),
    supabase.from('levels').select('id, subject_id, nom').order('tartib'),
    supabase.from('teachers').select('id, ism').eq('holat', 'faol').order('ism'),
    supabase.from('settings').select('qiymat').eq('kalit', 'narx.standart').maybeSingle(),
  ])

  const fanNomi = new Map((fanlar ?? []).map((f) => [f.id, f.nom]))
  const standart = Number(narx?.qiymat ?? 0) || undefined
  const tanlangan = qiymat.kunlar ?? []

  return (
    <form action={amal} className="flex flex-col gap-4">
      {qiymat.id && <input type="hidden" name="id" value={qiymat.id} />}

      <FormaBolim nom="Dars kunlari">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Dars kunlari</legend>
          <div className="grid grid-cols-7 gap-1.5">
            {HAFTA_KUNLARI.map((k) => (
              <label key={k.raqam} className="relative">
                <input
                  type="checkbox"
                  name="kunlar"
                  value={k.raqam}
                  defaultChecked={tanlangan.includes(k.raqam)}
                  className="peer sr-only"
                />
                <span
                  title={k.nom}
                  className="flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-[9px] border border-line text-ink-3 transition hover:text-ink peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand peer-focus-visible:outline-2 peer-focus-visible:outline-brand"
                >
                  <span className="text-[14px] font-bold">{k.qisqa}</span>
                  <span className="hidden text-[10.5px] sm:block">{k.nom}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="lbl">Guruh qaysi kunlari o‘qiydi — bir yoki bir nechta kunni tanlang. Davomat jurnalida faqat shu kunlar chiqadi.</p>
        </fieldset>
      </FormaBolim>

      <FormaBolim nom="Yo‘nalish va ustoz">
        <div className="grid gap-3 sm:grid-cols-2">
          <Maydon nom="Yo‘nalish">
            <select name="subject_id" defaultValue={qiymat.subject_id ?? ''} className={kirishKlass}>
              <option value="">—</option>
              {(fanlar ?? []).map((f) => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
          </Maydon>
          <Maydon nom="Bosqich" izoh="Ingliz tili va matematika uchun">
            <select name="level_id" defaultValue={qiymat.level_id ?? ''} className={kirishKlass}>
              <option value="">—</option>
              {(bosqichlar ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {fanNomi.get(b.subject_id)} · {b.nom}
                </option>
              ))}
            </select>
          </Maydon>
          <Maydon nom="Ustoz">
            <select name="teacher_id" defaultValue={qiymat.teacher_id ?? ''} className={kirishKlass}>
              <option value="">[ANIQLANMAGAN]</option>
              {(ustozlar ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.ism}</option>
              ))}
            </select>
          </Maydon>
          <Maydon nom="Guruh nomi" izoh="Bo‘sh qolsa: Yo‘nalish · Ustoz · Vaqt">
            <input name="nom" defaultValue={qiymat.nom ?? ''} placeholder="avtomatik" className={kirishKlass} />
          </Maydon>
        </div>
      </FormaBolim>

      <FormaBolim nom="Vaqt va narx">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Maydon nom="Boshlanish">
            <input type="time" name="boshlanish" required defaultValue={qiymat.boshlanish?.slice(0, 5) ?? ''} className={kirishKlass} />
          </Maydon>
          <Maydon nom="Tugash">
            <input type="time" name="tugash" required defaultValue={qiymat.tugash?.slice(0, 5) ?? ''} className={kirishKlass} />
          </Maydon>
          <Maydon nom="Oylik narx" izoh={qiymat.id ? 'Yangi narx keyingi hisoblardan' : undefined} className="col-span-2">
            <input name="oylik_narx" required inputMode="decimal" defaultValue={qiymat.oylik_narx ?? standart ?? ''} className={kirishKlass} />
          </Maydon>
          <Maydon nom="Sig‘im" izoh="12 dan oshmaydi">
            <input type="number" name="sigim" min={1} max={12} defaultValue={qiymat.sigim ?? 12} className={kirishKlass} />
          </Maydon>
          {qiymat.id && (
            <Maydon nom="Holat">
              <select name="holat" defaultValue={qiymat.holat ?? 'faol'} className={kirishKlass}>
                <option value="faol">Faol</option>
                <option value="yopilgan">Yopilgan</option>
              </select>
            </Maydon>
          )}
        </div>
      </FormaBolim>

      <Yuborish>{tugma}</Yuborish>
    </form>
  )
}

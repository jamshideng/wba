import { createClient } from '@/lib/supabase/server'
import { Maydon, FormaBolim, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { HAFTA_KUNLARI, bugunToshkent } from '@/lib/format'
import { bosqichQosh, bosqichSaqla, bosqichOchir } from './actions'

/** 0093 — guruh turi: umumiy — ustoz stavkasi, qolganlari — tur stavkasi (Sozlamalar) */
export const GURUH_TURI_NOMI: Record<string, string> = {
  umumiy: 'Umumiy guruh',
  individual: 'Individual',
  mini: 'Mini guruh',
  ielts: 'IELTS',
}

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
  turi?: string
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
    // Ustoz qo'shgan bosqich faqat o'z guruhida (0110)
    supabase.from('levels').select('id, subject_id, nom, group_id')
      .or(qiymat.id ? `group_id.is.null,group_id.eq.${qiymat.id}` : 'group_id.is.null').order('tartib'),
    supabase.from('teachers').select('id, ism').eq('holat', 'faol').order('ism'),
    supabase.from('settings').select('qiymat').eq('kalit', 'narx.standart').maybeSingle(),
  ])

  const fanNomi = new Map((fanlar ?? []).map((f) => [f.id, f.nom]))
  const standart = Number(narx?.qiymat ?? 0) || undefined
  const tanlangan = qiymat.kunlar ?? []

  const yol = qiymat.id ? `/crm/guruhlar/${qiymat.id}/tahrir` : '/crm/guruhlar/yangi'
  const umumiyBosqichlar = (bosqichlar ?? []).filter((b) => !b.group_id)

  return (
    <>
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
          <p className="text-[12px] leading-relaxed text-ink-3">Guruh qaysi kunlari o‘qiydi — bir yoki bir nechta kunni tanlang. Davomat jurnalida faqat shu kunlar chiqadi.</p>
          {qiymat.id && (
            <Maydon nom="Kunlar o‘zgarsa, qaysi sanadan" izoh="Undan oldingi kunlar eski jadvalda qoladi. O‘sha oyda belgilanmagan dars bo‘lsa, saqlanmaydi.">
              <input type="date" name="kunlar_dan" required defaultValue={bugunToshkent()} className={kirishKlass} />
            </Maydon>
          )}
        </fieldset>
      </FormaBolim>

      <FormaBolim nom="Yo‘nalish va ustoz">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <Maydon nom="Guruh turi" izoh="Ustoz maoshi shunga qarab">
            <select name="turi" required defaultValue={qiymat.turi ?? 'umumiy'} className={kirishKlass}>
              {Object.entries(GURUH_TURI_NOMI).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
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

    <details className="rounded-[10px] border border-dashed border-line px-4 py-3">
      <summary className="cursor-pointer text-[13px] text-ink-3 hover:text-ink">Bosqich ro‘yxatini tahrirlash</summary>
      <div className="mt-3 flex flex-col gap-2">
        <p className="text-[11.5px] text-ink-3">Yuqoridagi saqlanmagan o‘zgarishlar yo‘qoladi. Bosqich nomi o‘zgarsa, mavjud guruh nomlari o‘zgarmaydi.</p>
        {umumiyBosqichlar.map((b) => (
          <form key={b.id} action={bosqichSaqla} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="yol" value={yol} />
            <input type="hidden" name="level_id" value={b.id} />
            <span className="w-28 truncate text-[12px] text-ink-3">{fanNomi.get(b.subject_id)}</span>
            <input name="nom" required defaultValue={b.nom} aria-label="Bosqich nomi" className={`${kirishKlass} min-w-0 flex-1`} />
            <Yuborish tur="ikkilamchi" kutish="…">Saqlash</Yuborish>
            <button type="submit" formAction={bosqichOchir} className="min-h-11 px-2 text-[12.5px] text-ink-3 hover:text-ink">O‘chirish</button>
          </form>
        ))}
        <form action={bosqichQosh} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="yol" value={yol} />
          <select name="subject_id" required defaultValue={qiymat.subject_id ?? ''} aria-label="Yo‘nalish" className={`${kirishKlass} w-auto`}>
            <option value="" disabled>Yo‘nalish…</option>
            {(fanlar ?? []).map((f) => (
              <option key={f.id} value={f.id}>{f.nom}</option>
            ))}
          </select>
          <input name="nom" required placeholder="Yangi bosqich" aria-label="Yangi bosqich" className={`${kirishKlass} min-w-0 flex-1`} />
          <Yuborish tur="ikkilamchi" kutish="…">Qo‘shish</Yuborish>
        </form>
      </div>
    </details>
    </>
  )
}

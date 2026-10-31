import Link from 'next/link'
import { notFound } from 'next/navigation'
import { talabRol, getUstoz } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, FormaBolim, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { IconArrowLeft } from '@/components/icons'
import { guruhUstozTahrir, ustozBosqichQosh, ustozBosqichTahrir, ustozBosqichOchir } from '../../actions'

export const metadata = { title: 'Guruh nomi va bosqichi' }
export const dynamic = 'force-dynamic'

/** Ustoz o'z guruhida faqat nom va bosqichni o'zgartiradi; qolgani adminda (0110). */
export default async function UstozGuruhTahrir({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  await talabRol('admin', 'direktor', 'qabulxona', 'ustoz')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Guruh" />

  const [{ id }, xabar, ustoz] = await Promise.all([params, searchParams, getUstoz()])
  const supabase = await createClient()
  const { data: g } = await supabase.from('groups').select('id, nom, subject_id, level_id, teacher_id').eq('id', id).maybeSingle()
  if (!g || !ustoz || g.teacher_id !== ustoz.id) notFound()

  const [{ data: fan }, { data: bosqichlar }] = await Promise.all([
    g.subject_id ? supabase.from('subjects').select('nom').eq('id', g.subject_id).maybeSingle() : Promise.resolve({ data: null }),
    g.subject_id
      ? supabase.from('levels').select('id, nom, group_id').eq('subject_id', g.subject_id)
          .or(`group_id.is.null,group_id.eq.${g.id}`).order('tartib')
      : Promise.resolve({ data: [] as { id: number; nom: string; group_id?: string | null }[] }),
  ])
  const oziniki = (bosqichlar ?? []).filter((b) => b.group_id)

  return (
    <div className="flex max-w-2xl flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href={`/crm/guruhlar/${g.id}`} className="flex items-center gap-2 text-[13px] text-ink-3 hover:text-ink">
        <IconArrowLeft size={15} /> {g.nom}
      </Link>
      <Sarlavha nom="Guruh nomi va bosqichi" izoh={`${g.id} · yo‘nalish: ${fan?.nom ?? 'tanlanmagan'}`} />
      <Xabar ok={xabar.ok} xato={xabar.xato} />

      <form action={guruhUstozTahrir} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={g.id} />
        <FormaBolim nom="Guruh">
          <Maydon nom="Guruh nomi">
            <input name="nom" required maxLength={200} defaultValue={g.nom} className={kirishKlass} />
          </Maydon>
          <Maydon nom="Bosqich" izoh="Bosqich almashsa, nom boshidagi bosqich ham almashadi">
            <select name="level_id" defaultValue={g.level_id ?? ''} disabled={!g.subject_id} className={kirishKlass}>
              <option value="">—</option>
              {(bosqichlar ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.nom}</option>
              ))}
            </select>
          </Maydon>
          {!g.subject_id && <p className="text-[12px] text-ink-3">Bosqich tanlash uchun avval admin guruh yo‘nalishini tanlashi kerak.</p>}
        </FormaBolim>
        <Yuborish>Saqlash</Yuborish>
      </form>

      {g.subject_id && (
        <FormaBolim nom="Shu guruhning o‘z bosqichlari">
          <p className="text-[12px] text-ink-3">Ro‘yxatda kerakli bosqich bo‘lmasa, shu yerda qo‘shing. U faqat shu guruhda ko‘rinadi.</p>
          {oziniki.map((b) => (
            <form key={b.id} action={ustozBosqichTahrir} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={g.id} />
              <input type="hidden" name="level_id" value={b.id} />
              <input name="nom" required maxLength={80} defaultValue={b.nom} aria-label="Bosqich nomi" className={`${kirishKlass} min-w-0 flex-1`} />
              <Yuborish tur="ikkilamchi" kutish="…">Saqlash</Yuborish>
              <button type="submit" formAction={ustozBosqichOchir} className="min-h-11 px-2 text-[12.5px] text-ink-3 hover:text-ink">O‘chirish</button>
            </form>
          ))}
          <form action={ustozBosqichQosh} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={g.id} />
            <input name="nom" required maxLength={80} placeholder="Yangi bosqich" aria-label="Yangi bosqich" className={`${kirishKlass} min-w-0 flex-1`} />
            <Yuborish tur="ikkilamchi" kutish="…">Qo‘shish</Yuborish>
          </form>
        </FormaBolim>
      )}
    </div>
  )
}

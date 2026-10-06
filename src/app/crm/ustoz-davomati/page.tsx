import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, kirishKlass } from '@/components/forma'
import { JonliForma } from '@/components/jonli-forma'
import { IconAlert, IconAttendance, IconTeacher, IconJadval } from '@/components/icons'
import { KECHIKISH_USTUNLAR, KechikishJadval, KechikishJamlanma, type KechikishYozuv } from '@/components/kechikish'
import { bugunToshkent, davrNomi, joriyDavr } from '@/lib/format'
import { davrOqi } from '@/lib/kiritish'

export const metadata = { title: 'Ustozlar davomati' }
export const dynamic = 'force-dynamic'

/** Oyning oxirgi kuni: "2026-10" → "2026-10-31" */
function oyOxiri(davr: string): string {
  const [y, m] = davr.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export default async function UstozDavomati({
  searchParams,
}: {
  searchParams: Promise<{ oy?: string; ustoz?: string }>
}) {
  await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Ustozlar davomati" />

  const s = await searchParams
  const davr = davrOqi(s.oy ?? null) ?? joriyDavr()
  const ustoz = (s.ustoz ?? '').trim()
  const bugun = bugunToshkent()

  const supabase = await createClient()
  let sorov = supabase
    .from('ustoz_kechikish')
    .select(KECHIKISH_USTUNLAR)
    .gte('sana', `${davr}-01`)
    .lte('sana', oyOxiri(davr))
    .order('sana', { ascending: false })
    .order('daqiqa', { ascending: false })
  if (ustoz) sorov = sorov.eq('teacher_id', ustoz)

  const [{ data }, { data: ustozlar }] = await Promise.all([
    sorov.limit(500),
    supabase.from('teachers').select('id, ism').order('ism'),
  ])
  const royxat = (data ?? []) as unknown as (KechikishYozuv & { teacher_id: string })[]

  const jamiDaq = royxat.reduce((a, k) => a + k.daqiqa, 0)
  const ustozSoni = new Set(royxat.map((k) => k.teacher_id)).size
  const bugungi = royxat.filter((k) => k.sana === bugun)

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Ustozlar davomati" izoh="faqat kechikishlar yoziladi — yozuv yo‘q bo‘lsa, ustoz o‘z vaqtida kelgan" />

      <p className="rounded-[10px] border border-line bg-surface px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
        Hozircha kechikish <b>Sheets</b>’da kiritiladi: <b>“Ustoz kechikishlari”</b> varag‘i (sana, guruh, daqiqa, sabab —
        ustoz va kiritilgan vaqt o‘zi yoziladi). Saytga kuniga 6 marta ko‘chadi. To‘liq saytga o‘tilganda kiritish shu yerga ko‘chadi.
      </p>

      <JonliForma className="flex flex-wrap items-end gap-2.5">
        <Maydon nom="Oy">
          <input type="month" name="oy" defaultValue={davr} max={joriyDavr()} className={`${kirishKlass} !w-auto`} />
        </Maydon>
        <Maydon nom="Ustoz">
          <select name="ustoz" defaultValue={ustoz} className={`${kirishKlass} !w-auto min-w-56`}>
            <option value="">Hamma ustozlar</option>
            {((ustozlar ?? []) as { id: string; ism: string }[]).map((u) => (
              <option key={u.id} value={u.id}>{u.ism}</option>
            ))}
          </select>
        </Maydon>
      </JonliForma>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`${davrNomi(davr)} — kechikish`} value={String(royxat.length)} sub="marta" ton={royxat.length ? 'brand' : 'ok'} Icon={IconAlert} />
        <Stat label="Jami kechikkan vaqt" value={`${jamiDaq} daq`} sub={royxat.length ? `o‘rtacha ${Math.round(jamiDaq / royxat.length)} daq` : '—'} ton="accent" Icon={IconJadval} />
        <Stat label="Kechikkan ustozlar" value={String(ustozSoni)} sub={`${(ustozlar ?? []).length} ta ustozdan`} Icon={IconTeacher} />
        <Stat label="Bugun" value={String(bugungi.length)} sub={bugungi.length ? `${bugungi.reduce((a, k) => a + k.daqiqa, 0)} daq` : 'kechikish yo‘q'} ton={bugungi.length ? 'brand' : 'ok'} Icon={IconAttendance} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="flex flex-col">
          <CardHeader title="Ustozlar bo‘yicha" meta={davrNomi(davr)} />
          <div className="px-5 pb-4">
            <KechikishJamlanma royxat={royxat} />
          </div>
        </Card>
        <Card className="flex flex-col">
          <CardHeader title="Kechikishlar" meta={`${royxat.length} ta`} />
          <div className="px-3 pb-3">
            <KechikishJadval royxat={royxat} ustozsiz={Boolean(ustoz)} />
          </div>
        </Card>
      </div>
    </div>
  )
}

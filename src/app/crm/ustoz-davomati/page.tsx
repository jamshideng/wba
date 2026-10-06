import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { kechikishQosh, kechikishSaqla, kechikishOchir } from './actions'
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
  searchParams: Promise<{ oy?: string; ustoz?: string; ok?: string; xato?: string }>
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

  const [{ data }, { data: ustozlar }, { data: guruhlar }] = await Promise.all([
    sorov.limit(500),
    supabase.from('teachers').select('id, ism').order('ism'),
    supabase.from('groups').select('id, nom').eq('holat', 'faol').order('nom'),
  ])
  const sorovQs = new URLSearchParams()
  if (s.oy) sorovQs.set('oy', davr)
  if (ustoz) sorovQs.set('ustoz', ustoz)
  const yol = `/crm/ustoz-davomati${sorovQs.size ? `?${sorovQs}` : ''}`
  const uList = (ustozlar ?? []) as { id: string; ism: string }[]
  const royxat = (data ?? []) as unknown as (KechikishYozuv & { teacher_id: string })[]

  const jamiDaq = royxat.reduce((a, k) => a + k.daqiqa, 0)
  const ustozSoni = new Set(royxat.map((k) => k.teacher_id)).size
  const bugungi = royxat.filter((k) => k.sana === bugun)

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Ustozlar davomati" izoh="faqat kechikishlar yoziladi — yozuv yo‘q bo‘lsa, ustoz o‘z vaqtida kelgan" />

      <Xabar ok={s.ok} xato={s.xato} />

      <Card className="flex flex-col">
        <details>
          <summary className="flex min-h-12 cursor-pointer items-center px-5 font-[family-name:var(--font-display)] text-[15px] font-bold">
            + Kechikish qo‘shish
          </summary>
          <form action={kechikishQosh} className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-[150px_minmax(0,2fr)_minmax(0,1fr)_120px]">
            <input type="hidden" name="qaytish" value={yol} />
            <Maydon nom="Sana">
              <input name="sana" type="date" required defaultValue={bugun} max={bugun} className={kirishKlass} />
            </Maydon>
            <Maydon nom="Guruh">
              <select name="group_id" required defaultValue="" className={kirishKlass}>
                <option value="" disabled>Guruhni tanlang</option>
                {((guruhlar ?? []) as { id: string; nom: string }[]).map((g) => (
                  <option key={g.id} value={g.id}>{g.nom}</option>
                ))}
              </select>
            </Maydon>
            <Maydon nom="Ustoz" izoh="Bo‘sh — guruh ustozi">
              <select name="teacher_id" defaultValue="" className={kirishKlass}>
                <option value="">Guruh ustozi</option>
                {uList.map((u) => (
                  <option key={u.id} value={u.id}>{u.ism}</option>
                ))}
              </select>
            </Maydon>
            <Maydon nom="Kech (daqiqa)">
              <input name="daqiqa" type="number" required min={1} max={300} inputMode="numeric" placeholder="12" className={kirishKlass} />
            </Maydon>
            <Maydon nom="Sabab / izoh" className="sm:col-span-2 lg:col-span-3">
              <input name="sabab" maxLength={500} placeholder="Ixtiyoriy: tirbandlik, ogohlantirgan…" className={kirishKlass} />
            </Maydon>
            <div className="flex items-end">
              <Yuborish className="w-full">Yozish</Yuborish>
            </div>
          </form>
          <p className="px-5 pb-4 text-[12px] leading-relaxed text-ink-3">
            Kiritilgan vaqt avtomatik yoziladi. Sheets’dagi <b>“Ustoz kechikishlari”</b> varag‘ida yozilganlar ham shu yerga
            kuniga 6 marta ko‘chadi — ularni Sheets’da tahrirlang.
          </p>
        </details>
      </Card>

      <JonliForma className="flex flex-wrap items-end gap-2.5">
        <Maydon nom="Oy">
          <input type="month" name="oy" defaultValue={davr} max={joriyDavr()} className={`${kirishKlass} !w-auto`} />
        </Maydon>
        <Maydon nom="Ustoz">
          <select name="ustoz" defaultValue={ustoz} className={`${kirishKlass} !w-auto min-w-56`}>
            <option value="">Hamma ustozlar</option>
            {uList.map((u) => (
              <option key={u.id} value={u.id}>{u.ism}</option>
            ))}
          </select>
        </Maydon>
      </JonliForma>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`${davrNomi(davr)} — kechikish`} value={String(royxat.length)} sub="marta" ton={royxat.length ? 'brand' : 'ok'} Icon={IconAlert} />
        <Stat label="Jami kechikkan vaqt" value={`${jamiDaq} daq`} sub={royxat.length ? `o‘rtacha ${Math.round(jamiDaq / royxat.length)} daq` : '—'} ton="accent" Icon={IconJadval} />
        <Stat label="Kechikkan ustozlar" value={String(ustozSoni)} sub={`${uList.length} ta ustozdan`} Icon={IconTeacher} />
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
            <KechikishJadval
              royxat={royxat}
              ustozsiz={Boolean(ustoz)}
              amal={(k) =>
                k.sheets_id ? null : (
                  <details className="relative inline-block text-left">
                    <summary className="flex min-h-9 cursor-pointer list-none items-center rounded-[8px] border border-line px-2.5 text-[12px] text-ink-2 hover:text-ink">
                      Tahrirlash
                    </summary>
                    <div className="absolute right-0 z-10 mt-1 flex w-64 flex-col gap-2 rounded-[10px] border border-line bg-surface p-3 shadow-xl">
                      <form action={kechikishSaqla} className="flex flex-col gap-2">
                        <input type="hidden" name="qaytish" value={yol} />
                        <input type="hidden" name="id" value={k.id} />
                        <Maydon nom="Sana">
                          <input name="sana" type="date" required defaultValue={k.sana} max={bugun} className={kirishKlass} />
                        </Maydon>
                        <Maydon nom="Kech (daqiqa)">
                          <input name="daqiqa" type="number" required min={1} max={300} defaultValue={k.daqiqa} className={kirishKlass} />
                        </Maydon>
                        <Maydon nom="Sabab">
                          <input name="sabab" maxLength={500} defaultValue={k.sabab ?? ''} className={kirishKlass} />
                        </Maydon>
                        <Yuborish>Saqlash</Yuborish>
                      </form>
                      <form action={kechikishOchir}>
                        <input type="hidden" name="qaytish" value={yol} />
                        <input type="hidden" name="id" value={k.id} />
                        <Yuborish tur="xavfli" className="w-full">O‘chirish</Yuborish>
                      </form>
                    </div>
                  </details>
                )
              }
            />
          </div>
        </Card>
      </div>
    </div>
  )
}

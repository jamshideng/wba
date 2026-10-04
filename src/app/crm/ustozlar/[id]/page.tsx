import Link from 'next/link'
import { notFound } from 'next/navigation'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Badge, Empty } from '@/components/ui'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Yuborish } from '@/components/yuborish'
import { HisobForma } from '@/components/hisob'
import { IconArrowLeft } from '@/components/icons'
import { pul, telefon, jadval, davrNomi, joriyDavr, bugunToshkent, guruhQisqa } from '@/lib/format'
import { AMAL_NOMI, JADVAL_NOMI, WOBLR_SABAB } from '@/lib/audit'
import type { TeacherStats } from '@/lib/types'
import { ustozTahrir } from '../actions'

export const metadata = { title: 'Ustoz' }
export const dynamic = 'force-dynamic'

const vaqtFmt = new Intl.DateTimeFormat('uz-UZ', {
  timeZone: 'Asia/Tashkent',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Ustoz sahifasi (LevelUp MentorDetail o'rni, darajasiz): karta, shu oy
 * ko'rsatkichlari, guruhlari, bergan woblari va tizimdagi so'nggi amallari.
 */
export default async function UstozProfil({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  const [{ id }, xabar] = await Promise.all([params, searchParams])
  await talabRol('admin', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Ustoz" />

  const supabase = await createClient()
  const davr = joriyDavr()
  const bugun = bugunToshkent()

  const { data: ustoz } = await supabase
    .from('teachers')
    .select('id, ism, telefon, telegram_id, profile_id, holat')
    .eq('id', id)
    .maybeSingle()
  if (!ustoz) notFound()
  const u = ustoz as {
    id: string
    ism: string
    telefon: string | null
    telegram_id: number | null
    profile_id: string | null
    holat: 'faol' | 'bloklangan'
  }

  const [{ data: guruhlar }, { data: stats }, { data: woblar }, { data: amallar }, { data: hisob }] = await Promise.all([
    supabase.from('groups').select('id, nom, boshlanish, tugash, kunlar, holat').eq('teacher_id', id).order('holat').order('nom'),
    supabase.from('v_teacher_stats').select('*').eq('teacher_id', id).maybeSingle(),
    supabase
      .from('woblr')
      .select('id, student_id, ball, sabab, izoh, created_at, students(fish)')
      .eq('teacher_id', id)
      .order('created_at', { ascending: false })
      .limit(300),
    u.profile_id
      ? supabase
          .from('audit_log')
          .select('id, amal, jadval, obyekt_id, created_at')
          .eq('profile_id', u.profile_id)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    u.profile_id
      ? supabase.from('profiles').select('email').eq('id', u.profile_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  type Guruh = { id: string; nom: string; boshlanish: string; tugash: string; kunlar: number[]; holat: string }
  const gList = (guruhlar ?? []) as unknown as Guruh[]
  const faolIdlar = gList.filter((g) => g.holat === 'faol').map((g) => g.id)
  const s = stats as TeacherStats | null

  const [{ data: gStat }, { count: darsSoni }, { data: davomat }] = await Promise.all([
    gList.length
      ? supabase.from('v_group_stats').select('group_id, oquvchilar').in('group_id', gList.map((g) => g.id))
      : Promise.resolve({ data: [] }),
    faolIdlar.length
      ? supabase
          .from('lessons')
          .select('id', { count: 'exact', head: true })
          .in('group_id', faolIdlar)
          .eq('otkazildi', true)
          .gte('sana', `${davr}-01`)
          .lte('sana', bugun)
      : Promise.resolve({ count: 0 }),
    faolIdlar.length
      ? supabase.from('v_attendance_monthly').select('darslar, kelgan').in('group_id', faolIdlar).eq('davr', davr)
      : Promise.resolve({ data: [] }),
  ])

  const oquvchiSoni = new Map(
    ((gStat ?? []) as { group_id: string; oquvchilar: number }[]).map((g) => [g.group_id, Number(g.oquvchilar) || 0]),
  )
  const dav = (davomat ?? []) as { darslar: number; kelgan: number }[]
  const jamiDars = dav.reduce((a, d) => a + (Number(d.darslar) || 0), 0)
  const jamiKelgan = dav.reduce((a, d) => a + (Number(d.kelgan) || 0), 0)
  const davomatFoiz = jamiDars ? Math.round((jamiKelgan / jamiDars) * 100) : null

  type Wob = {
    id: number
    student_id: string
    ball: number
    sabab: string
    izoh: string | null
    created_at: string
    students: { fish: string } | null
  }
  const wList = (woblar ?? []) as unknown as Wob[]
  const oyWoblar = wList.filter((w) => bugunToshkent(new Date(w.created_at)).startsWith(davr))
  const oyBerdi = oyWoblar.filter((w) => w.ball > 0).reduce((a, w) => a + w.ball, 0)
  const oyAyirdi = oyWoblar.filter((w) => w.ball < 0).reduce((a, w) => a - w.ball, 0)

  type Amal = { id: number; amal: string; jadval: string; obyekt_id: string | null; created_at: string }
  const aList = (amallar ?? []) as Amal[]
  const qarz = Number(s?.qarz ?? 0)

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href="/crm/ustozlar" className="flex items-center gap-2 text-[13px] text-ink-3 transition hover:text-ink">
        <IconArrowLeft size={15} />
        Ustozlar
      </Link>

      <Sarlavha
        nom={u.ism}
        izoh={`${u.id} · ${telefon(u.telefon)}`}
        amal={
          <span className="flex flex-wrap items-center gap-1.5">
            {u.holat === 'faol' ? <Badge ton="ok">Faol</Badge> : <Badge ton="jim">Ishdan ketgan</Badge>}
            <Badge ton={u.profile_id ? 'ok' : 'jim'}>{u.profile_id ? 'hisobi bor' : 'hisobi yo‘q'}</Badge>
            <Badge ton={u.telegram_id ? 'brand' : 'jim'}>{u.telegram_id ? 'botda' : 'botda yo‘q'}</Badge>
          </span>
        }
      />
      <Xabar ok={xabar.ok} xato={xabar.xato} />

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-3">
        <Stat label="Guruhlar" value={faolIdlar.length} sub={`o‘quvchi: ${Number(s?.oquvchilar ?? 0)}`} />
        <Stat label={`Darslar · ${davrNomi(davr)}`} value={darsSoni ?? 0} sub="o‘tkazilgan" />
        <Stat
          label={`Davomat · ${davrNomi(davr)}`}
          value={davomatFoiz === null ? '—' : `${davomatFoiz}%`}
          sub={davomatFoiz === null ? 'shu oyda belgilanmagan' : 'guruhlari o‘rtachasi'}
          ton={davomatFoiz !== null && davomatFoiz >= 80 ? 'ok' : 'accent'}
        />
        <Stat label={`Woblar · ${davrNomi(davr)}`} value={`+${oyBerdi}`} sub={oyAyirdi ? `ayirgan: −${oyAyirdi}` : 'bergan'} />
        <Stat label="Tushum" value={pul(s?.tushum ?? 0)} sub="so‘m · to‘langan" />
        <Stat
          label="Guruhlar qarzi"
          value={pul(qarz)}
          sub="so‘m · hozirgi"
          ton={qarz > 0 ? 'brand' : 'ok'}
          border={qarz > 0 ? 'brand' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="flex flex-col">
          <CardHeader title="Guruhlari" meta={`${gList.length} ta`} />
          <div className="flex flex-col px-5 pb-4">
            {gList.length === 0 ? (
              <Empty>Bu ustozga guruh biriktirilmagan.</Empty>
            ) : (
              gList.map((g) => (
                <Link
                  key={g.id}
                  href={`/crm/guruhlar/${g.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line-soft py-2.5 transition last:border-0 hover:bg-surface-2"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[13.5px] font-semibold">{guruhQisqa(g.nom)}</span>
                    <span className="truncate text-[11.5px] text-ink-3">{jadval(g.boshlanish, g.tugash, g.kunlar)}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[12px] text-ink-3">{oquvchiSoni.get(g.id) ?? 0} o‘quvchi</span>
                    {g.holat !== 'faol' && <Badge ton="jim">yopilgan</Badge>}
                  </span>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Bergan woblari" meta="so‘nggi 10 ta" />
          <div className="flex flex-col px-5 pb-4">
            {wList.length === 0 ? (
              <Empty>Hali woblar bermagan.</Empty>
            ) : (
              wList.slice(0, 10).map((w) => (
                <Link
                  key={w.id}
                  href={`/crm/oquvchilar/${w.student_id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line-soft py-2 text-[12.5px] transition last:border-0 hover:bg-surface-2"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{w.students?.fish ?? w.student_id}</span>
                    <span className="truncate text-[11px] text-ink-3">
                      {WOBLR_SABAB[w.sabab] ?? w.sabab}
                      {w.izoh ? ` · ${w.izoh}` : ''} · {vaqtFmt.format(new Date(w.created_at))}
                    </span>
                  </span>
                  <b className={w.ball > 0 ? 'text-ok' : 'text-brand'}>
                    {w.ball > 0 ? '+' : ''}
                    {w.ball}
                  </b>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="flex flex-col">
        <CardHeader title="Tizimdagi so‘nggi amallari" meta="Auditdan" />
        <div className="flex flex-col px-5 pb-4">
          {!u.profile_id ? (
            <Empty>Hisobi yo‘q — tizimga kirmagan.</Empty>
          ) : aList.length === 0 ? (
            <Empty>Hali amal yo‘q.</Empty>
          ) : (
            aList.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft py-2 text-[12.5px] last:border-0"
              >
                <span className="flex items-center gap-2">
                  <Badge ton={a.amal === 'DELETE' ? 'brand' : a.amal === 'INSERT' ? 'ok' : 'accent'}>
                    {AMAL_NOMI[a.amal] ?? a.amal}
                  </Badge>
                  <span>{JADVAL_NOMI[a.jadval] ?? a.jadval}</span>
                  {a.obyekt_id && <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-3">{a.obyekt_id}</span>}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-3">
                  {vaqtFmt.format(new Date(a.created_at))}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="flex flex-col">
        <CardHeader title="Hisob va ma‘lumotlar" />
        <div className="flex flex-col gap-4 px-5 pb-5">
          <HisobForma
            turi="ustoz"
            nishon={u.id}
            ism={u.ism}
            bormi={Boolean(u.profile_id)}
            email={(hisob as { email: string | null } | null)?.email ?? null}
          />
          <form action={ustozTahrir} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1.5fr_1fr_auto] sm:items-end">
            <input type="hidden" name="id" value={u.id} />
            <input type="hidden" name="qayt" value="sahifa" />
            <Maydon nom="Ism">
              <input name="ism" required defaultValue={u.ism} className={kirishKlass} />
            </Maydon>
            <Maydon nom="Telefon">
              <input name="telefon" type="tel" defaultValue={u.telefon ?? ''} className={kirishKlass} />
            </Maydon>
            <Maydon nom="Holat">
              <select name="holat" defaultValue={u.holat} className={kirishKlass}>
                <option value="faol">Faol</option>
                <option value="bloklangan">Ishdan ketgan</option>
              </select>
            </Maydon>
            <Yuborish kutish="…">Saqlash</Yuborish>
          </form>
        </div>
      </Card>
    </div>
  )
}

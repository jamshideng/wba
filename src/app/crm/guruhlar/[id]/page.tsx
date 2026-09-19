import Link from 'next/link'
import { notFound } from 'next/navigation'
import { talabRol, staffmi, adminmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Badge, Empty, Button } from '@/components/ui'
import { Xabar } from '@/components/forma'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { IconArrowLeft } from '@/components/icons'
import { pul, jadval, sana, davrNomi, joriyDavr, bosh, bugunToshkent } from '@/lib/format'
import type { DayType } from '@/lib/types'

export const metadata = { title: 'Guruh' }

/** O'quvchi qatori: xodimga profilga havola, ustozga oddiy qator. */
function Qator({ href, children }: { href: string | null; children: React.ReactNode }) {
  const klass =
    'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-line-soft py-2.5 last:border-0'
  return href ? (
    <Link href={href} className={`${klass} transition hover:bg-surface-2`}>
      {children}
    </Link>
  ) : (
    <div className={klass}>{children}</div>
  )
}
export const dynamic = 'force-dynamic'

export default async function GuruhProfil({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  const [{ id }, xabar] = await Promise.all([params, searchParams])
  const profil = await talabRol('admin', 'direktor', 'qabulxona', 'ustoz')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Guruh" />

  const supabase = await createClient()
  const pulKoradi = staffmi(profil.rol)
  const davr = joriyDavr()

  const { data: guruh } = await supabase
    .from('groups')
    .select('id, nom, boshlanish, tugash, kun_turi, oylik_narx, sigim, holat, teachers(id, ism)')
    .eq('id', id)
    .maybeSingle()

  if (!guruh) notFound()

  type Guruh = {
    id: string
    nom: string
    boshlanish: string
    tugash: string
    kun_turi: DayType
    oylik_narx: number
    sigim: number
    holat: string
    teachers: { id: string; ism: string } | null
  }
  const g = guruh as unknown as Guruh

  const [{ data: yozilishlar }, { data: stats }, { data: darslar }] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id, student_id, boshlandi, holat, students(fish, holat)')
      .eq('group_id', id)
      .neq('holat', 'tugagan')
      .order('boshlandi'),
    supabase.from('v_group_stats').select('oquvchilar, tushum, qarz').eq('group_id', id).maybeSingle(),
    // Faqat bugungacha: jadvaldagi kelajak darslari "o'tkazilgan" bo'lib ko'rinmasin
    supabase.from('lessons').select('id, sana, otkazildi').eq('group_id', id).lte('sana', bugunToshkent()).order('sana', { ascending: false }).limit(10),
  ])

  type Yozilish = {
    id: string
    student_id: string
    boshlandi: string
    holat: string
    students: { fish: string; holat: string } | null
  }
  const yList = (yozilishlar ?? []) as unknown as Yozilish[]
  const oquvchiIdlar = yList.map((y) => y.student_id)

  const [{ data: balans }, { data: davomat }] = await Promise.all([
    pulKoradi && oquvchiIdlar.length
      ? supabase.from('v_enrollment_balance').select('enrollment_id, qarz').in('student_id', oquvchiIdlar)
      : Promise.resolve({ data: [] }),
    oquvchiIdlar.length
      ? supabase
          .from('v_attendance_monthly')
          .select('student_id, davr, darslar, kelgan, foiz')
          .eq('group_id', id)
          .eq('davr', davr)
          .in('student_id', oquvchiIdlar)
      : Promise.resolve({ data: [] }),
  ])

  const qarzMap = new Map(
    ((balans ?? []) as { enrollment_id: string; qarz: number }[]).map((b) => [b.enrollment_id, Number(b.qarz) || 0]),
  )
  const davomatMap = new Map(
    ((davomat ?? []) as { student_id: string; darslar: number; kelgan: number; foiz: number }[]).map((d) => [
      d.student_id,
      d,
    ]),
  )

  const foizlar = [...davomatMap.values()].map((d) => Number(d.foiz) || 0)
  const ortacha = foizlar.length ? Math.round(foizlar.reduce((a, b) => a + b, 0) / foizlar.length) : null

  type Dars = { id: string; sana: string; otkazildi: boolean }
  const dList = (darslar ?? []) as unknown as Dars[]

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Link
        href="/crm/guruhlar"
        className="flex items-center gap-2 text-[13px] text-ink-3 transition hover:text-ink"
      >
        <IconArrowLeft size={15} />
        Guruhlar
      </Link>

      <Sarlavha
        nom={g.nom}
        izoh={
          <>
            {g.teachers?.ism ?? '[ANIQLANMAGAN]'} · {jadval(g.boshlanish, g.tugash, g.kun_turi)}
          </>
        }
        amal={
          <div className="flex flex-wrap items-center gap-2">
            {g.holat === 'faol' ? <Badge ton="ok">Faol</Badge> : <Badge ton="jim">Yopilgan</Badge>}
            <Button href={`/crm/davomat/eksport?guruh=${g.id}&davr=${davr}`} yuklab variant="ikkilamchi">
              Oylik davomat (Excel)
            </Button>
            {adminmi(profil.rol) && (
              <Button href={`/crm/guruhlar/${g.id}/tahrir`} variant="ikkilamchi">Tahrirlash</Button>
            )}
          </div>
        }
      />

      <Xabar ok={xabar.ok} xato={xabar.xato} />

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <Stat label="O‘quvchilar" value={yList.length} sub={`sig‘imi ${g.sigim} kishi`} />
        <Stat
          label={`Davomat · ${davrNomi(davr)}`}
          value={ortacha === null ? '—' : `${ortacha}%`}
          sub={ortacha === null ? 'shu oyda belgilanmagan' : 'o‘rtacha'}
          ton={ortacha !== null && ortacha >= 80 ? 'ok' : 'accent'}
        />
        {pulKoradi && (
          <>
            <Stat label="Oylik narx" value={g.oylik_narx} sub="so‘m" />
            <Stat
              label="Guruh qarzi"
              value={Number(stats?.qarz ?? 0)}
              sub="so‘m"
              ton={Number(stats?.qarz ?? 0) > 0 ? 'brand' : 'ok'}
              border={Number(stats?.qarz ?? 0) > 0 ? 'brand' : undefined}
            />
          </>
        )}
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="flex flex-col">
          <CardHeader title="O‘quvchilar" meta={`${yList.length} ta`} />
          <div className="flex flex-col px-5 pb-4">
            {yList.length === 0 ? (
              <Empty>Bu guruhga hali o‘quvchi biriktirilmagan.</Empty>
            ) : (
              yList.map((y) => {
                const d = davomatMap.get(y.student_id)
                const qarz = qarzMap.get(y.id) ?? 0
                return (
                  <Qator
                    key={y.id}
                    href={pulKoradi ? `/crm/oquvchilar/${y.student_id}` : null}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft font-[family-name:var(--font-display)] text-[12px] font-bold text-brand">
                        {bosh(y.students?.fish ?? y.student_id)}
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-[13px] font-semibold">
                          {y.students?.fish ?? y.student_id}
                        </span>
                        <span className="font-[family-name:var(--font-mono)] text-[10.5px] text-ink-3">
                          {y.student_id} · {sana(y.boshlandi)} dan
                        </span>
                      </span>
                    </span>

                    <span className="text-[11.5px] text-ink-3">
                      {d ? `${d.kelgan}/${d.darslar}` : '—'}
                    </span>

                    {pulKoradi ? (
                      <span
                        className={`tnum w-24 text-right font-[family-name:var(--font-mono)] text-[12.5px] ${
                          qarz > 0 ? 'text-brand' : 'text-ink-4'
                        }`}
                      >
                        {qarz > 0 ? pul(qarz) : '—'}
                      </span>
                    ) : (
                      <span className="w-14 text-right">
                        {d && <Badge ton={d.foiz >= 80 ? 'ok' : 'accent'}>{d.foiz}%</Badge>}
                      </span>
                    )}
                  </Qator>
                )
              })
            )}
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Oxirgi darslar" meta="10 tagacha" />
          <div className="flex flex-col px-5 pb-4">
            {dList.length === 0 ? (
              <Empty>Hali dars ochilmagan. Davomat qo‘yilganda dars o‘zi paydo bo‘ladi.</Empty>
            ) : (
              dList.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 border-b border-line-soft py-2.5 last:border-0"
                >
                  <span className="text-[12.5px]">{sana(d.sana)}</span>
                  <Badge ton={d.otkazildi ? 'ok' : 'jim'}>
                    {d.otkazildi ? 'o‘tkazilgan' : 'belgilanmagan'}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

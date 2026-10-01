import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { pul, telefon } from '@/lib/format'
import { ustozQosh, ustozTahrir } from './actions'
import { HisobForma } from '@/components/hisob'
import type { TeacherStats } from '@/lib/types'

export const metadata = { title: 'Ustozlar' }
export const dynamic = 'force-dynamic'

type Ustoz = {
  id: string
  ism: string
  telefon: string | null
  telegram_id: number | null
  profile_id: string | null
  holat: 'faol' | 'bloklangan'
}

export default async function Ustozlar({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  await talabRol('admin', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Ustozlar" />

  const xabar = await searchParams
  const supabase = await createClient()

  const [{ data: ustozlar }, { data: stats }, { data: maosh }, { data: hisoblar }] = await Promise.all([
    supabase.from('teachers').select('id, ism, telefon, telegram_id, profile_id, holat').order('holat').order('ism'),
    supabase.from('v_teacher_stats').select('*'),
    supabase.from('settings').select('qiymat').eq('kalit', 'maosh.qoida').maybeSingle(),
    supabase.from('profiles').select('id, email'),
  ])
  const emailMap = new Map(((hisoblar ?? []) as { id: string; email: string | null }[]).map((h) => [h.id, h.email]))

  const uList = (ustozlar ?? []) as Ustoz[]
  const sMap = new Map(((stats ?? []) as TeacherStats[]).map((s) => [s.teacher_id, s]))
  const maoshQoidasi = maosh?.qiymat ?? null

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Ustozlar" izoh={`${uList.filter((u) => u.holat === 'faol').length} ta faol`} />
      <Xabar ok={xabar.ok} xato={xabar.xato} />
      <p className="lbl">Har ustozning alohida sahifasi (guruhlari, davomat foizi, tushum) — tez orada.</p>

      {maoshQoidasi === null && (
        <p className="rounded-[10px] border border-dashed border-accent-line px-4 py-3 text-[12.5px] text-ink-2">
          Maosh qoidasi <b>[ANIQLANMAGAN]</b> — foiz, o‘quvchi soni yoki fiks ekani kelishilmagan,
          shuning uchun maosh hisoblanmaydi.
        </p>
      )}

      <Card className="flex flex-col">
        <CardHeader title="Ro‘yxat" meta="tushum — to‘langan · qarz — hozirgi" />
        {uList.length === 0 ? (
          <div className="px-5 pb-5">
            <Empty>Hali ustoz qo‘shilmagan.</Empty>
          </div>
        ) : (
          <ul>
            {uList.map((u) => {
              const s = sMap.get(u.id)
              const qarz = Number(s?.qarz ?? 0)
              return (
                <li key={u.id} className="flex flex-col gap-2 border-t border-line-soft px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[13.5px] font-semibold">{u.ism}</span>
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-3">
                        {u.id} · {telefon(u.telefon)}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {u.holat !== 'faol' && <Badge ton="jim">ishdan ketgan</Badge>}
                      <Badge ton={u.profile_id ? 'ok' : 'jim'}>{u.profile_id ? 'hisobi bor' : 'hisobi yo‘q'}</Badge>
                      <Badge ton={u.telegram_id ? 'brand' : 'jim'}>{u.telegram_id ? 'botda' : 'botda yo‘q'}</Badge>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
                    <span><span className="lbl">guruh </span>{Number(s?.guruhlar ?? 0)}</span>
                    <span><span className="lbl">o‘quvchi </span>{Number(s?.oquvchilar ?? 0)}</span>
                    <span><span className="lbl">tushum </span>{pul(s?.tushum ?? 0)}</span>
                    <span className={qarz > 0 ? 'text-brand' : ''}><span className="lbl">qarz </span>{pul(qarz)}</span>
                  </div>

                  <HisobForma
                    turi="ustoz"
                    nishon={u.id}
                    ism={u.ism}
                    bormi={Boolean(u.profile_id)}
                    email={u.profile_id ? (emailMap.get(u.profile_id) ?? null) : null}
                  />

                  <details>
                    <summary className="cursor-pointer text-[12px] text-ink-3 hover:text-ink">Tahrirlash</summary>
                    <form action={ustozTahrir} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1.5fr_1fr_auto] sm:items-end">
                      <input type="hidden" name="id" value={u.id} />
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
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col">
        <CardHeader title="Yangi ustoz" />
        <form action={ustozQosh} className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-[2fr_1.5fr_auto] sm:items-end">
          <Maydon nom="Ism">
            <input name="ism" required placeholder="Masalan: Komila Bozorova" className={kirishKlass} />
          </Maydon>
          <Maydon nom="Telefon">
            <input name="telefon" type="tel" placeholder="90 123 45 67" className={kirishKlass} />
          </Maydon>
          <Yuborish>Qo‘shish</Yuborish>
        </form>
      </Card>
    </div>
  )
}

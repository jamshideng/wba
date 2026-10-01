import Link from 'next/link'
import { talabRol, ROL_NOMI } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { sozlamaSaqla, xodimSaqla } from './actions'
import type { Setting, Profile, UserRole } from '@/lib/types'

export const metadata = { title: 'Sozlamalar' }
export const dynamic = 'force-dynamic'

/** jsonb qiymatni formaga qaytarish uchun matn. */
function korinish(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

export default async function Sozlamalar({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  const men = await talabRol('admin', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Sozlamalar" />

  const xabar = await searchParams
  const supabase = await createClient()

  const [{ data: sozlamalar }, { data: xodimlar }, { data: ustozlar }] = await Promise.all([
    supabase.from('settings').select('*').order('kalit'),
    supabase.from('profiles').select('*').order('rol').order('ism'),
    supabase.from('teachers').select('id, ism, profile_id').order('ism'),
  ])

  const sList = (sozlamalar ?? []) as Setting[]
  const aniqlanmagan = sList.filter((x) => x.qiymat === null)
  const xList = (xodimlar ?? []) as Profile[]
  const uList = (ustozlar ?? []) as { id: string; ism: string; profile_id: string | null }[]

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Sozlamalar" />
      <Xabar ok={xabar.ok} xato={xabar.xato} />

      {aniqlanmagan.length > 0 && (
        <p className="rounded-[10px] border border-dashed border-accent-line px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
          <b>{aniqlanmagan.length} ta qiymat [ANIQLANMAGAN]</b> — bular kelishilmaguncha tizim ularni
          hisobga olmaydi va taxmin qilmaydi: {aniqlanmagan.map((x) => x.kalit).join(', ')}.
        </p>
      )}

      <Card className="flex flex-col">
        <CardHeader title="Xodimlar" meta={`${xList.length} ta hisob`} />
        {xList.length === 0 ? (
          <div className="px-5 pb-5"><Empty>Hisob yo‘q.</Empty></div>
        ) : (
          <ul>
            {xList.map((x) => {
              const bogliq = uList.find((u) => u.profile_id === x.id)
              const ozim = x.id === men.id
              return (
                <li key={x.id} className="border-t border-line-soft px-5 py-3.5">
                  <form action={xodimSaqla} className="grid gap-2.5 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_7rem] sm:items-end">
                    <input type="hidden" name="id" value={x.id} />
                    <span className="flex min-w-0 flex-col gap-0.5 self-center">
                      <span className="truncate text-[13.5px] font-semibold">{x.ism}</span>
                      {x.email && <span className="truncate font-[family-name:var(--font-mono)] text-[11px] text-ink-3">{x.email}</span>}
                      <span className="flex gap-1.5">
                        <Badge ton="brand">{ROL_NOMI[x.rol]}</Badge>
                        {ozim && <Badge ton="jim">siz</Badge>}
                      </span>
                    </span>
                    <Maydon nom="Rol">
                      <select name="rol" defaultValue={x.rol} disabled={ozim} className={kirishKlass}>
                        {(Object.keys(ROL_NOMI) as UserRole[]).map((r) => (
                          // Direktor rolini faqat direktor beradi (0011_direktor_himoya.sql)
                          <option key={r} value={r} disabled={r === 'direktor' && men.rol !== 'direktor'}>
                            {ROL_NOMI[r]}
                          </option>
                        ))}
                      </select>
                    </Maydon>
                    <Maydon nom="Holat">
                      <select name="holat" defaultValue={x.holat} disabled={ozim} className={kirishKlass}>
                        <option value="faol">Faol</option>
                        <option value="bloklangan">Bloklangan</option>
                      </select>
                    </Maydon>
                    <Maydon nom="Ustoz sifatida" izoh="Ustoz panelini ko‘radi">
                      <select name="teacher_id" defaultValue={bogliq?.id ?? ''} disabled={ozim} className={kirishKlass}>
                        <option value="">Ustoz emas</option>
                        {uList
                          .filter((u) => !u.profile_id || u.profile_id === x.id)
                          .map((u) => (
                            <option key={u.id} value={u.id}>{u.ism} ({u.id})</option>
                          ))}
                      </select>
                    </Maydon>
                    {/* O'z qatorida tugma yo'q — joyi bo'sh turadi, ustunlar surilmasin */}
                    {ozim ? <span aria-hidden="true" /> : <Yuborish tur="ikkilamchi" kutish="…">Saqlash</Yuborish>}
                  </form>
                </li>
              )
            })}
          </ul>
        )}
        <p className="border-t border-line-soft px-5 py-3 text-[12px] text-ink-3">
          Yangi xodim hisobi, parolni almashtirish —{' '}
          <Link href="/crm/xodimlar" className="text-accent hover:text-brand">Xodimlar</Link> bo‘limida; ustoz hisobi — “Ustozlar”da.
        </p>
      </Card>

      <Card className="flex flex-col">
        <CardHeader title="Markaz qiymatlari" meta="bo‘sh qoldirilsa — [ANIQLANMAGAN]" />
        <ul>
          {sList.map((x) => (
            <li key={x.kalit} className="border-t border-line-soft px-5 py-3">
              <form action={sozlamaSaqla} className="grid gap-2 sm:grid-cols-[1.4fr_1.6fr_auto] sm:items-center">
                <input type="hidden" name="kalit" value={x.kalit} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-[family-name:var(--font-mono)] text-[12px]">{x.kalit}</span>
                  {x.tavsif && <span className="text-[11.5px] text-ink-3">{x.tavsif}</span>}
                </span>
                <input
                  name="qiymat"
                  defaultValue={korinish(x.qiymat)}
                  placeholder="[ANIQLANMAGAN]"
                  aria-label={x.kalit}
                  className={`${kirishKlass} ${x.qiymat === null ? 'border-accent-line' : ''}`}
                />
                <Yuborish tur="ikkilamchi" kutish="…">Saqlash</Yuborish>
              </form>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

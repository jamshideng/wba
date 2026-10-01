import { talabRol, tasdiqlaydimi, ROL_NOMI } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, FormaBolim, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { loginNomi, LOGIN_QOIDASI } from '@/lib/login'
import { xodimQosh, xodimParol, xodimRol, xodimHolat, xodimUstoz } from './actions'
import type { UserRole } from '@/lib/types'

export const metadata = { title: 'Xodimlar' }
export const dynamic = 'force-dynamic'

const LAVOZIM: { rol: 'qabulxona' | 'admin' | 'direktor'; izoh: string }[] = [
  { rol: 'qabulxona', izoh: 'O‘quvchi, to‘lov, probniy kiritadi; tasdiqlamaydi, sozlamalarga kirmaydi' },
  { rol: 'admin', izoh: 'Hamma bo‘lim, xodim va ustoz hisoblari; to‘lovni tasdiqlamaydi' },
  { rol: 'direktor', izoh: 'Admin huquqlari + to‘lovni tasdiqlash (faqat direktor)' },
]

/**
 * Xodimlar — ustoz bo'lmagan hisoblar: qabulxona, admin, direktor.
 * Ustoz hisobi "Ustozlar"da, o'quvchi va ota-ona — o'quvchi profilida.
 * Direktor lavozimini faqat direktor beradi (bazada ham — 0011).
 */
export default async function Xodimlar({ searchParams }: { searchParams: Promise<{ ok?: string; xato?: string }> }) {
  const men = await talabRol('admin', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Xodimlar" />

  const xabar = await searchParams
  const supabase = await createClient()
  const [{ data: xodimlar }, { data: ustozlar }] = await Promise.all([
    supabase.from('profiles').select('id, ism, rol, email, holat').in('rol', ['qabulxona', 'admin', 'direktor']).order('rol').order('ism'),
    supabase.from('teachers').select('id, ism, profile_id').eq('holat', 'faol').order('ism'),
  ])
  const uList = (ustozlar ?? []) as { id: string; ism: string; profile_id: string | null }[]
  const ustozHisob = new Map(uList.filter((u) => u.profile_id).map((u) => [u.profile_id!, u]))
  const xList = (xodimlar ?? []) as { id: string; ism: string; rol: UserRole; email: string | null; holat: string }[]
  const direktorman = tasdiqlaydimi(men.rol)
  // Direktor lavozimini faqat direktor beradi/oladi
  const beraOladi = LAVOZIM.filter((l) => l.rol !== 'direktor' || direktorman)

  return (
    <div className="flex max-w-4xl flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Xodimlar" izoh="qabulxona · admin · direktor — ustoz bo‘lmagan hisoblar" />
      <Xabar ok={xabar.ok} xato={xabar.xato} />

      <Card className="flex flex-col">
        <CardHeader title="Hisobi borlar" meta={`${xList.length} ta`} />
        {xList.length === 0 ? (
          <div className="px-5 pb-5"><Empty>Hali xodim hisobi yo‘q.</Empty></div>
        ) : (
          <ul className="flex flex-col">
            {xList.map((x) => {
              const ozim = x.id === men.id
              const direktorQatori = x.rol === 'direktor'
              const tegsaBoladi = !ozim && (!direktorQatori || direktorman)
              return (
                <li key={x.id} className="flex flex-col gap-2 border-b border-line-soft px-5 py-3 last:border-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
                        {x.ism}
                        {ozim && <span className="text-[11px] font-normal text-ink-3">(siz)</span>}
                      </span>
                      <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-ink-3">
                        login: {loginNomi(x.email)}
                        {ustozHisob.has(x.id) ? ` · ustoz ham (${ustozHisob.get(x.id)!.id})` : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {x.holat === 'bloklangan' && <Badge ton="brand">bloklangan</Badge>}
                      <Badge ton={direktorQatori ? 'accent' : x.rol === 'admin' ? 'ok' : 'jim'}>{ROL_NOMI[x.rol]}</Badge>
                    </span>
                  </div>

                  {tegsaBoladi && (
                    <details>
                      <summary className="cursor-pointer text-[12px] text-ink-3 hover:text-ink">Parol, lavozim, bloklash</summary>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        <form action={xodimParol} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="id" value={x.id} />
                          <Maydon nom="Yangi parol" izoh="kamida 8 belgi">
                            <input name="parol" type="text" required minLength={8} autoComplete="new-password" className={kirishKlass} />
                          </Maydon>
                          <Yuborish kutish="…">Parolni almashtirish</Yuborish>
                        </form>
                        <form action={xodimRol} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="id" value={x.id} />
                          <Maydon nom="Lavozim">
                            <select name="rol" defaultValue={x.rol} className={kirishKlass}>
                              {beraOladi.map((l) => (
                                <option key={l.rol} value={l.rol}>{ROL_NOMI[l.rol]}</option>
                              ))}
                            </select>
                          </Maydon>
                          <Yuborish kutish="…">Saqlash</Yuborish>
                        </form>
                        <form action={xodimUstoz} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="id" value={x.id} />
                          <Maydon nom="Ustoz sifatida" izoh="ustoz panelini ham ko‘radi">
                            <select name="teacher_id" defaultValue={ustozHisob.get(x.id)?.id ?? ''} className={kirishKlass}>
                              <option value="">Ustoz emas</option>
                              {uList
                                .filter((u) => !u.profile_id || u.profile_id === x.id)
                                .map((u) => (
                                  <option key={u.id} value={u.id}>{u.ism} ({u.id})</option>
                                ))}
                            </select>
                          </Maydon>
                          <Yuborish kutish="…">Saqlash</Yuborish>
                        </form>
                        <form action={xodimHolat}>
                          <input type="hidden" name="id" value={x.id} />
                          <input type="hidden" name="holat" value={x.holat === 'bloklangan' ? 'faol' : 'bloklangan'} />
                          <Yuborish tur={x.holat === 'bloklangan' ? undefined : 'xavfli'} kutish="…">
                            {x.holat === 'bloklangan' ? 'Qayta ochish' : 'Bloklash'}
                          </Yuborish>
                        </form>
                      </div>
                    </details>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col">
        <CardHeader title="Yangi xodim" meta="masalan: qabulxona" />
        <form action={xodimQosh} className="flex flex-col gap-3 px-5 pb-5">
          <FormaBolim nom="Kim">
            <div className="grid gap-3 sm:grid-cols-2">
              <Maydon nom="Ism familya">
                <input name="ism" required placeholder="Muhammadamin Karimov" className={kirishKlass} />
              </Maydon>
              <Maydon nom="Login" izoh={LOGIN_QOIDASI}>
                <input name="login" required placeholder="muhammadamin" autoComplete="off" className={kirishKlass} />
              </Maydon>
              <Maydon nom="Parol" izoh="kamida 8 belgi — o‘ziga aytasiz, keyin u Profil’da o‘zi almashtiradi">
                <input name="parol" type="text" required minLength={8} autoComplete="new-password" className={kirishKlass} />
              </Maydon>
              <Maydon nom="Lavozim">
                <select name="rol" defaultValue="qabulxona" className={kirishKlass}>
                  {beraOladi.map((l) => (
                    <option key={l.rol} value={l.rol}>{ROL_NOMI[l.rol]}</option>
                  ))}
                </select>
              </Maydon>
            </div>
          </FormaBolim>
          <ul className="flex flex-col gap-1 text-[12px] text-ink-3">
            {LAVOZIM.map((l) => (
              <li key={l.rol}><b className="text-ink-2">{ROL_NOMI[l.rol]}</b> — {l.izoh}</li>
            ))}
          </ul>
          <Yuborish>Hisob ochish</Yuborish>
        </form>
      </Card>
    </div>
  )
}

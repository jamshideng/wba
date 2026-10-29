import Link from 'next/link'
import { talabProfil, getUstoz, adminmi, staffmi, ustozRejimi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Badge, Button, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { JonliForma } from '@/components/jonli-forma'
import { davrNomi, joriyDavr, guruhUstozsiz } from '@/lib/format'
import { davrOqi } from '@/lib/kiritish'
import { asosiy, foizTon, natijaMatni, son, type OylikNatija } from '@/lib/oylik-test'
import { elonQil } from './actions'

export const metadata = { title: 'Oylik test' }
export const dynamic = 'force-dynamic'

/**
 * OYLIK TEST — har oy har guruh bitta test (0104).
 *   ustoz — o'z guruhlari: natija kiritadi;
 *   admin — hamma guruh: ko'radi, e'lon qiladi, Excel / PDF yuklab oladi.
 * O'quvchi va ota-ona natijani o'z sahifasida ko'radi (faqat e'lon qilingani).
 */
export default async function OylikTest({
  searchParams,
}: {
  searchParams: Promise<{ davr?: string; fan?: string; ok?: string; xato?: string }>
}) {
  const profil = await talabProfil()
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Oylik test" />

  const s = await searchParams
  const davr = davrOqi(s.davr ?? null) ?? joriyDavr()
  const supabase = await createClient()
  const admin = adminmi(profil.rol)
  const xodim = staffmi(profil.rol)

  const [y, m] = davr.split('-').map(Number)
  const boshi = `${davr}-01`
  const oxiri = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)

  // RLS: ustozga o'z guruhlari, xodimga hammasi. Xodim "ustoz" rejimida — faqat o'ziniki.
  const ustozIdsi = ustozRejimi(profil) ? (await getUstoz())?.id : undefined
  const { data: gXom } = await supabase
    .from('groups')
    .select('id, nom, teacher_id, subject_id, subjects(nom), teachers(ism)')
    .eq('holat', 'faol')
    .order('nom')
  type G = { id: string; nom: string; teacher_id: string | null; subject_id: string | null; subjects: { nom: string } | null; teachers: { ism: string } | null }
  const guruhlar = ((gXom ?? []) as unknown as G[]).filter((g) => !ustozIdsi || g.teacher_id === ustozIdsi)
  const gIdlar = guruhlar.map((g) => g.id)

  const [{ data: yXom }, { data: nXom }] = await Promise.all([
    gIdlar.length
      ? supabase.from('enrollments').select('student_id, group_id, tugadi').in('group_id', gIdlar).lte('boshlandi', oxiri)
      : Promise.resolve({ data: [] }),
    gIdlar.length
      ? supabase.from('v_oylik_natijalar').select('*').eq('davr', davr).in('group_id', gIdlar)
      : Promise.resolve({ data: [] }),
  ])

  const oquvchiSoni = new Map<string, number>()
  for (const e of (yXom ?? []) as { group_id: string; tugadi: string | null }[]) {
    if (e.tugadi && e.tugadi < boshi) continue
    oquvchiSoni.set(e.group_id, (oquvchiSoni.get(e.group_id) ?? 0) + 1)
  }
  const natijalar = (nXom ?? []) as OylikNatija[]
  const guruhNatija = new Map<string, OylikNatija[]>()
  for (const n of natijalar) guruhNatija.set(n.group_id, [...(guruhNatija.get(n.group_id) ?? []), n])

  const foizlar = natijalar.filter((n) => n.foiz != null).map((n) => Number(n.foiz))
  const ortacha = foizlar.length ? foizlar.reduce((a, b) => a + b, 0) / foizlar.length : null
  const elonsiz = natijalar.filter((n) => !n.elon_qilingan).length
  const kiritilganGuruh = [...guruhNatija.keys()].length

  // Reyting: oyning eng yaxshi natijalari (fan bo'yicha filtr)
  const fanlar = [...new Map(natijalar.filter((n) => n.fan).map((n) => [n.fan!, n.fan!])).values()].sort((a, b) => a.localeCompare(b, 'uz'))
  const fan = s.fan && fanlar.includes(s.fan) ? s.fan : ''
  const reyting = natijalar
    .filter((n) => n.foiz != null && (!fan || n.fan === fan))
    .sort((a, b) => Number(b.foiz) - Number(a.foiz))
    .slice(0, 20)

  const qaytish = `/crm/oylik-test?davr=${davr}`

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Oylik test"
        izoh={`${davrNomi(davr)} · ${admin ? 'barcha guruhlar' : 'guruhlaringiz'}`}
        amal={
          admin && natijalar.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Button href={`/crm/oylik-test/eksport?davr=${davr}`} yuklab variant="ikkilamchi">Excel</Button>
              <Button href={`/crm/oylik-test/chop?davr=${davr}`} variant="ikkilamchi">PDF</Button>
            </div>
          ) : undefined
        }
      />

      <Xabar ok={s.ok} xato={s.xato} />

      <JonliForma className="flex flex-wrap items-end gap-2.5">
        <Maydon nom="Oy">
          <input type="month" name="davr" defaultValue={davr} className={kirishKlass} />
        </Maydon>
      </JonliForma>

      {xodim && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Test kiritilgan guruh" value={`${kiritilganGuruh} / ${guruhlar.length}`} />
          <Stat label="Natijalar" value={String(natijalar.length)} />
          <Stat label="O‘rtacha natija" value={ortacha == null ? '—' : `${son(ortacha)}%`} ton="ok" />
          <Stat label="E’lon kutmoqda" value={String(elonsiz)} ton={elonsiz ? 'accent' : 'neytral'} />
        </div>
      )}

      {admin && elonsiz > 0 && (
        <form action={elonQil} className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-accent bg-accent-soft px-4 py-3">
          <p className="text-[13px]">
            <b>{elonsiz} ta natija</b> e’lon qilinmagan — o‘quvchilar hali ko‘rmaydi.
          </p>
          <input type="hidden" name="kim" value="davr" />
          <input type="hidden" name="davr" value={davr} />
          <input type="hidden" name="qaytish" value={qaytish} />
          <Button type="submit">Hammasini e’lon qilish</Button>
        </form>
      )}

      <Card className="flex flex-col">
        <CardHeader title="Guruhlar" meta={`${guruhlar.length} ta`} />
        {guruhlar.length === 0 ? (
          <div className="px-5 pb-5">
            <Empty>Faol guruh yo‘q.</Empty>
          </div>
        ) : (
          <ul>
            {guruhlar.map((g) => {
              const n = guruhNatija.get(g.id) ?? []
              const f = n.filter((x) => x.foiz != null).map((x) => Number(x.foiz))
              const ort = f.length ? f.reduce((a, b) => a + b, 0) / f.length : null
              const elon = n.filter((x) => x.elon_qilingan).length
              const jami = oquvchiSoni.get(g.id) ?? 0
              return (
                <li key={g.id} className="flex flex-wrap items-center gap-3 border-t border-line-soft px-5 py-3">
                  <Link href={`/crm/oylik-test/${g.id}?davr=${davr}`} className="min-w-0 flex-1 hover:text-brand">
                    <span className="block truncate text-[13.5px] font-semibold">{admin ? g.nom : guruhUstozsiz(g.nom)}</span>
                    <span className="text-[12px] text-ink-3">
                      {n.length === 0 ? 'Natija kiritilmagan' : `${n.length} / ${jami} o‘quvchi kiritilgan`}
                      {ort != null && ` · o‘rtacha ${son(ort)}%`}
                    </span>
                  </Link>
                  {n.length > 0 && (
                    <Badge ton={elon === n.length ? 'ok' : elon ? 'accent' : 'jim'} nuqta>
                      {elon === n.length ? 'E’lon qilingan' : elon ? `${elon} ta e’lon` : 'E’lon qilinmagan'}
                    </Badge>
                  )}
                  <Button href={`/crm/oylik-test/${g.id}?davr=${davr}`} variant={n.length ? 'ikkilamchi' : 'asosiy'}>
                    {n.length ? 'Ochish' : 'Kiritish'}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {xodim && natijalar.length > 0 && (
        <Card className="flex flex-col">
          <CardHeader title="Oyning eng yaxshi natijalari" meta={fan || 'barcha fanlar'} />
          {fanlar.length > 1 && (
            <JonliForma className="flex flex-wrap items-end gap-2.5 px-5 pb-3">
              <input type="hidden" name="davr" value={davr} />
              <Maydon nom="Fan">
                <select name="fan" defaultValue={fan} className={kirishKlass}>
                  <option value="">Barcha fanlar</option>
                  {fanlar.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </Maydon>
            </JonliForma>
          )}
          <ol>
            {reyting.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 border-t border-line-soft px-5 py-2.5">
                <span className="tnum flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[13px] font-bold text-ink-3">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <Link href={`/crm/oquvchilar/${r.student_id}`} className="block truncate text-[13.5px] font-semibold hover:text-brand">
                    {r.fish}
                  </Link>
                  <span className="block truncate text-[12px] text-ink-3">
                    {guruhUstozsiz(r.guruh)} · {natijaMatni(r)}
                  </span>
                </span>
                <Badge ton={foizTon(r.foiz)}>{asosiy(r)}</Badge>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  )
}

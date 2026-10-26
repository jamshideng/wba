import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Empty, Badge } from '@/components/ui'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { KETISH_SABABLARI, ketishNomi } from '@/lib/ketish'
import { ketishSababiBelgila } from '../oquvchilar/actions'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { pul, sana, jadval } from '@/lib/format'

export const metadata = { title: 'Arxiv' }
export const dynamic = 'force-dynamic'

/**
 * Arxiv (Sheets "Arxiv" varag'i, 0030): ketgan o'quvchilar — qarzi bilan,
 * yopilgan guruhlar va arxivdagi ustozlar. Hech narsa o'chirilmaydi:
 * o'quvchi shu ID bilan profilidan qaytariladi, guruh — tahrirlashda
 * holatini "Faol" qilib.
 */
export default async function Arxiv({ searchParams }: { searchParams: Promise<{ ok?: string; xato?: string }> }) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const s = await searchParams
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Arxiv" />

  const supabase = await createClient()
  const [{ data: oquvchilar }, { data: guruhlar }, { data: ustozlar }] = await Promise.all([
    supabase.from('v_arxiv_oquvchilar').select('student_id, fish, arxiv_sana, arxiv_sabab, qarz, guruhlar, ketish_sababi').order('arxiv_sana', { ascending: false, nullsFirst: false }),
    supabase.from('groups').select('id, nom, boshlanish, tugash, kunlar, teachers(ism)').eq('holat', 'yopilgan').order('nom'),
    supabase.from('teachers').select('id, ism, telefon').eq('holat', 'bloklangan').order('ism'),
  ])

  type Oquvchi = { student_id: string; fish: string; arxiv_sana: string | null; arxiv_sabab: string | null; qarz: number; guruhlar: string | null; ketish_sababi: string | null }
  type Guruh = { id: string; nom: string; boshlanish: string; tugash: string; kunlar: number[]; teachers: { ism: string } | null }
  const oList = (oquvchilar ?? []) as unknown as Oquvchi[]
  const gList = (guruhlar ?? []) as unknown as Guruh[]
  const uList = (ustozlar ?? []) as { id: string; ism: string; telefon: string | null }[]
  const qarzJami = oList.reduce((a, o) => a + Math.max(0, Number(o.qarz) || 0), 0)

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Arxiv" izoh="o‘chirilmaydi — qaytarish mumkin" />
      <Xabar ok={s.ok} xato={s.xato} />

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <Stat label="Arxivdagi o‘quvchilar" value={oList.length} href="/crm/arxiv?b=oq" />
        <Stat label="Arxivdagilar qarzi" value={qarzJami} sub="so‘m" ton={qarzJami > 0 ? 'brand' : undefined} href="/crm/arxiv?b=qarz" />
        <Stat label="Yopilgan guruhlar" value={gList.length} href="/crm/arxiv?b=guruh" />
        <Stat label="Arxivdagi ustozlar" value={uList.length} href="/crm/arxiv?b=ustoz" />
      </div>

      <Card className="flex flex-col">
        <CardHeader title="O‘quvchilar" meta={`${oList.length} ta`} />
        {oList.length === 0 ? (
          <div className="px-5 pb-5"><Empty>Arxivda o‘quvchi yo‘q.</Empty></div>
        ) : (
          <ul className="flex flex-col">
            {oList.map((o) => (
              <li key={o.student_id} data-belgi={`oq${Number(o.qarz) > 0 ? ' qarz' : ''}`} className="border-b border-line-soft last:border-0">
                <Link
                  href={`/crm/oquvchilar/${o.student_id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 transition hover:bg-surface-2"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13.5px] font-semibold">{o.fish}</span>
                      <Badge ton={o.ketish_sababi ? 'jim' : 'accent'}>{ketishNomi(o.ketish_sababi)}</Badge>
                    </span>
                    <span className="truncate text-[12px] text-ink-3">
                      {o.student_id}
                      {o.arxiv_sana ? ` · ${sana(o.arxiv_sana)}` : ''}
                      {o.arxiv_sabab ? ` · ${o.arxiv_sabab}` : ''}
                      {o.guruhlar ? ` · ${o.guruhlar}` : ''}
                    </span>
                  </span>
                  <span className={`tnum font-[family-name:var(--font-mono)] text-[12.5px] ${Number(o.qarz) > 0 ? 'text-brand' : 'text-ink-4'}`}>
                    {Number(o.qarz) > 0 ? `qarz ${pul(o.qarz)}` : '—'}
                  </span>
                </Link>
                <details className="px-5 pb-3">
                  <summary className="cursor-pointer text-[12px] text-ink-3 hover:text-ink">
                    {o.ketish_sababi ? 'Sababni o‘zgartirish' : 'Sabab qo‘yish'}
                  </summary>
                  <form action={ketishSababiBelgila} className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="student_id" value={o.student_id} />
                    <input type="hidden" name="qaytish" value="/crm/arxiv" />
                    <Maydon nom="Sabab">
                      <select name="turi" required defaultValue={o.ketish_sababi ?? ''} className={kirishKlass}>
                        <option value="" disabled>
                          Tanlang…
                        </option>
                        {Object.entries(KETISH_SABABLARI).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </Maydon>
                    <Maydon nom="Izoh" izoh="“Boshqa” bo‘lsa — majburiy">
                      <input name="izoh" placeholder={o.arxiv_sabab ?? ''} className={kirishKlass} />
                    </Maydon>
                    <Yuborish kutish="…">Saqlash</Yuborish>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader title="Yopilgan guruhlar" meta={`${gList.length} ta`} />
          {gList.length === 0 ? (
            <div className="px-5 pb-5"><Empty>Yopilgan guruh yo‘q.</Empty></div>
          ) : (
            <ul className="flex flex-col">
              {gList.map((g) => (
                <li key={g.id} data-belgi="guruh">
                  <Link href={`/crm/guruhlar/${g.id}`} className="flex min-h-11 flex-col justify-center gap-0.5 border-b border-line-soft px-5 py-2.5 last:border-0 hover:bg-surface-2">
                    <span className="truncate text-[13px] font-semibold">{g.nom}</span>
                    <span className="truncate text-[11.5px] text-ink-3">
                      {g.teachers?.ism ?? '—'} · {jadval(g.boshlanish, g.tugash, g.kunlar)} · qayta ochish — tahrirlashda “Faol”
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Arxivdagi ustozlar" meta={`${uList.length} ta`} />
          {uList.length === 0 ? (
            <div className="px-5 pb-5"><Empty>Arxivda ustoz yo‘q.</Empty></div>
          ) : (
            <ul className="flex flex-col px-5 pb-3">
              {uList.map((u) => (
                <li key={u.id} data-belgi="ustoz" className="flex min-h-11 items-center justify-between border-b border-line-soft text-[13px] last:border-0">
                  <span>{u.ism}</span>
                  <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-ink-3">{u.id}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

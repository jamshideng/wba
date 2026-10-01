import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Empty } from '@/components/ui'
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
export default async function Arxiv() {
  await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Arxiv" />

  const supabase = await createClient()
  const [{ data: oquvchilar }, { data: guruhlar }, { data: ustozlar }] = await Promise.all([
    supabase.from('v_arxiv_oquvchilar').select('student_id, fish, arxiv_sana, arxiv_sabab, qarz, guruhlar').order('arxiv_sana', { ascending: false, nullsFirst: false }),
    supabase.from('groups').select('id, nom, boshlanish, tugash, kunlar, teachers(ism)').eq('holat', 'yopilgan').order('nom'),
    supabase.from('teachers').select('id, ism, telefon').eq('holat', 'bloklangan').order('ism'),
  ])

  type Oquvchi = { student_id: string; fish: string; arxiv_sana: string | null; arxiv_sabab: string | null; qarz: number; guruhlar: string | null }
  type Guruh = { id: string; nom: string; boshlanish: string; tugash: string; kunlar: number[]; teachers: { ism: string } | null }
  const oList = (oquvchilar ?? []) as unknown as Oquvchi[]
  const gList = (guruhlar ?? []) as unknown as Guruh[]
  const uList = (ustozlar ?? []) as { id: string; ism: string; telefon: string | null }[]
  const qarzJami = oList.reduce((a, o) => a + Math.max(0, Number(o.qarz) || 0), 0)

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Arxiv" izoh="o‘chirilmaydi — qaytarish mumkin" />

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <Stat label="Arxivdagi o‘quvchilar" value={oList.length} />
        <Stat label="Arxivdagilar qarzi" value={qarzJami} sub="so‘m" ton={qarzJami > 0 ? 'brand' : undefined} />
        <Stat label="Yopilgan guruhlar" value={gList.length} />
        <Stat label="Arxivdagi ustozlar" value={uList.length} />
      </div>

      <Card className="flex flex-col">
        <CardHeader title="O‘quvchilar" meta={`${oList.length} ta`} />
        {oList.length === 0 ? (
          <div className="px-5 pb-5"><Empty>Arxivda o‘quvchi yo‘q.</Empty></div>
        ) : (
          <ul className="flex flex-col">
            {oList.map((o) => (
              <li key={o.student_id}>
                <Link
                  href={`/crm/oquvchilar/${o.student_id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line-soft px-5 py-3 transition last:border-0 hover:bg-surface-2"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[13.5px] font-semibold">{o.fish}</span>
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
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader title="Yopilgan guruhlar" meta={`${gList.length} ta`} />
          {gList.length === 0 ? (
            <div className="px-5 pb-5"><Empty>Yopilgan guruh yo‘q.</Empty></div>
          ) : (
            <ul className="flex flex-col">
              {gList.map((g) => (
                <li key={g.id}>
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
                <li key={u.id} className="flex min-h-11 items-center justify-between border-b border-line-soft text-[13px] last:border-0">
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

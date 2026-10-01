import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { sana, sanaQisqa, bugunToshkent } from '@/lib/format'
import { kunlarOraligi, umumiyDavomat, type BelgiKirish } from '@/lib/davomat-umumiy'

export const metadata = { title: 'Umumiy davomat' }
export const dynamic = 'force-dynamic'

const DAVRLAR = { '7': 7, '14': 14, '30': 30 } as const

/** Supabase bitta so'rovda 1000 qatordan ko'p bermaydi — belgilar bo'laklab olinadi. */
const BOLAK = 1000

/**
 * Umumiy davomat (LevelUp "Attendance" o'rni): oxirgi 7/14/30 kun —
 * guruhlar foizi past→yuqori, belgilanmay qolgan dars kunlari bilan.
 * Faqat xodimlar (ustoz o'z guruhini jurnalda ko'radi).
 */
export default async function UmumiyDavomat({ searchParams }: { searchParams: Promise<{ kun?: string }> }) {
  await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Umumiy davomat" />

  const s = await searchParams
  const kalit = (s.kun ?? '') in DAVRLAR ? (s.kun as keyof typeof DAVRLAR) : '14'
  const bugun = bugunToshkent()
  const dan = new Date(Date.parse(`${bugun}T00:00:00Z`) - (DAVRLAR[kalit] - 1) * 86400000).toISOString().slice(0, 10)
  const kunlar = kunlarOraligi(dan, bugun)

  const supabase = await createClient()
  const [{ data: guruhlar }, { data: yozilishlar }, { data: darslar }, { data: damlar }] = await Promise.all([
    supabase.from('groups').select('id, nom, kunlar').eq('holat', 'faol').order('nom'),
    supabase.from('enrollments').select('group_id, boshlandi, tugadi').lte('boshlandi', bugun),
    supabase.from('lessons').select('id, group_id, sana').gte('sana', dan).lte('sana', bugun),
    supabase.from('dam_kunlar').select('sana').gte('sana', dan).lte('sana', bugun),
  ])

  const dList = (darslar ?? []) as { id: string; group_id: string; sana: string }[]
  const belgilar: BelgiKirish[] = []
  const idlar = dList.map((d) => d.id)
  // .in() ro'yxati uzun URL bo'lmasin — darslar ham bo'laklab
  for (let i = 0; i < idlar.length; i += 150) {
    const bolak = idlar.slice(i, i + 150)
    for (let boshi = 0; ; boshi += BOLAK) {
      const { data } = await supabase
        .from('attendance')
        .select('lesson_id, holat')
        .in('lesson_id', bolak)
        .order('lesson_id')
        .order('student_id')
        .range(boshi, boshi + BOLAK - 1)
      const qism = (data ?? []) as BelgiKirish[]
      belgilar.push(...qism)
      if (qism.length < BOLAK) break
    }
  }

  const qatorlar = umumiyDavomat(
    kunlar,
    (guruhlar ?? []) as { id: string; nom: string; kunlar: number[] | null }[],
    (yozilishlar ?? []) as { group_id: string; boshlandi: string; tugadi: string | null }[],
    dList,
    belgilar,
    new Set(((damlar ?? []) as { sana: string }[]).map((d) => d.sana)),
  )

  const jamiBelgi = qatorlar.reduce((a, q) => a + q.belgilar, 0)
  const jamiKeldi = qatorlar.reduce((a, q) => a + q.keldi, 0)
  const jamiKelmadi = qatorlar.reduce((a, q) => a + q.kelmadi, 0)
  const jamiDars = qatorlar.reduce((a, q) => a + q.darslar, 0)
  const belgilanmagan = qatorlar.reduce((a, q) => a + q.belgilanmagan.length, 0)
  const foiz = jamiBelgi ? Math.round((jamiKeldi * 100) / jamiBelgi) : null

  const tugma = (k: keyof typeof DAVRLAR) => (
    <Link
      key={k}
      href={`/crm/davomat/umumiy?kun=${k}`}
      className={`flex min-h-11 items-center rounded-[9px] border px-4 text-[13px] transition ${
        kalit === k ? 'border-brand bg-brand-soft text-ink' : 'border-line text-ink-3 hover:text-ink'
      }`}
    >
      {k} kun
    </Link>
  )

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Umumiy davomat"
        izoh={`${sana(dan)} — ${sana(bugun)}`}
        amal={<div className="flex gap-2">{(Object.keys(DAVRLAR) as (keyof typeof DAVRLAR)[]).map(tugma)}</div>}
      />

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <Stat label="O‘tilgan darslar" value={jamiDars} sub="belgi qo‘yilgan" />
        <Stat label="Keldi" value={jamiKeldi} sub="kechikkanlar bilan" ton="ok" />
        <Stat label="Kelmadi" value={jamiKelmadi} sub="sababsiz" ton={jamiKelmadi ? 'brand' : 'neytral'} />
        <Stat
          label="Davomat"
          value={foiz === null ? '—' : `${foiz}%`}
          sub={belgilanmagan ? `${belgilanmagan} ta dars belgilanmagan` : 'hamma dars belgilangan'}
          ton={foiz !== null && foiz < 70 ? 'brand' : 'neytral'}
          border={belgilanmagan ? 'accent' : undefined}
        />
      </div>

      <Card className="flex flex-col">
        <CardHeader title="Guruhlar" meta="foizi pastdan yuqoriga" />
        {qatorlar.length === 0 ? (
          <div className="px-5 pb-5">
            <Empty>Faol guruh yo‘q.</Empty>
          </div>
        ) : (
          <ul className="flex flex-col">
            {qatorlar.map((q) => (
              <li key={q.id} className="flex flex-col gap-2 border-t border-line-soft px-5 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link href={`/crm/davomat/${q.id}`} className="min-w-0 truncate text-[13.5px] font-semibold hover:text-brand">
                    {q.nom}
                  </Link>
                  <span className="flex items-center gap-3">
                    <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-ink-3">
                      {q.darslar} dars · {q.keldi}/{q.belgilar}
                      {q.sababli ? ` · ${q.sababli} sababli` : ''}
                    </span>
                    <Badge ton={q.foiz === null ? 'jim' : q.foiz >= 85 ? 'ok' : q.foiz >= 70 ? 'accent' : 'brand'}>
                      {q.foiz === null ? '—' : `${q.foiz}%`}
                    </Badge>
                  </span>
                </div>
                {q.foiz !== null && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${q.foiz >= 85 ? 'bg-ok' : q.foiz >= 70 ? 'bg-accent' : 'bg-brand'}`}
                      style={{ width: `${q.foiz}%` }}
                    />
                  </div>
                )}
                {q.belgilanmagan.length > 0 && (
                  <span className="text-[12px] text-accent">
                    Belgilanmagan: {q.belgilanmagan.map((k) => sanaQisqa(k)).join(', ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Stat, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan, Sahifalash } from '@/components/crm'
import { kirishKlass } from '@/components/forma'
import { IconPhone, IconDebt, IconStudents } from '@/components/icons'
import { pul, telefon } from '@/lib/format'
import type { Qarzdor } from '@/lib/types'
import { qidiruvTuri, telefonFiltri } from '@/lib/qidiruv'
import { JonliForma } from '@/components/jonli-forma'

export const metadata = { title: 'Qarzdorlar' }
export const dynamic = 'force-dynamic'

const SAHIFA_SONI = 30

/**
 * Qarzdorlar — eng kattadan. Botdagi "Qarzdorlar" tugmasi bilan bir xil,
 * faqat bu yerda qo'ng'iroq qilish va to'lov yozish bir bosishda.
 * Qarz bazada hisoblanadi (v_qarzdorlar): Σ hisob-faktura − Σ to'lov.
 */
export default async function Qarzdorlar({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sahifa?: string }>
}) {
  await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Qarzdorlar" />

  const s = await searchParams
  const qidiruv = (s.q ?? '').trim()
  const sahifa = Math.max(1, Number(s.sahifa ?? 1) || 1)
  const boshi = (sahifa - 1) * SAHIFA_SONI

  const supabase = await createClient()

  let soorov = supabase.from('v_qarzdorlar').select('*', { count: 'exact' })
  const qt = qidiruvTuri(qidiruv)
  if (qt?.turi === 'id') soorov = soorov.ilike('student_id', qt.naqsh)
  else if (qt?.turi === 'tel') soorov = soorov.or(telefonFiltri(qt.naqsh))
  else if (qt) soorov = soorov.ilike('fish', qt.naqsh)

  const [{ data, count }, { data: panel }] = await Promise.all([
    soorov.order('qarz', { ascending: false }).range(boshi, boshi + SAHIFA_SONI - 1),
    supabase.from('v_dashboard').select('qarzdorlar, jami_qarz').maybeSingle(),
  ])

  const royxat = (data ?? []) as Qarzdor[]

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Qarzdorlar" izoh="eng kattadan" />

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <Stat label="Jami qarz" value={Number(panel?.jami_qarz ?? 0)} sub="so‘m" ton="brand" border="brand" Icon={IconDebt} />
        <Stat label="Qarzdorlar" value={Number(panel?.qarzdorlar ?? 0)} sub="faol o‘quvchi" Icon={IconStudents} />
      </div>

      <JonliForma className="flex gap-2.5">
        <input name="q" type="search" autoComplete="off" defaultValue={qidiruv} placeholder="Ism, ID yoki telefon…" aria-label="Qidiruv" className={`${kirishKlass} sm:max-w-xs`} />
      </JonliForma>

      <Card className="flex flex-col">
        {royxat.length === 0 ? (
          <div className="p-5">
            <Empty>{qidiruv ? 'Shu ism bo‘yicha qarzdor topilmadi.' : 'Qarzdor yo‘q. Bu — yaxshi xabar.'}</Empty>
          </div>
        ) : (
          <ul>
            {royxat.map((q, i) => {
              const tel = q.shaxsiy_tel ?? q.ota_tel ?? q.ona_tel
              return (
                <li key={q.student_id} className="flex flex-wrap items-center gap-3 border-b border-line-soft px-5 py-3 last:border-0">
                  <span className="tnum w-6 font-[family-name:var(--font-mono)] text-[11px] text-ink-4">{boshi + i + 1}</span>

                  <Link href={`/crm/oquvchilar/${q.student_id}`} className="flex min-w-0 flex-1 flex-col gap-0.5 hover:text-brand">
                    <span className="truncate text-[13.5px] font-semibold">{q.fish}</span>
                    <span className="truncate text-[11.5px] text-ink-3">{q.guruhlar ?? '—'}</span>
                  </Link>

                  <span className="tnum font-[family-name:var(--font-mono)] text-[14px] text-brand">{pul(q.qarz)}</span>

                  <span className="flex gap-2">
                    {tel && (
                      <a
                        href={`tel:${tel}`}
                        title={telefon(tel)}
                        aria-label={`${q.fish}ga qo‘ng‘iroq`}
                        className="flex size-11 items-center justify-center rounded-[9px] border border-line text-ink-3 hover:text-ink"
                      >
                        <IconPhone size={16} />
                      </a>
                    )}
                    <Link
                      href={`/crm/tolovlar/yangi?oquvchi=${q.student_id}`}
                      className="flex min-h-11 items-center rounded-[9px] bg-brand text-white px-4 text-[13px] font-semibold hover:brightness-110"
                    >
                      To‘lov
                    </Link>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Sahifalash yol="/crm/qarzdorlar" sorov={{ q: qidiruv || undefined }} sahifa={sahifa} jami={count ?? 0} soni={SAHIFA_SONI} />
    </div>
  )
}

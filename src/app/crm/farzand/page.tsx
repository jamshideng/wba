import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { pul, sana, jadval, davrNomi, joriyDavr, bugunToshkent } from '@/lib/format'
import type { PaymentMethod } from '@/lib/types'

export const metadata = { title: 'Farzandim' }
export const dynamic = 'force-dynamic'

const USUL_NOMI: Record<PaymentMethod, string> = { naqd: 'Naqd', karta: 'Karta', click: 'Click', payme: 'Payme' }

/**
 * OTA-ONA PANELI — faqat O'Z farzandini ko'radi (RLS *_parent_read,
 * app_farzand_id). Yozish yo'q, faqat ko'rish.
 */
export default async function Farzand() {
  await talabRol('ota_ona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Farzandim" />

  const supabase = await createClient()
  const davr = joriyDavr()
  const bugun = bugunToshkent()

  // RLS faqat farzandning qatorini beradi
  const { data: oquvchi } = await supabase.from('students').select('id, fish, holat').maybeSingle()

  if (!oquvchi) {
    return (
      <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
        <Sarlavha nom="Farzandim" izoh="ota-ona" />
        <Card className="p-5">
          <Empty>
            Hisobingiz hali farzandingizga bog‘lanmagan. Markaz adminiga aytsangiz, bir bosishda bog‘lab qo‘yadi.
          </Empty>
        </Card>
      </div>
    )
  }

  const [{ data: yozilishlar }, { data: balans }, { data: woblr }, { data: davomat }, { data: tolovlar }] =
    await Promise.all([
      supabase
        .from('enrollments')
        .select('id, group_id, boshlandi, holat, groups(nom, boshlanish, tugash, kunlar, teachers(ism))')
        .eq('student_id', oquvchi.id)
        .neq('holat', 'tugagan')
        .order('boshlandi'),
      supabase.from('v_enrollment_balance').select('enrollment_id, qarz').eq('student_id', oquvchi.id),
      supabase.from('v_woblr_balance').select('jami_ball, balans').eq('student_id', oquvchi.id).maybeSingle(),
      supabase
        .from('v_attendance_monthly')
        .select('davr, darslar, kelgan, foiz')
        .eq('student_id', oquvchi.id)
        .order('davr', { ascending: false })
        .limit(6),
      supabase
        .from('payments')
        .select('id, sana, davr, summa, usul, tasdiqlangan, bekor')
        .eq('student_id', oquvchi.id)
        .order('sana', { ascending: false })
        .limit(8),
    ])

  type Yozilish = {
    id: string
    group_id: string
    boshlandi: string
    groups: { nom: string; boshlanish: string; tugash: string; kunlar: number[]; teachers: { ism: string } | null } | null
  }
  const yList = (yozilishlar ?? []) as unknown as Yozilish[]
  const jamiQarz = ((balans ?? []) as { qarz: number }[]).reduce((a, b) => a + (Number(b.qarz) || 0), 0)
  const w = (woblr ?? null) as { jami_ball: number; balans: number } | null

  type Davomat = { davr: string; darslar: number; kelgan: number; foiz: number }
  const dList = (davomat ?? []) as unknown as Davomat[]
  const shuOy = dList.filter((d) => d.davr === davr)
  const shuOyFoiz = shuOy.length ? Math.round(shuOy.reduce((a, d) => a + Number(d.foiz), 0) / shuOy.length) : null

  type Tolov = { id: number; sana: string; davr: string; summa: number; usul: PaymentMethod | null; tasdiqlangan: boolean; bekor: boolean }
  const tList = (tolovlar ?? []) as unknown as Tolov[]

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom={oquvchi.fish}
        izoh={`Farzandingiz · ${sana(bugun)}`}
        amal={oquvchi.holat === 'faol' ? <Badge ton="ok">Faol</Badge> : <Badge ton="accent">{oquvchi.holat}</Badge>}
      />

      <p className="lbl">To‘lovlar tarixi, oylik davomat jadvali va bildirishnomalar — tez orada.</p>

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <Stat label="Qarz" value={jamiQarz} sub="so‘m" ton={jamiQarz > 0 ? 'brand' : 'ok'} border={jamiQarz > 0 ? 'brand' : undefined} />
        <Stat label="Woblar" value={w ? Number(w.balans) : 0} sub={w ? `jami ${Number(w.jami_ball)} olingan` : 'hali yo‘q'} ton="accent" />
        <Stat
          label={`Davomat · ${davrNomi(davr)}`}
          value={shuOyFoiz === null ? '—' : `${shuOyFoiz}%`}
          sub={shuOyFoiz === null ? 'belgilanmagan' : 'o‘rtacha'}
          ton={shuOyFoiz !== null && shuOyFoiz >= 80 ? 'ok' : 'neytral'}
        />
        <Stat label="Guruhlar" value={yList.length} sub="hozir o‘qiyapti" />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="flex flex-col">
          <CardHeader title="Guruhlari" meta={`${yList.length} ta`} />
          <div className="flex flex-col gap-2.5 px-5 pb-4">
            {yList.length === 0 ? (
              <Empty>Hali guruhga biriktirilmagan.</Empty>
            ) : (
              yList.map((y) => (
                <div key={y.id} className="flex flex-col gap-1 rounded-[10px] border border-line px-4 py-3">
                  <span className="text-[13.5px] font-semibold">{y.groups?.nom ?? '—'}</span>
                  <span className="text-[12px] text-ink-3">
                    {y.groups?.teachers?.ism ?? '[ANIQLANMAGAN]'} ·{' '}
                    {jadval(y.groups?.boshlanish ?? null, y.groups?.tugash ?? null, y.groups?.kunlar ?? null)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Oxirgi to‘lovlar" meta="8 tagacha" />
          <div className="flex flex-col px-5 pb-4">
            {tList.length === 0 ? (
              <Empty>Hali to‘lov yo‘q.</Empty>
            ) : (
              tList.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 border-b border-line-soft py-2.5 last:border-0">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[12.5px] font-semibold">{davrNomi(t.davr)}</span>
                    <span className="text-[10.5px] text-ink-3">
                      {sana(t.sana)} · {t.usul ? USUL_NOMI[t.usul] : '[ANIQLANMAGAN]'}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {t.bekor ? (
                      <Badge ton="jim">bekor</Badge>
                    ) : t.tasdiqlangan ? (
                      <Badge ton="ok">tasdiq</Badge>
                    ) : (
                      <Badge ton="accent">kutilmoqda</Badge>
                    )}
                    <span className="tnum w-24 text-right font-[family-name:var(--font-mono)] text-[12.5px]">{pul(t.summa)}</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

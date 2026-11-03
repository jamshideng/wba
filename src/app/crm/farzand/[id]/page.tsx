import { notFound } from 'next/navigation'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { royxatOl, royxatNomi } from '@/lib/royxat'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Badge, Empty, Button } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { TelegramTaklif } from '@/components/telegram-taklif'
import { pul, sana, jadval, davrNomi, joriyDavr, bugunToshkent, guruhQisqa } from '@/lib/format'
import type { PaymentMethod } from '@/lib/types'
import { OylikNatijalarKarta, type MeningOylikNatijam } from '@/components/oylik-natijalar'
import { UstozKarta, type UstozMalumot } from '@/components/ustoz-karta'
import { farzandlarim } from '@/lib/farzand'
import { SinovFarzand } from './sinov'

export const metadata = { title: 'Farzandim' }
export const dynamic = 'force-dynamic'


/**
 * OTA-ONA PANELI — bitta farzand (0116: ota-onada bir nechta farzand bo'lishi
 * mumkin, RLS app_farzandmi). Yozish yo'q, faqat ko'rish.
 */
export default async function Farzand({ params }: { params: Promise<{ id: string }> }) {
  await talabRol('ota_ona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Farzandim" />

  const supabase = await createClient()
  const usulRoyxat = await royxatOl(supabase, 'tolov_usul')
  const davr = joriyDavr()
  const bugun = bugunToshkent()

  const { id } = await params
  const farzandlar = await farzandlarim()
  // RLS faqat o'z farzandlarini beradi; begona ID — 404
  const oquvchi = farzandlar.find((f) => f.id === id) ?? null
  if (!oquvchi && farzandlar.length) notFound()
  // 0117 — sinov darsidagi farzand: sinov kabineti ko'rinishi
  if (oquvchi?.sinov) return <SinovFarzand f={oquvchi} farzandlar={farzandlar} />

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
        .select('id, group_id, boshlandi, holat, groups(nom, boshlanish, tugash, kunlar, teacher_id, teachers(ism))')
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
    groups: { nom: string; boshlanish: string; tugash: string; kunlar: number[]; teacher_id: string | null; teachers: { ism: string } | null } | null
  }
  const yList = (yozilishlar ?? []) as unknown as Yozilish[]
  /* O'quvchi sahifasi (/crm/men) bilan bir qoida: qarz va oldindan to'lov
     alohida — manfiy qarz "−1 100 000" bo'lib ota-onani chalg'itmasin. */
  const qarzlar = ((balans ?? []) as { qarz: number }[]).map((b) => Number(b.qarz) || 0)
  const jamiQarz = qarzlar.reduce((a, q) => a + Math.max(q, 0), 0)
  const oldindan = qarzlar.reduce((a, q) => a + Math.max(-q, 0), 0)
  const w = (woblr ?? null) as { jami_ball: number; balans: number } | null

  type Davomat = { davr: string; darslar: number; kelgan: number; foiz: number }
  const dList = (davomat ?? []) as unknown as Davomat[]
  const shuOy = dList.filter((d) => d.davr === davr)
  const shuOyFoiz = shuOy.length ? Math.round(shuOy.reduce((a, d) => a + Number(d.foiz), 0) / shuOy.length) : null

  type Tolov = { id: number; sana: string; davr: string; summa: number; usul: PaymentMethod | null; tasdiqlangan: boolean; bekor: boolean }
  const tList = (tolovlar ?? []) as unknown as Tolov[]

  // 0104 — oylik test: faqat e'lon qilingan natijalar va guruhdagi o'rin
  // 0116 — faqat shu farzandning natijalari (oylik_natijalarim hammasini aralashtiradi)
  const ustozIdlar = [...new Set(yList.map((y) => y.groups?.teacher_id).filter((x): x is string => Boolean(x)))]
  const [{ data: oylikXom }, ...ustozXom] = await Promise.all([
    supabase.rpc('oylik_natijalari_farzand', { p_student: oquvchi.id }),
    ...ustozIdlar.map((t) => supabase.rpc('farzand_ustozi', { p_teacher: t })),
  ])
  const oylik = (oylikXom ?? []) as MeningOylikNatijam[]
  const ustozlar = new Map(ustozIdlar.map((t, i) => [t, ((ustozXom[i]?.data ?? []) as UstozMalumot[])[0] ?? null]))
  const yol = `/crm/farzand/${oquvchi.id}`

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom={oquvchi.fish}
        izoh={`Farzandingiz · ${sana(bugun)}`}
        amal={oquvchi.holat === 'faol' ? <Badge ton="ok">Faol</Badge> : <Badge ton="accent">{oquvchi.holat}</Badge>}
      />

      <TelegramTaklif kim="ota_ona" />


      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {jamiQarz === 0 && oldindan > 0 ? (
          <Stat label="Oldindan to‘langan" value={oldindan} sub="keyingi oylar uchun · so‘m" ton="ok" href={`${yol}?b=tolov`} />
        ) : (
          <Stat
            href={`${yol}?b=guruh,tolov`}
            label="Qarz"
            value={jamiQarz}
            sub={oldindan > 0 ? `yana ${pul(oldindan)} oldindan to‘langan` : 'so‘m'}
            ton={jamiQarz > 0 ? 'brand' : 'ok'}
            border={jamiQarz > 0 ? 'brand' : undefined}
          />
        )}
        <Stat label="Woblar" value={w ? Number(w.balans) : 0} sub={w ? `jami ${Number(w.jami_ball)} olingan` : 'hali yo‘q'} ton="accent" href={`/crm/woblr/tarix?oquvchi=${oquvchi.id}`} />
        <Stat
          href={`${yol}?b=guruh`}
          label={`Davomat · ${davrNomi(davr)}`}
          value={shuOyFoiz === null ? '—' : `${shuOyFoiz}%`}
          sub={shuOyFoiz === null ? 'belgilanmagan' : 'o‘rtacha'}
          ton={shuOyFoiz !== null && shuOyFoiz >= 80 ? 'ok' : 'neytral'}
        />
        <Stat label="Guruhlar" value={yList.length} sub="hozir o‘qiyapti" href={`${yol}?b=guruh`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-surface px-5 py-3.5">
        <span className="text-[13px] text-ink-2">
          Woblar marketdan {oquvchi.fish.split(' ')[0]} nomidan buyurtma bering — uning woblaridan yechiladi.
        </span>
        <Button href={`/crm/market?farzand=${oquvchi.id}`}>Woblar market</Button>
      </div>

      <OylikNatijalarKarta royxat={oylik} />

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="flex flex-col">
          <CardHeader title="Guruhlari" meta={`${yList.length} ta`} />
          <div className="flex flex-col gap-2.5 px-5 pb-4">
            {yList.length === 0 ? (
              <Empty>Hali guruhga biriktirilmagan.</Empty>
            ) : (
              yList.map((y) => (
                <div key={y.id} data-belgi="guruh" className="flex flex-col gap-1 rounded-[10px] border border-line px-4 py-3">
                  <span className="text-[13.5px] font-semibold">{guruhQisqa(y.groups?.nom)}</span>
                  <span className="text-[12px] text-ink-3">
                    {y.groups?.teacher_id && ustozlar.get(y.groups.teacher_id) ? (
                      <UstozKarta u={ustozlar.get(y.groups.teacher_id)!} />
                    ) : (
                      (y.groups?.teachers?.ism ?? '[ANIQLANMAGAN]')
                    )}{' '}
                    ·{' '}
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
                <div key={t.id} data-belgi="tolov" className="flex items-center justify-between gap-3 border-b border-line-soft py-2.5 last:border-0">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[12.5px] font-semibold">{davrNomi(t.davr)}</span>
                    <span className="text-[10.5px] text-ink-3">
                      {sana(t.sana)} · {t.usul ? royxatNomi(usulRoyxat, t.usul) : '[ANIQLANMAGAN]'}
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

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { talabProfil, panelYoli } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar } from '@/components/forma'
import { pul, sana, jadval, davrNomi, joriyDavr, bugunToshkent, vaqt } from '@/lib/format'
import type { DayType, PaymentMethod, AttendanceStatus, KeyingiDars } from '@/lib/types'

export const metadata = { title: 'Mening sahifam' }
export const dynamic = 'force-dynamic'

const USUL_NOMI: Record<PaymentMethod, string> = {
  naqd: 'Naqd',
  karta: 'Karta',
  click: 'Click',
  payme: 'Payme',
}

const DAVOMAT_NOMI: Record<AttendanceStatus, string> = {
  keldi: 'Keldi',
  kechikdi: 'Kechikdi',
  sababli: 'Sababli',
  kelmadi: 'Kelmadi',
}

/**
 * O'QUVCHINING O'Z PANELI.
 *
 * O'quvchi boshqaruv panelini ham, boshqa o'quvchilarni ham ko'rmaydi —
 * bu faqat sahifa darajasidagi tanlov emas: RLS ham shunday qurilgan
 * (0003_rls.sql: *_own_read siyosatlari). Ya'ni manzilni qo'lda yozib
 * ham begona ma'lumot chiqmaydi.
 *
 * Nima ko'rsatiladi: guruhlari, keyingi darslari, qarzi, to'lovlari,
 * davomati va woblari.
 */
export default async function MeningSahifam({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  const xabar = await searchParams
  const profil = await talabProfil()
  // Bu sahifa faqat o'quvchi uchun. Xodim/ustoz kirsa — o'z paneliga
  // qaytaramiz (aks holda "o'quvchi yozuviga bog'lanmagan" ko'rinardi).
  if (profil.rol !== 'oquvchi') redirect(panelYoli(profil.rol))
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Mening sahifam" />

  const supabase = await createClient()
  const bugun = bugunToshkent()
  const davr = joriyDavr()

  const { data: oquvchi } = await supabase
    .from('students')
    .select('id, fish, holat')
    .eq('profile_id', profil.id)
    .maybeSingle()

  /* Hisob ochilgan, lekin o'quvchiga bog'lanmagan holat: admin
     "Hisob ochish" da o'quvchini tanlashni esdan chiqargan. */
  if (!oquvchi) {
    return (
      <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
        <Sarlavha nom={profil.ism} izoh="o‘quvchi" />
        <Card className="p-5">
          <Empty>
            Hisobingiz hali o‘quvchi yozuviga bog‘lanmagan, shuning uchun ma’lumot ko‘rinmaydi.
            Markaz adminiga aytsangiz, bir bosishda bog‘lab qo‘yadi.
          </Empty>
        </Card>
      </div>
    )
  }

  const [
    { data: yozilishlar },
    { data: balans },
    { data: woblr },
    { data: davomat },
    { data: tolovlar },
  ] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id, group_id, boshlandi, holat, groups(nom, boshlanish, tugash, kun_turi, oylik_narx, teachers(ism))')
      .eq('student_id', oquvchi.id)
      .neq('holat', 'tugagan')
      .order('boshlandi'),
    supabase.from('v_enrollment_balance').select('enrollment_id, qarz').eq('student_id', oquvchi.id),
    supabase.from('v_woblr_balance').select('jami_ball, sarflangan, balans').eq('student_id', oquvchi.id).maybeSingle(),
    supabase
      .from('v_attendance_monthly')
      .select('davr, group_id, darslar, kelgan, foiz')
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
    holat: string
    groups: {
      nom: string
      boshlanish: string
      tugash: string
      kun_turi: DayType
      oylik_narx: number
      teachers: { ism: string } | null
    } | null
  }
  const yList = (yozilishlar ?? []) as unknown as Yozilish[]
  const guruhNomi = new Map(yList.map((y) => [y.group_id, y.groups?.nom ?? y.group_id]))

  /* Keyingi darslar — guruh JADVALIDAN (kun turi + vaqt), bazada
     hisoblanadi (0018: keyingi_darslar). Avval lessons jadvalidan
     olinardi: u yerda faqat o'tgan va ko'chirilgan darslar bor edi. */
  const { data: darslar } = yList.length
    ? await supabase.rpc('keyingi_darslar', { p_student: oquvchi.id, p_soni: 8 })
    : { data: [] }

  const jamiQarz = ((balans ?? []) as { qarz: number }[]).reduce((a, b) => a + (Number(b.qarz) || 0), 0)
  const qarzMap = new Map(((balans ?? []) as { enrollment_id: string; qarz: number }[]).map((b) => [b.enrollment_id, Number(b.qarz) || 0]))
  const w = (woblr ?? null) as { jami_ball: number; sarflangan: number; balans: number } | null

  type Davomat = { davr: string; group_id: string; darslar: number; kelgan: number; foiz: number }
  const dList = (davomat ?? []) as unknown as Davomat[]
  const shuOy = dList.filter((d) => d.davr === davr)
  const shuOyFoiz = shuOy.length
    ? Math.round(shuOy.reduce((a, d) => a + Number(d.foiz), 0) / shuOy.length)
    : null

  type Tolov = { id: number; sana: string; davr: string; summa: number; usul: PaymentMethod | null; tasdiqlangan: boolean; bekor: boolean }
  const tList = (tolovlar ?? []) as unknown as Tolov[]

  const darsList = (darslar ?? []) as KeyingiDars[]

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom={oquvchi.fish}
        izoh={`${oquvchi.id} · ${sana(bugun)}`}
        amal={oquvchi.holat === 'faol' ? <Badge ton="ok">Faol</Badge> : <Badge ton="accent">{oquvchi.holat}</Badge>}
      />

      <Xabar ok={xabar.ok} xato={xabar.xato === 'huquq' ? 'Bu bo‘lim sizga ochiq emas.' : xabar.xato} />

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <Stat
          label="Qarzim"
          value={jamiQarz}
          sub="so‘m"
          ton={jamiQarz > 0 ? 'brand' : 'ok'}
          border={jamiQarz > 0 ? 'brand' : undefined}
        />
        <Stat
          label="Woblarim"
          value={w ? Number(w.balans) : 0}
          sub={w ? `jami ${Number(w.jami_ball)} woblar olingan` : 'hali woblar yo‘q'}
          ton="accent"
        />
        <Stat
          label={`Davomat · ${davrNomi(davr)}`}
          value={shuOyFoiz === null ? '—' : `${shuOyFoiz}%`}
          sub={shuOyFoiz === null ? 'shu oyda belgilanmagan' : 'o‘rtacha'}
          ton={shuOyFoiz !== null && shuOyFoiz >= 80 ? 'ok' : 'neytral'}
        />
        <Stat label="Guruhlarim" value={yList.length} sub="hozir o‘qiyapman" />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="flex flex-col">
          <CardHeader title="Guruhlarim" meta={`${yList.length} ta`} />
          <div className="flex flex-col gap-2.5 px-5 pb-4">
            {yList.length === 0 ? (
              <Empty>Hali guruhga biriktirilmagansiz.</Empty>
            ) : (
              yList.map((y) => (
                <div key={y.id} className="flex flex-wrap items-start justify-between gap-3 rounded-[10px] border border-line px-4 py-3">
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-[13.5px] font-semibold">{y.groups?.nom ?? '—'}</span>
                    <span className="text-[12px] text-ink-3">
                      {y.groups?.teachers?.ism ?? '[ANIQLANMAGAN]'} ·{' '}
                      {jadval(y.groups?.boshlanish ?? null, y.groups?.tugash ?? null, y.groups?.kun_turi ?? null)}
                    </span>
                    <span className="text-[12px] text-ink-3">{sana(y.boshlandi)} dan o‘qiyapman</span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="lbl">oyiga {pul(y.groups?.oylik_narx ?? 0)}</span>
                    <span
                      className={`tnum font-[family-name:var(--font-mono)] text-[13px] ${
                        (qarzMap.get(y.id) ?? 0) > 0 ? 'text-brand' : 'text-ok'
                      }`}
                    >
                      {(qarzMap.get(y.id) ?? 0) > 0 ? `qarz ${pul(qarzMap.get(y.id))}` : 'qarzi yo‘q'}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Keyingi darslarim" meta="8 tagacha" />
          <div className="flex flex-col px-5 pb-4">
            {darsList.length === 0 ? (
              <Empty>Yaqin kunlarda dars yo‘q. Guruhga biriktirilgach, jadval bo‘yicha darslar shu yerda ko‘rinadi.</Empty>
            ) : (
              darsList.map((d) => (
                <div key={`${d.group_id}-${d.sana}`} className="flex items-center justify-between gap-3 border-b border-line-soft py-2.5 last:border-0">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[12.5px]">{guruhNomi.get(d.group_id) ?? d.nom}</span>
                    <span className="text-[11.5px] text-ink-3">{vaqt(d.boshlanish)}–{vaqt(d.tugash)}</span>
                  </span>
                  <span className={`shrink-0 font-[family-name:var(--font-mono)] text-[12px] ${d.sana === bugun ? 'text-brand' : 'text-ink-3'}`}>
                    {d.sana === bugun ? 'bugun' : sana(d.sana)}
                  </span>
                </div>
              ))
            )}
            <Link href="/crm/woblr" className="mt-2 text-[12.5px] text-accent hover:text-brand">
              Woblar reytingini ko‘rish →
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader title="To‘lovlarim" meta="oxirgi 8 ta" />
          <div className="flex flex-col px-5 pb-4">
            {tList.length === 0 ? (
              <Empty>Hali to‘lov yozilmagan.</Empty>
            ) : (
              tList.map((t) => (
                <div key={t.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-soft py-2.5 last:border-0">
                  <span className="tnum font-[family-name:var(--font-mono)] text-[11.5px] text-ink-3">{sana(t.sana)}</span>
                  <span className="truncate text-[12.5px]">
                    {davrNomi(t.davr)} uchun{t.usul ? ` · ${USUL_NOMI[t.usul]}` : ''}
                    {t.bekor ? ' · bekor qilingan' : t.tasdiqlangan ? '' : ' · tasdiq kutilmoqda'}
                  </span>
                  <span className={`tnum font-[family-name:var(--font-mono)] text-[13px] ${t.bekor ? 'text-ink-4 line-through' : t.tasdiqlangan ? 'text-ok' : 'text-accent'}`}>
                    {pul(t.summa)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Davomatim" meta="oxirgi oylar" />
          <div className="flex flex-col gap-2 px-5 pb-4">
            {dList.length === 0 ? (
              <Empty>Hali davomat belgilanmagan.</Empty>
            ) : (
              dList.map((d) => (
                <div key={`${d.davr}-${d.group_id}`} className="flex items-center justify-between gap-3 border-b border-line-soft py-2 last:border-0">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[12.5px]">{davrNomi(d.davr)}</span>
                    <span className="truncate text-[11px] text-ink-3">{guruhNomi.get(d.group_id) ?? d.group_id}</span>
                  </span>
                  <span className="flex items-center gap-2.5">
                    <span className="text-[11.5px] text-ink-3">{d.kelgan} / {d.darslar} dars</span>
                    <Badge ton={d.foiz >= 80 ? 'ok' : d.foiz >= 60 ? 'accent' : 'brand'}>{d.foiz}%</Badge>
                  </span>
                </div>
              ))
            )}
            <p className="lbl pt-1">
              {DAVOMAT_NOMI.keldi} va {DAVOMAT_NOMI.kechikdi} — kelgan deb sanaladi
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { talabRol, staffmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, Stat, BarRow, Empty } from '@/components/ui'
import { AreaGrafik } from '@/components/grafik'
import { IconAlert, IconPayments, IconAttendance, IconLeads, IconStudents, IconDebt, IconWoblr, IconPhone, IconChevronDown } from '@/components/icons'
import { pul, davrNomi, joriyDavr, sana, bugunToshkent, telefon } from '@/lib/format'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Ulanmagan } from '@/components/crm'
import type { DashboardStats, Qarzdor, TeacherStats, Hisobot } from '@/lib/types'
import { QaytishKutilmoqda, type Tanaffusdagi } from './qaytish'

export const metadata = { title: 'Boshqaruv paneli' }
export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const profil = await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Boshqaruv paneli" />
  const supabase = await createClient()
  const davr = joriyDavr()
  const bugun = bugunToshkent()
  const xodim = staffmi(profil.rol)

  const ertagaBoshi = `${new Date(Date.parse(`${bugun}T00:00:00Z`) + 86400_000).toISOString().slice(0, 10)}T00:00:00+05:00`
  const [{ data: stats }, { data: qarzdorlar }, { data: ustozlar }, { data: oylik }, { data: kunlik }, { count: probniyBugun }, { data: tanaffus, count: tanaffusSoni }, { data: bugungiVazifalar, count: vazifaSoni }, { count: kechikkanLid }] =
    await Promise.all([
      supabase.from('v_dashboard').select('*').single(),
      supabase.from('v_qarzdorlar').select('*').limit(6),
      supabase.from('v_teacher_stats').select('*').order('tushum', { ascending: false }),
      // Tushum dinamikasi — kelasi oylarsiz (joriygacha), oxirgi 6 oy.
      // Kamayish tartibida: o'sish tartibida limit ENG ESKI oylarni qaytarardi.
      supabase.from('v_monthly_income').select('davr, tushum').lte('davr', davr).order('davr', { ascending: false }).limit(6),
      // Botdagi "Bugun" / "Kunlik hisobot" — bitta so'rov, hisob bazada
      xodim ? supabase.rpc('tushum_hisobot', { p_dan: bugun, p_gacha: bugun }) : Promise.resolve({ data: null }),
      xodim
        ? supabase.from('leads').select('id', { count: 'exact', head: true }).eq('sinov_sana', bugun).eq('holat', 'yangi')
        : Promise.resolve({ count: 0 }),
      // Tanaffusdagilar — qaytish sanasi yaqinlari birinchi (0046)
      supabase
        .from('students')
        .select('id, fish, qaytish_sana, tanaffus_sabab, ota_tel, ona_tel, shaxsiy_tel', { count: 'exact' })
        .eq('holat', 'tanaffus')
        .order('qaytish_sana', { ascending: true, nullsFirst: false })
        .limit(6),
      // 0059 — bugungi va kechikkan vazifalar (eng eskisi birinchi)
      xodim
        ? supabase
            .from('crm_vazifalar')
            .select('id, nom, muddat, turi, leads(ism, telefon), students(fish, shaxsiy_tel, ota_tel)', { count: 'exact' })
            .in('holat', ['yangi', 'jarayonda'])
            .lt('muddat', ertagaBoshi)
            .order('muddat')
            .limit(6)
        : Promise.resolve({ data: [], count: 0 }),
      xodim
        ? supabase.from('leads').select('id', { count: 'exact', head: true }).is('student_id', null).in('holat', ['yangi', 'qongiroq', 'keldi']).lt('keyingi_aloqa', `${bugun}T00:00:00+05:00`)
        : Promise.resolve({ count: 0 }),
    ])
  const k = kunlik as Hisobot | null

  const s = (stats ?? null) as DashboardStats | null
  const qList = (qarzdorlar ?? []) as Qarzdor[]
  const uList = (ustozlar ?? []) as TeacherStats[]
  const maxTushum = Math.max(1, ...uList.map((u) => Number(u.tushum)))
  const jamiTushum = uList.reduce((a, u) => a + Number(u.tushum), 0)

  // Tushum grafigi uchun — oxirgi 6 oy, qisqa oy nomi bilan
  const OY_QISQA = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']
  // Bazadan yangidan eskiga keladi — grafik chapdan o'ngga eskidan yangiga
  const oylikList = [...((oylik ?? []) as { davr: string; tushum: number }[])].reverse()
  const grafik = oylikList.map((o) => ({
    label: OY_QISQA[Number(o.davr.slice(5, 7)) - 1] ?? o.davr.slice(5),
    value: Number(o.tushum),
  }))

  return (
    <div className="flex flex-col gap-4 px-6 py-5 lg:px-7">
      <header className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="h-display text-[25px]">Boshqaruv paneli</h1>
          <p className="lbl">
            {sana(new Date())} · {davrNomi(davr)}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="flex h-10 items-center rounded-[9px] border border-line bg-surface px-3 font-[family-name:var(--font-mono)] text-[12.5px]">
            {davr}
          </span>
        </div>
      </header>

      {xodim && (
        <EtiborPanel
          bandlar={[
            { href: '/crm/qarzdorlar', son: s?.qarzdorlar ?? 0, matn: 'qarzdor o‘quvchi', Icon: IconDebt },
            { href: '/crm/vazifalar', son: vazifaSoni ?? 0, matn: 'bugungi vazifa', Icon: IconAlert },
            { href: '/crm/lidlar?tez=kechikkan', son: kechikkanLid ?? 0, matn: 'lid aloqasi kechikdi', Icon: IconLeads },
            { href: '/crm/hisobotlar?tur=bugun', son: k?.darslar.qilinmagan ?? 0, matn: 'dars davomatsiz', Icon: IconAttendance },
          ]}
        />
      )}

      {staffmi(profil.rol) && s && s.tasdiqlanmagan_soni > 0 && (
        <Link
          href="/crm/tolovlar?filtr=tasdiqlanmagan"
          className="flex items-center gap-3.5 rounded-[11px] border border-brand bg-brand-soft px-4 py-3 transition hover:brightness-125"
        >
          <span className="shrink-0 text-brand">
            <IconAlert size={19} />
          </span>
          <span className="flex-1 text-[13.5px]">
            <b>{s.tasdiqlanmagan_soni} ta to‘lov tasdiqlanmagan</b>
            <span className="text-ink-2">
              {' '}
              — {pul(s.tasdiqlanmagan_summa)} so‘m. Tasdiqlanmaguncha hisobotga kirmaydi.
            </span>
          </span>
          <span className="shrink-0 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold">
            Ko‘rib chiqish
          </span>
        </Link>
      )}

      {xodim && k && (
        <section className="flex flex-col gap-2">
          <h2 className="lbl">Bugun · {sana(bugun)}</h2>
          <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
            <Stat label="Bugungi tushum" value={Number(k.tushum)} sub={`${k.soni} ta to‘lov`} ton="ok" Icon={IconPayments} />
            <Link href="/crm/hisobotlar?tur=bugun" className="contents">
              <Stat
                label="Davomat qo‘yilmagan"
                value={k.darslar.qilinmagan}
                sub={`${k.darslar.kutilgan} ta darsdan`}
                ton={k.darslar.qilinmagan > 0 ? 'brand' : 'ok'}
                Icon={IconAttendance}
              />
            </Link>
            <Link href="/crm/probniylar" className="contents">
              <Stat label="Bugun sinov darsi" value={probniyBugun ?? 0} sub="probniy kutilmoqda" ton="accent" Icon={IconLeads} />
            </Link>
            <Stat
              label="Bugungi davomat"
              value={k.davomat.belgilar ? `${Math.round((k.davomat.kelgan * 100) / k.davomat.belgilar)}%` : '—'}
              sub={`${k.davomat.kelgan} keldi · ${k.davomat.kelmadi} kelmadi`}
              Icon={IconStudents}
            />
          </div>
        </section>
      )}

      {(tanaffusSoni ?? 0) > 0 && (
        <QaytishKutilmoqda royxat={(tanaffus ?? []) as Tanaffusdagi[]} jami={tanaffusSoni ?? 0} bugun={bugun} />
      )}

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <Stat
          label={`${davrNomi(davr)} tushumi`}
          value={s?.joriy_oy_tushumi ?? 0}
          sub={`${s?.joriy_oy_tolovlari ?? 0} ta to‘lov · so‘m`}
          ton="ok"
          Icon={IconPayments}
        />
        <Stat
          label="Jami qarz"
          value={s?.jami_qarz ?? 0}
          sub={`${s?.qarzdorlar ?? 0} qarzdor · so‘m`}
          ton="brand"
          border="brand"
          Icon={IconDebt}
        />
        <Stat
          label="Faol o‘quvchilar"
          value={s?.oquvchilar ?? 0}
          sub={`fan bo‘yicha ${s?.fan_boyicha ?? 0} · ${s?.guruhlar ?? 0} guruh · ${s?.ustozlar ?? 0} ustoz`}
          Icon={IconStudents}
        />
        <Stat
          label="Berilgan chegirma"
          value={s?.chegirma ?? 0}
          sub="shu oy · so‘m"
          ton="accent"
          Icon={IconWoblr}
        />
      </div>

      {xodim && grafik.length > 0 && (
        <Card className="flex flex-col">
          <CardHeader title="Tushum dinamikasi" meta="oxirgi oylar · so‘m" />
          <div className="px-5 pb-4 pt-1">
            <AreaGrafik nuqtalar={grafik} />
          </div>
        </Card>
      )}

      {xodim && <BugungiIshlar royxat={(bugungiVazifalar ?? []) as unknown as BugungiVazifa[]} jami={vazifaSoni ?? 0} />}

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="flex flex-col">
          <CardHeader title="O‘qituvchi bo‘yicha tushum" meta={`${davrNomi(davr)} · so‘m`} />
          <div className="flex flex-col px-5 pb-4">
            {uList.length === 0 ? (
              <Empty>Hali to‘lov yozilmagan.</Empty>
            ) : (
              uList.map((u) => (
                <BarRow
                  key={u.teacher_id}
                  label={u.ism}
                  value={Number(u.tushum)}
                  max={maxTushum}
                />
              ))
            )}
            {uList.length > 0 && (
              <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
                <span className="text-xs text-ink-3">Jami</span>
                <span className="tnum font-[family-name:var(--font-mono)] text-[12.5px]">
                  {pul(jamiTushum)} so‘m
                </span>
              </div>
            )}
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader
            title="Qarzdorlar — eng kattadan"
            action={
              <Link href="/crm/qarzdorlar" className="text-xs text-accent hover:text-brand">
                hammasi →
              </Link>
            }
          />
          <div className="flex flex-col px-5 pb-4">
            {qList.length === 0 ? (
              <Empty>Qarzdor yo‘q. Bu — yaxshi xabar.</Empty>
            ) : (
              qList.map((q) => (
                <Link
                  key={q.student_id}
                  href={`/crm/oquvchilar/${q.student_id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line-soft py-2.5 last:border-0 hover:bg-surface-2"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[13px] font-semibold">{q.fish}</span>
                    <span className="truncate font-[family-name:var(--font-mono)] text-[10.5px] text-ink-3">
                      {q.guruhlar ?? '—'}
                    </span>
                  </span>
                  <span className="tnum font-[family-name:var(--font-mono)] text-[12.5px] text-brand">
                    {pul(q.qarz)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

type BugungiVazifa = {
  id: string
  nom: string
  muddat: string
  leads: { ism: string; telefon: string } | null
  students: { fish: string; shaxsiy_tel: string | null; ota_tel: string | null } | null
}

type IkonKomp = (p: { size?: number; className?: string }) => React.ReactElement

/** "E'tibor talab qiladi" — LeaderCRM'dagi kabi: bir qatorda nima kutib turgani. */
function EtiborPanel({ bandlar }: { bandlar: { href: string; son: number; matn: string; Icon: IkonKomp }[] }) {
  const jami = bandlar.reduce((a, b) => a + b.son, 0)
  return (
    <section
      aria-label="E‘tibor talab qiladi"
      className={`grid grid-cols-2 gap-2 rounded-[12px] border p-2 xl:grid-cols-[auto_repeat(4,minmax(0,1fr))] ${
        jami ? 'border-accent-line bg-accent-soft/60' : 'border-ok bg-ok-soft/50'
      }`}
    >
      <div className="col-span-2 flex items-center gap-3 px-3 py-2 xl:col-span-1">
        <span className={`flex size-10 items-center justify-center rounded-[10px] ${jami ? 'bg-surface text-accent' : 'bg-surface text-ok'}`}>
          <IconAlert size={19} />
        </span>
        <span className="flex flex-col">
          <b className="text-[14px]">{jami ? 'E‘tibor talab qiladi' : 'Hammasi joyida'}</b>
          <span className="text-[12px] text-ink-3">{jami ? 'Bugun hal qilish kerak' : 'Kutib turgan ish yo‘q'}</span>
        </span>
      </div>
      {bandlar.map((b) => (
        <Link
          key={b.href}
          href={b.href}
          className="flex min-w-0 items-center gap-2.5 rounded-[10px] border border-line bg-surface px-2.5 py-2.5 transition hover:border-ink-3 sm:gap-3 sm:px-3"
        >
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-[9px] ${b.son ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-ink-3'}`}>
            <b.Icon size={16} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="tnum text-[15px]">{b.son} ta</b>
            <span className="truncate text-[12px] text-ink-3">{b.matn}</span>
          </span>
          <IconChevronDown size={14} className="-rotate-90 text-ink-4 max-sm:hidden" />
        </Link>
      ))}
    </section>
  )
}

/** Bugungi va kechikkan vazifalar — telefon tugmasi bilan (0059). */
function BugungiIshlar({ royxat, jami }: { royxat: BugungiVazifa[]; jami: number }) {
  const hozir = new Date().toISOString()
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Bugungi ishlar"
        meta={`${jami} ta vazifa`}
        action={
          <Link href="/crm/vazifalar" className="text-xs text-accent hover:text-brand">
            hammasi →
          </Link>
        }
      />
      <div className="flex flex-col px-5 pb-4">
        {royxat.length === 0 ? (
          <Empty>Bugunga vazifa yo‘q. Lidga aloqa sanasi qo‘yilsa yoki qarzdorga eslatma yozilsa, shu yerda chiqadi.</Empty>
        ) : (
          royxat.map((v) => {
            const kim = v.leads?.ism ?? v.students?.fish
            const tel = v.leads?.telefon ?? v.students?.shaxsiy_tel ?? v.students?.ota_tel
            const kechikdi = v.muddat < hozir
            const soat = new Date(Date.parse(v.muddat) + 5 * 3600_000).toISOString().slice(11, 16)
            return (
              <div key={v.id} className="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-0">
                <span className={`block size-2 shrink-0 rounded-full ${kechikdi ? 'bg-brand' : 'bg-accent'}`} />
                <Link href="/crm/vazifalar" className="flex min-w-0 flex-1 flex-col gap-0.5 hover:underline">
                  <span className="truncate text-[13px] font-semibold">{v.nom}</span>
                  <span className="truncate text-[11.5px] text-ink-3">
                    {kechikdi ? 'Kechikdi · ' : ''}
                    {soat}
                    {kim ? ` · ${kim}` : ''}
                  </span>
                </Link>
                {tel && (
                  <a
                    href={`tel:${tel}`}
                    title={telefon(tel)}
                    aria-label={`Qo‘ng‘iroq: ${telefon(tel)}`}
                    className="flex size-11 items-center justify-center rounded-lg border border-line text-ink-2 hover:text-ink"
                  >
                    <IconPhone size={15} />
                  </a>
                )}
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}

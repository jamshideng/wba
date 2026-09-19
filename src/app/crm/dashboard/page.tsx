import Link from 'next/link'
import { talabRol, staffmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, Stat, BarRow, Empty } from '@/components/ui'
import { AreaGrafik } from '@/components/grafik'
import { IconAlert, IconSearch } from '@/components/icons'
import { pul, davrNomi, joriyDavr, sana, bugunToshkent } from '@/lib/format'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Ulanmagan } from '@/components/crm'
import type { DashboardStats, Qarzdor, TeacherStats, Hisobot } from '@/lib/types'

export const metadata = { title: 'Boshqaruv paneli' }
export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const profil = await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Boshqaruv paneli" />
  const supabase = await createClient()
  const davr = joriyDavr()
  const bugun = bugunToshkent()
  const xodim = staffmi(profil.rol)

  const [{ data: stats }, { data: qarzdorlar }, { data: ustozlar }, { data: oylik }, { data: kunlik }, { count: probniyBugun }] =
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
          {xodim && (
            <form action="/crm/oquvchilar" className="flex h-11 w-64 items-center gap-2.5 rounded-[9px] border border-line bg-surface px-3 max-sm:w-full">
              <IconSearch size={15} />
              <input name="q" placeholder="Ism, ID yoki telefon…" className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-4" />
            </form>
          )}
          <span className="flex h-10 items-center rounded-[9px] border border-line bg-surface px-3 font-[family-name:var(--font-mono)] text-[12.5px]">
            {davr}
          </span>
        </div>
      </header>

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
            <Stat label="Bugungi tushum" value={Number(k.tushum)} sub={`${k.soni} ta to‘lov`} />
            <Link href="/crm/hisobotlar?tur=bugun" className="contents">
              <Stat
                label="Davomat qo‘yilmagan"
                value={k.darslar.qilinmagan}
                sub={`${k.darslar.kutilgan} ta darsdan`}
                ton={k.darslar.qilinmagan > 0 ? 'brand' : 'ok'}
              />
            </Link>
            <Link href="/crm/probniylar" className="contents">
              <Stat label="Bugun sinov darsi" value={probniyBugun ?? 0} sub="probniy kutilmoqda" ton="accent" />
            </Link>
            <Stat
              label="Bugungi davomat"
              value={k.davomat.belgilar ? `${Math.round((k.davomat.kelgan * 100) / k.davomat.belgilar)}%` : '—'}
              sub={`${k.davomat.kelgan} keldi · ${k.davomat.kelmadi} kelmadi`}
            />
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <Stat
          label={`${davrNomi(davr)} tushumi`}
          value={s?.joriy_oy_tushumi ?? 0}
          sub={`${s?.joriy_oy_tolovlari ?? 0} ta to‘lov · so‘m`}
        />
        <Stat
          label="Jami qarz"
          value={s?.jami_qarz ?? 0}
          sub={`${s?.qarzdorlar ?? 0} qarzdor · so‘m`}
          ton="brand"
          border="brand"
        />
        <Stat
          label="Faol o‘quvchilar"
          value={s?.oquvchilar ?? 0}
          sub={`${s?.guruhlar ?? 0} guruh · ${s?.ustozlar ?? 0} ustoz`}
        />
        <Stat
          label="Berilgan chegirma"
          value={s?.chegirma ?? 0}
          sub="shu oy · so‘m"
          ton="accent"
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

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
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

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconArrowLeft } from '@/components/icons'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { loginNomi } from '@/lib/login'
import { telefon } from '@/lib/format'
import { Card, CardHeader, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { farzandBiriktir, farzandUzish } from '../actions'
import { OtaOnaTahrir } from './tahrir'
import { FarzandTanlash } from '@/components/farzand-tanlash'

export const metadata = { title: 'Ota-ona' }
export const dynamic = 'force-dynamic'

/** Bitta ota-ona: farzandlari, biriktirish va uzish (0116). */
export default async function OtaOna({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  await talabRol('admin', 'direktor', 'manager')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Ota-ona" />

  const [{ id }, s] = await Promise.all([params, searchParams])
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createClient()
  const [{ data: o }, { data: bolalarXom }, { data: boshlarXom }] = await Promise.all([
    supabase.from('profiles').select('id, ism, email, telefon, holat, rol').eq('id', id).maybeSingle(),
    supabase.from('students').select('id, fish, holat').eq('ota_ona_id', id).order('fish'),
    // Biriktirish uchun: hali ota-onasi yo'q o'quvchilar
    supabase.from('students').select('id, fish').is('ota_ona_id', null).neq('holat', 'ketgan').order('fish'),
  ])
  // 0117 — sinov darsidagi bolalar: shu ota-onaniki va biriktirish uchun bo'shlari
  const [{ data: lidlarXom }, { data: bushLidXom }] = await Promise.all([
    supabase.from('leads').select('id, ism, holat').eq('ota_ona_id', id).is('student_id', null).order('ism'),
    supabase.from('leads').select('id, ism').is('ota_ona_id', null).is('student_id', null).not('holat', 'in', '(xato,rad)').order('ism'),
  ])
  const lidlar = (lidlarXom ?? []) as { id: string; ism: string; holat: string }[]
  const bushLidlar = (bushLidXom ?? []) as { id: string; ism: string }[]
  if (!o || o.rol !== 'ota_ona') notFound()
  const bolalar = (bolalarXom ?? []) as { id: string; fish: string; holat: string }[]
  const boshlar = (boshlarXom ?? []) as { id: string; fish: string }[]
  const yol = `/crm/ota-onalar/${id}`
  // Ota-ona farzandsiz qolmaydi: oxirgi farzandni uzish tugmasi yo'q (bazada ham taqiq, 0117)
  const yagona = bolalar.length + lidlar.length <= 1

  return (
    <div className="flex max-w-3xl flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href="/crm/ota-onalar" className="inline-flex min-h-11 items-center gap-1.5 self-start text-[13px] text-ink-3 hover:text-ink">
        <IconArrowLeft size={16} /> Ota-onalar
      </Link>
      <Sarlavha
        nom={o.ism}
        izoh={[loginNomi(o.email), o.telefon ? telefon(o.telefon) : null].filter(Boolean).join(' · ')}
        amal={
          <span className="flex items-center gap-2">
            {o.holat === 'faol' ? <Badge ton="ok">Faol</Badge> : <Badge ton="jim">{o.holat}</Badge>}
            <OtaOnaTahrir
              id={id}
              ism={o.ism.split(' ')[0] ?? ''}
              familiya={o.ism.split(' ').slice(1).join(' ')}
              telefon={o.telefon ? telefon(o.telefon) : ''}
              login={loginNomi(o.email)}
            />
          </span>
        }
      />
      <Xabar ok={s.ok} xato={s.xato} />

      <Card className="flex flex-col">
        <CardHeader title="Farzandlari" meta={`${bolalar.length + lidlar.length} ta`} />
        {bolalar.length + lidlar.length === 0 ? (
          <div className="px-5 pb-5">
            <Empty>Hali farzand biriktirilmagan.</Empty>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            {bolalar.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5">
                <Link href={`/crm/oquvchilar/${b.id}`} className="flex min-h-11 flex-col justify-center hover:text-brand">
                  <span className="text-[13.5px] font-semibold">{b.fish}</span>
                  <span className="text-[12px] text-ink-3">
                    {b.id}
                    {b.holat !== 'faol' ? ` · ${b.holat}` : ''}
                  </span>
                </Link>
                {yagona ? (
                  <span className="text-[12px] text-ink-3">oxirgi farzand</span>
                ) : (
                <form action={farzandUzish}>
                  <input type="hidden" name="student" value={b.id} />
                  <input type="hidden" name="qaytish" value={yol} />
                  <Yuborish tur="ikkilamchi" kutish="…">Uzish</Yuborish>
                </form>
                )}
              </li>
            ))}
            {lidlar.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5">
                <Link href={`/crm/lidlar?b=lid:${l.id}`} className="flex min-h-11 flex-col justify-center hover:text-brand">
                  <span className="text-[13.5px] font-semibold">{l.ism}</span>
                  <span className="text-[12px] text-ink-3">sinov darsida</span>
                </Link>
                {yagona ? (
                  <span className="text-[12px] text-ink-3">oxirgi farzand</span>
                ) : (
                <form action={farzandUzish}>
                  <input type="hidden" name="lid" value={l.id} />
                  <input type="hidden" name="qaytish" value={yol} />
                  <Yuborish tur="ikkilamchi" kutish="…">Uzish</Yuborish>
                </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col">
        <CardHeader title="Farzand biriktirish" />
        <form action={farzandBiriktir} className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-end">
          <input type="hidden" name="ota_ona" value={id} />
          <input type="hidden" name="qaytish" value={yol} />
          <Maydon nom="Farzand" izoh="O‘quvchi yoki sinov darsidagi bola. Faqat ota-onasi biriktirilmaganlar chiqadi." className="flex-1">
            <FarzandTanlash oquvchilar={boshlar} sinovdagilar={bushLidlar} />
          </Maydon>
          <Yuborish>Biriktirish</Yuborish>
        </form>
      </Card>
    </div>
  )
}

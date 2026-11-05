import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { talabProfil, adminmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Empty, Badge } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { IconArrowLeft } from '@/components/icons'
import { pul, davrNomi, joriyDavr } from '@/lib/format'
import type { MaoshTur, MaoshDoimiy } from '@/lib/types'
import { stavkaSaqla } from '../../actions'
import { doimiySaqla, doimiyOchir } from '../actions'

export const metadata = { title: 'Ustoz maosh sozlamasi' }
export const dynamic = 'force-dynamic'

/** Bitta ustoz: stavka va doimiy summalar (soliq va h.k.) — Jamshid o'zi kiritadi. */
export default async function UstozSozlamasi({
  params,
  searchParams,
}: {
  params: Promise<{ ustoz: string }>
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  const profil = await talabProfil()
  if (!adminmi(profil.rol)) redirect('/crm/maosh/men')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Maosh sozlamalari" />
  const [{ ustoz }, s] = await Promise.all([params, searchParams])
  const yol = `/crm/maosh/sozlamalar/${ustoz}`

  const supabase = await createClient()
  const [{ data: u }, { data: st }, { data: turXom }, { data: dXom }] = await Promise.all([
    supabase.from('teachers').select('id, ism').eq('id', ustoz).maybeSingle(),
    supabase.from('teacher_salaries').select('qiymati').eq('teacher_id', ustoz).maybeSingle(),
    supabase.from('maosh_turlar').select('id, nom, ishora, faol').order('id'),
    supabase.from('maosh_doimiy').select('id, teacher_id, tur_id, summa, dan, gacha').eq('teacher_id', ustoz).order('id'),
  ])
  if (!u) notFound()

  const turlar = (turXom ?? []) as MaoshTur[]
  const turi = new Map(turlar.map((t) => [t.id, t]))
  const doimiy = (dXom ?? []) as MaoshDoimiy[]
  const band = new Set(doimiy.map((d) => d.tur_id))
  const boshTurlar = turlar.filter((t) => t.faol && !band.has(t.id))
  const joriy = joriyDavr()

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href="/crm/maosh/sozlamalar" className="flex items-center gap-2 text-[13px] text-ink-3 transition hover:text-ink">
        <IconArrowLeft size={15} />
        Maosh sozlamalari
      </Link>
      <Sarlavha nom={u.ism} izoh="Maosh sozlamasi" />
      <Xabar ok={s.ok} xato={s.xato} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader title="Stavka" meta="umumiy guruhlar" />
          <form action={stavkaSaqla} className="flex flex-wrap items-end gap-2 px-5 pb-5">
            <input type="hidden" name="teacher_id" value={u.id} />
            <input type="hidden" name="qaytish" value={yol} />
            <Maydon nom="Bitta o‘quvchi uchun (oyiga)" izoh="Bo‘sh qoldirilsa — maosh hisoblanmaydi" className="flex-1">
              <input name="qiymati" inputMode="numeric" defaultValue={st?.qiymati ?? ''} placeholder="Masalan: 220000" className={kirishKlass} />
            </Maydon>
            <Yuborish kutish="…">Saqlash</Yuborish>
          </form>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Doimiy summalar" meta="soliq va h.k." />
          {doimiy.length === 0 ? (
            <div className="px-5 pb-4">
              <Empty>Hali yo‘q. Pastdan qo‘shing.</Empty>
            </div>
          ) : (
            <ul className="flex flex-col">
              {doimiy.map((d) => {
                const t = turi.get(d.tur_id)
                const amalda = !!t?.faol && d.dan <= joriy && (!d.gacha || d.gacha >= joriy)
                return (
                  <li key={d.id} className="flex flex-col gap-2.5 border-t border-line-soft px-5 py-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                        {t?.nom ?? '—'}
                        {!t?.faol ? <Badge>tur o‘chirilgan</Badge> : amalda ? <Badge ton="ok">amalda</Badge> : <Badge>bu oyda emas</Badge>}
                      </span>
                      <span className={`tnum font-[family-name:var(--font-mono)] text-[14px] font-semibold ${t && t.ishora < 0 ? 'text-brand' : 'text-ok'}`}>
                        {t && t.ishora < 0 ? '−' : '+'}
                        {pul(d.summa)}
                      </span>
                    </div>
                    <span className="text-[12px] text-ink-3">
                      {davrNomi(d.dan)} dan{d.gacha ? ` · ${davrNomi(d.gacha)} gacha` : ' · muddatsiz'}
                    </span>
                    <details>
                      <summary className="cursor-pointer text-[12px] text-ink-3 hover:text-ink">O‘zgartirish</summary>
                      <form action={doimiySaqla} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <input type="hidden" name="teacher_id" value={u.id} />
                        <input type="hidden" name="tur_id" value={d.tur_id} />
                        <input type="hidden" name="qaytish" value={yol} />
                        <Maydon nom="Summa">
                          <input name="summa" required inputMode="numeric" defaultValue={d.summa} className={kirishKlass} />
                        </Maydon>
                        <Maydon nom="Qaysi oydan">
                          <input name="dan" type="month" required defaultValue={d.dan} className={kirishKlass} />
                        </Maydon>
                        <Maydon nom="Qaysi oygacha" izoh="Bo‘sh — muddatsiz">
                          <input name="gacha" type="month" defaultValue={d.gacha ?? ''} className={kirishKlass} />
                        </Maydon>
                        <div className="sm:col-span-3">
                          <Yuborish kutish="…">Saqlash</Yuborish>
                        </div>
                      </form>
                      <form action={doimiyOchir} className="mt-2">
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="qaytish" value={yol} />
                        <Yuborish tur="xavfli" kutish="…">
                          Olib tashlash
                        </Yuborish>
                      </form>
                    </details>
                  </li>
                )
              })}
            </ul>
          )}

          {boshTurlar.length > 0 ? (
            <form action={doimiySaqla} className="grid grid-cols-1 gap-3 border-t border-line-soft px-5 py-4 sm:grid-cols-2">
              <input type="hidden" name="teacher_id" value={u.id} />
              <input type="hidden" name="qaytish" value={yol} />
              <Maydon nom="Tur">
                <select name="tur_id" required defaultValue={boshTurlar[0].id} className={kirishKlass}>
                  {boshTurlar.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nom} ({t.ishora < 0 ? 'ayiriladi' : 'qo‘shiladi'})
                    </option>
                  ))}
                </select>
              </Maydon>
              <Maydon nom="Summa (oyiga)">
                <input name="summa" required inputMode="numeric" placeholder="Masalan: 300000" className={kirishKlass} />
              </Maydon>
              <Maydon nom="Qaysi oydan">
                <input name="dan" type="month" required defaultValue={joriy} className={kirishKlass} />
              </Maydon>
              <Maydon nom="Qaysi oygacha" izoh="Bo‘sh — muddatsiz">
                <input name="gacha" type="month" className={kirishKlass} />
              </Maydon>
              <div className="sm:col-span-2">
                <Yuborish kutish="Qo‘shilmoqda…">Qo‘shish</Yuborish>
              </div>
            </form>
          ) : (
            <p className="border-t border-line-soft px-5 py-4 text-[12px] text-ink-3">
              {turlar.length === 0 ? 'Avval ' : 'Yangi tur uchun '}
              <Link href="/crm/maosh/sozlamalar" className="underline underline-offset-2 hover:text-ink">
                maosh sozlamalarida tur yarating
              </Link>{' '}
              (masalan “Soliq”).
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}

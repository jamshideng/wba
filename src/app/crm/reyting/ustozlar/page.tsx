import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Badge, Card, CardHeader, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { JonliForma } from '@/components/jonli-forma'
import { IconArrowLeft } from '@/components/icons'
import { xatoMatni } from '@/lib/kiritish'
import { ballTon, davrNomi, type ReytingDavr, type ReytingTur, type UstozReytingQatori, type UstozTarixQatori } from '@/lib/reyting'

export const metadata = { title: 'Ustozlar reytingi' }
export const dynamic = 'force-dynamic'

const son = (x: number | null | undefined) => (x == null ? '—' : String(Number(x)))

/**
 * Ustozlar reytingi (0140) — faqat rahbariyat (admin, direktor, manager).
 * Ustozlarga hozircha ochilmaydi. Har omil 0–100; tafsilotda nima hisobga
 * olingani (hodisalar, ketganlar) ko'rinadi.
 */
export default async function UstozlarReytingi({
  searchParams,
}: {
  searchParams: Promise<{ tur?: string; d?: string; u?: string; ok?: string; xato?: string }>
}) {
  await talabRol('admin', 'direktor', 'manager')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Ustozlar reytingi" />

  const s = await searchParams
  const tur: ReytingTur = s.tur === 'oylik' ? 'oylik' : 'haftalik'
  const oylik = tur === 'oylik'
  const supabase = await createClient()

  const { data: dXom } = await supabase.rpc('reyting_davrlari', { p_tur: tur })
  const davrlar = (dXom ?? []) as ReytingDavr[]
  const davr = davrlar.find((x) => String(x.id) === s.d) ?? davrlar[0] ?? null

  const { data, error } = davr ? await supabase.rpc('reyting_ustozlar', { p_davr: davr.id }) : { data: [], error: null }
  const qatorlar = (data ?? []) as UstozReytingQatori[]

  const tanlangan = qatorlar.find((q) => q.teacher_id === s.u) ?? null
  const { data: tXom } = tanlangan ? await supabase.rpc('reyting_ustoz_tarixi', { p_teacher: tanlangan.teacher_id }) : { data: [] }
  const tarix = (tXom ?? []) as UstozTarixQatori[]

  const th = 'lbl px-3 py-2 text-left font-normal whitespace-nowrap'
  const td = 'px-3 py-2.5 whitespace-nowrap'
  const havola = (u: string) => `/crm/reyting/ustozlar?tur=${tur}${davr ? `&d=${davr.id}` : ''}&u=${u}`

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href="/crm/reyting" className="inline-flex min-h-11 items-center gap-1.5 self-start text-[13px] text-ink-3 hover:text-ink">
        <IconArrowLeft size={16} /> O‘quvchilar reytingi
      </Link>
      <Sarlavha nom="Ustozlar reytingi" izoh={davr ? `${davrNomi(tur, davr.dan, davr.gacha)} · faqat rahbariyat` : 'faqat rahbariyat'} />
      <Xabar ok={s.ok} xato={s.xato ?? (error ? xatoMatni(error) : undefined)} />

      <JonliForma className="flex flex-wrap items-end gap-2.5">
        <Maydon nom="Davr turi">
          <select name="tur" defaultValue={tur} className={kirishKlass}>
            <option value="haftalik">Haftalik</option>
            <option value="oylik">Oylik</option>
          </select>
        </Maydon>
        {davrlar.length > 0 && (
          <Maydon nom={oylik ? 'Oy' : 'Hafta'}>
            <select name="d" defaultValue={davr ? String(davr.id) : ''} className={kirishKlass}>
              {davrlar.map((x) => <option key={x.id} value={x.id}>{davrNomi(tur, x.dan, x.gacha)}</option>)}
            </select>
          </Maydon>
        )}
      </JonliForma>

      {!davr ? (
        <Empty>Reyting hali hisoblanmagan. O‘quvchilar reytingi sahifasidan “Hisoblash” mumkin.</Empty>
      ) : qatorlar.length === 0 ? (
        <Empty>Bu davrda darsi bo‘lgan ustoz yo‘q (zamena darslari hisobga olinmaydi).</Empty>
      ) : (
        <Card className="flex flex-col overflow-hidden">
          <CardHeader
            title="Ustozlar"
            meta={oylik ? 'test · ushlab qolish · kechikish · intizom · guruh davomati' : 'kechikish · intizom · guruh davomati'}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-y border-line bg-surface-2/60">
                <tr>
                  <th className={th}>O‘rin</th>
                  <th className={th}>Ustoz</th>
                  <th className={th}>Ball</th>
                  {oylik && <th className={th}>Test</th>}
                  {oylik && <th className={th}>Ushlab qolish</th>}
                  <th className={th}>Kechikish</th>
                  <th className={th}>Intizom</th>
                  <th className={th}>Davomat</th>
                  <th className={th}>Darslar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {qatorlar.map((q) => (
                  <tr key={q.teacher_id} className={q.teacher_id === s.u ? 'bg-accent-soft/40' : ''}>
                    <td className={`${td} tnum font-bold`}>{q.orin ?? '—'}</td>
                    <td className={`${td} font-semibold`}>
                      <Link href={havola(q.teacher_id)} className="hover:text-brand">{q.ism}</Link>
                    </td>
                    <td className={td}><Badge ton={ballTon(q.umumiy)}>{son(q.umumiy)}</Badge></td>
                    {oylik && <td className={`${td} tnum`}>{son(q.test)}</td>}
                    {oylik && <td className={`${td} tnum`} title={`${son(q.ketish)} ketish / ${q.oquvchilar} o‘quvchi`}>{son(q.ushlash)}</td>}
                    <td className={`${td} tnum`} title={`${q.kechikish_daqiqa} daqiqa`}>{son(q.kechikish)}</td>
                    <td className={`${td} tnum`} title={`${q.hodisalar} hodisa`}>{son(q.intizom)}</td>
                    <td className={`${td} tnum`}>{son(q.davomat)}%</td>
                    <td className={`${td} tnum text-ink-3`}>{q.darslar} · {q.guruhlar} guruh</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line-soft px-5 py-2.5 text-[11.5px] text-ink-3">
            Ustoz nomini bosing — tafsilot va tarix. Zamena darslari hisobga olinmaydi; reyting pul jarimasiga ta’sir qilmaydi.
          </p>
        </Card>
      )}

      {tanlangan && (
        <Card className="flex flex-col">
          <CardHeader title={`${tanlangan.ism} — tafsilot`} />
          <div className="grid grid-cols-1 gap-4 px-5 pb-5 md:grid-cols-2">
            <ul className="flex flex-col gap-1.5 text-[13px] text-ink-2">
              <li>Kechikish: <b>{tanlangan.kechikish_daqiqa}</b> daqiqa, {tanlangan.darslar} dars</li>
              <li>Intizom hodisalari: <b>{tanlangan.hodisalar}</b></li>
              <li className="pl-3 text-[12.5px]">nazorat {tanlangan.tafsilot.nazorat} · ogohlantirish {tanlangan.tafsilot.ogohlantirish} · davomat kech {tanlangan.tafsilot.davomat_kech}</li>
              {oylik && (
                <li className="pl-3 text-[12.5px]">test o‘tkazilmagan guruh {tanlangan.tafsilot.test_yoq} · natija muddatidan kech {tanlangan.tafsilot.test_kech}</li>
              )}
              {oylik && (
                <li>
                  Ketganlar: <b>{son(tanlangan.ketish)}</b> / {tanlangan.oquvchilar} o‘quvchi
                  {tanlangan.tafsilot.ketganlar.length > 0 && (
                    <span className="block pl-3 text-[12.5px]">
                      {tanlangan.tafsilot.ketganlar.map((k) => (
                        <span key={`${k.student_id}-${k.group_id}`} className="mr-2 inline-block">
                          <Link href={`/crm/oquvchilar/${k.student_id}`} className="text-accent hover:text-brand">{k.student_id}</Link>
                          {' '}({k.sabab ?? 'sababsiz'}, {son(k.vazn)})
                        </span>
                      ))}
                    </span>
                  )}
                </li>
              )}
            </ul>
            <div className="flex flex-col gap-1.5">
              <span className="lbl">Tarix</span>
              {tarix.length === 0 ? (
                <span className="text-[12.5px] text-ink-3">—</span>
              ) : (
                <ul className="flex flex-col gap-1 text-[13px]">
                  {tarix.map((t) => (
                    <li key={t.davr_id} className="flex items-center gap-2">
                      <span className="w-28 shrink-0">{davrNomi(t.tur, t.dan, t.gacha)}</span>
                      <span className="text-ink-2"><b>{t.orin ?? '—'}</b>/{t.jami}</span>
                      <Badge ton={ballTon(t.umumiy)}>{son(t.umumiy)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

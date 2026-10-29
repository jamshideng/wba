import Link from 'next/link'
import { notFound } from 'next/navigation'
import { talabProfil, adminmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Badge, Button, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { IconArrowLeft } from '@/components/icons'
import { davrNomi, joriyDavr, guruhUstozsiz } from '@/lib/format'
import { davrOqi } from '@/lib/kiritish'
import { asosiy, foizTon, son, type OylikNatija, type OylikTest } from '@/lib/oylik-test'
import { testSaqla, natijalarSaqla, elonQil, bittaElon } from '../actions'
import { TestSozlamasi } from './test-sozlamasi'

export const metadata = { title: 'Oylik test — guruh' }
export const dynamic = 'force-dynamic'

/**
 * Bitta guruhning oylik testi: sozlama (turi, maks / bo'limlar) va
 * butun guruh natijasini bir formada kiritish. Admin shu yerda
 * guruhni yoki alohida o'quvchini e'lon qiladi.
 * Guruh topilmasa (RLS: begona guruh) — 404.
 */
export default async function GuruhTesti({
  params,
  searchParams,
}: {
  params: Promise<{ guruh: string }>
  searchParams: Promise<{ davr?: string; ok?: string; xato?: string }>
}) {
  const profil = await talabProfil()
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Oylik test" />

  const { guruh: gId } = await params
  const s = await searchParams
  const davr = davrOqi(s.davr ?? null) ?? joriyDavr()
  const admin = adminmi(profil.rol)
  const supabase = await createClient()

  const { data: g } = await supabase.from('groups').select('id, nom').eq('id', gId).maybeSingle()
  if (!g) notFound()

  const [y, m] = davr.split('-').map(Number)
  const boshi = `${davr}-01`
  const oxiri = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)

  const [{ data: tXom }, { data: yXom }] = await Promise.all([
    supabase.from('oylik_testlar').select('id, group_id, davr, sana, turi, maks, bolimlar, izoh').eq('group_id', gId).eq('davr', davr).maybeSingle(),
    supabase.from('enrollments').select('student_id, tugadi, students(fish)').eq('group_id', gId).lte('boshlandi', oxiri),
  ])
  const test = tXom as OylikTest | null

  const oquvchilar = [
    ...new Map(
      ((yXom ?? []) as unknown as { student_id: string; tugadi: string | null; students: { fish: string } | null }[])
        .filter((e) => !e.tugadi || e.tugadi >= boshi)
        .map((e) => [e.student_id, { id: e.student_id, fish: e.students?.fish ?? e.student_id }]),
    ).values(),
  ].sort((a, b) => a.fish.localeCompare(b.fish, 'uz'))

  const { data: nXom } = test
    ? await supabase.from('v_oylik_natijalar').select('*').eq('test_id', test.id)
    : { data: [] }
  const natija = new Map(((nXom ?? []) as OylikNatija[]).map((n) => [n.student_id, n]))
  const elonSoni = [...natija.values()].filter((n) => n.elon_qilingan).length
  const qulf = !admin && elonSoni > 0
  const yol = `/crm/oylik-test/${gId}?davr=${davr}`
  const guruhNomi = admin ? g.nom : guruhUstozsiz(g.nom)

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href={`/crm/oylik-test?davr=${davr}`} className="inline-flex min-h-11 items-center gap-1.5 self-start text-[13px] text-ink-3 hover:text-ink">
        <IconArrowLeft size={16} /> Oylik test
      </Link>
      <Sarlavha nom={guruhNomi} izoh={`Oylik test · ${davrNomi(davr)}`} />
      <Xabar ok={s.ok} xato={s.xato} />

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="font-[family-name:var(--font-display)] text-[15px] font-bold">1. Test sozlamasi</h2>
        {qulf && (
          <p className="text-[12.5px] text-ink-3">Natijalar e’lon qilingan — sozlamani faqat admin o‘zgartiradi.</p>
        )}
        <form action={testSaqla} className="flex flex-col gap-3">
          <input type="hidden" name="group_id" value={gId} />
          <input type="hidden" name="davr" value={davr} />
          <div className="flex flex-wrap gap-3">
            <Maydon nom="Test sanasi" className="w-48">
              <input type="date" name="sana" defaultValue={test?.sana ?? ''} min={boshi} max={oxiri} disabled={qulf} className={kirishKlass} />
            </Maydon>
            <Maydon nom="Izoh (ixtiyoriy)" className="min-w-56 flex-1">
              <input name="izoh" defaultValue={test?.izoh ?? ''} maxLength={200} disabled={qulf} placeholder="Masalan: Unit 1–4" className={kirishKlass} />
            </Maydon>
          </div>
          <TestSozlamasi turi={test?.turi ?? 'ball'} maks={test?.maks ?? null} bolimlar={test?.bolimlar ?? []} qulf={qulf} />
        </form>
      </Card>

      {!test ? (
        <Card className="p-5">
          <Empty>Avval test sozlamasini saqlang — keyin o‘quvchilar ro‘yxati ochiladi.</Empty>
        </Card>
      ) : (
        <Card className="flex flex-col">
          <CardHeader
            title="2. Natijalar"
            meta={`${test.turi === 'ball' ? `maks ${son(test.maks ?? 0)}` : test.turi === 'foiz' ? 'foizda' : test.turi === 'ielts' ? 'IELTS band' : `${test.bolimlar.length} bo‘lim`} · ${natija.size} / ${oquvchilar.length} kiritilgan`}
          />
          {admin && natija.size > 0 && (
            <div className="flex flex-wrap gap-2 px-5 pb-3">
              {elonSoni < natija.size && (
                <form action={elonQil}>
                  <input type="hidden" name="kim" value="guruh" />
                  <input type="hidden" name="test_id" value={test.id} />
                  <input type="hidden" name="qaytish" value={yol} />
                  <Button type="submit">Guruhni e’lon qilish ({natija.size - elonSoni})</Button>
                </form>
              )}
              {elonSoni > 0 && (
                <form action={elonQil}>
                  <input type="hidden" name="kim" value="guruh" />
                  <input type="hidden" name="test_id" value={test.id} />
                  <input type="hidden" name="qaytar" value="1" />
                  <input type="hidden" name="qaytish" value={yol} />
                  <Button type="submit" variant="ikkilamchi">E’londan olish ({elonSoni})</Button>
                </form>
              )}
            </div>
          )}

          {oquvchilar.length === 0 ? (
            <div className="px-5 pb-5">
              <Empty>Bu oyda guruhda o‘quvchi yo‘q.</Empty>
            </div>
          ) : (
            <form action={natijalarSaqla} className="flex flex-col">
              <input type="hidden" name="test_id" value={test.id} />
              <input type="hidden" name="qaytish" value={yol} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-[13px]">
                  <thead>
                    <tr className="border-t border-line text-left">
                      <th className="lbl px-5 py-2 font-normal">O‘quvchi</th>
                      <th className="lbl px-2 py-2 font-normal">Kelmadi</th>
                      {test.turi === 'bolimlar' || test.turi === 'ielts' ? (
                        test.bolimlar.map((b) => (
                          <th key={b.nom} className="lbl px-2 py-2 font-normal">
                            {b.nom} <span className="text-ink-4">{b.maks === 100 ? '%' : `/${son(b.maks)}`}</span>
                          </th>
                        ))
                      ) : (
                        <th className="lbl px-2 py-2 font-normal">{test.turi === 'foiz' ? 'Foiz' : `Ball /${son(test.maks ?? 0)}`}</th>
                      )}
                      <th className="lbl px-2 py-2 font-normal">Natija</th>
                      <th className="lbl px-2 py-2 font-normal">Izoh</th>
                      {admin && <th className="lbl px-5 py-2 font-normal">E’lon</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {oquvchilar.map((o) => {
                      const n = natija.get(o.id)
                      const yopiq = Boolean(n?.elon_qilingan) && !admin
                      return (
                        <tr key={o.id} className="border-t border-line-soft align-middle">
                          <td className="px-5 py-2">
                            <input type="hidden" name="student" value={o.id} />
                            <span className="block font-semibold">{o.fish}</span>
                            {n?.orin != null && <span className="text-[11.5px] text-ink-3">{n.orin}-o‘rin</span>}
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              name={`kelmadi_${o.id}`}
                              defaultChecked={n ? !n.keldi : false}
                              disabled={yopiq}
                              aria-label={`${o.fish} — testga kelmadi`}
                              className="size-5 accent-[var(--color-brand)]"
                            />
                          </td>
                          {test.turi === 'bolimlar' || test.turi === 'ielts' ? (
                            test.bolimlar.map((b, i) => (
                              <td key={b.nom} className="px-2 py-2">
                                <input
                                  name={`b_${o.id}_${i}`}
                                  inputMode="decimal"
                                  defaultValue={n?.bolim_ballar?.[i] != null ? son(n.bolim_ballar[i]) : ''}
                                  disabled={yopiq}
                                  aria-label={`${o.fish} — ${b.nom}`}
                                  step={test.turi === 'ielts' ? 0.5 : undefined}
                                  placeholder={test.turi === 'ielts' ? '0–9' : b.maks === 100 ? '%' : `/${son(b.maks)}`}
                                  className={`${kirishKlass} max-w-20`}
                                />
                              </td>
                            ))
                          ) : (
                            <td className="px-2 py-2">
                              <input
                                name={`ball_${o.id}`}
                                inputMode="decimal"
                                defaultValue={n?.ball != null ? son(n.ball) : ''}
                                disabled={yopiq}
                                aria-label={`${o.fish} — ${test.turi === 'foiz' ? 'foiz' : 'ball'}`}
                                className={`${kirishKlass} max-w-24`}
                              />
                            </td>
                          )}
                          <td className="px-2 py-2">
                            {n?.foiz != null ? (
                              <Badge ton={foizTon(n.foiz)}>{test.turi === 'ielts' ? `Overall ${asosiy(n)}` : asosiy(n)}</Badge>
                            ) : n && !n.keldi ? (
                              <Badge>Kelmadi</Badge>
                            ) : (
                              <span className="text-ink-4">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <input
                              name={`izoh_${o.id}`}
                              defaultValue={n?.izoh ?? ''}
                              maxLength={200}
                              disabled={yopiq}
                              aria-label={`${o.fish} — izoh`}
                              className={`${kirishKlass} min-w-40 max-w-64`}
                            />
                          </td>
                          {admin && (
                            <td className="px-5 py-2">
                              {n &&
                                (n.elon_qilingan ? (
                                  <button
                                    type="submit"
                                    formAction={bittaElon.bind(null, n.id, true)}
                                    title="E’londan olish"
                                    className="min-h-11 rounded-[10px] px-2 text-[12px] font-semibold text-ok hover:bg-ok-soft"
                                  >
                                    E’lon qilingan
                                  </button>
                                ) : (
                                  <button
                                    type="submit"
                                    formAction={bittaElon.bind(null, n.id, false)}
                                    className="min-h-11 rounded-[10px] border border-line px-3 text-[12px] font-semibold text-ink-2 hover:border-ink-3"
                                  >
                                    E’lon qilish
                                  </button>
                                ))}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
                <p className="text-[12px] text-ink-3">
                  Foiz avtomatik hisoblanadi. O‘quvchi natijani admin e’lon qilgandan keyin ko‘radi.
                </p>
                <Button type="submit">Natijalarni saqlash</Button>
              </div>
            </form>
          )}
        </Card>
      )}
    </div>
  )
}

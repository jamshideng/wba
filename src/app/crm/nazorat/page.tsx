import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Empty, Badge } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { sana as sanaFmt, joriyDavr, davrNomi } from '@/lib/format'
import { NAZORAT_TURLAR, ogohlantirishMatni, type NazoratHodisa } from '@/lib/nazorat'
import { ogohlantir, hodisaYop, jarimaQol, tekshir } from './actions'

export const metadata = { title: 'Nazorat' }
export const dynamic = 'force-dynamic'

/**
 * Nazorat (0077, Jamshid 17–18.10) — manager va direktor.
 * Ustoz va adminlarning qoidabuzarliklari avtomatik yig'iladi (har 30 daqiqa,
 * kun oxiri — 21:00). Manager tayyor matn bilan ogohlantiradi; oy ichida
 * 3 tadan keyin jarima qo'llay oladi (maoshdan ayiriladi).
 */
export default async function Nazorat({
  searchParams,
}: {
  searchParams: Promise<{ holat?: string; ok?: string; xato?: string }>
}) {
  await talabRol('manager', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Nazorat" />

  const s = await searchParams
  const hammasi = s.holat === 'hammasi'
  const joriy = `/crm/nazorat${hammasi ? '?holat=hammasi' : ''}`
  const davr = joriyDavr()

  const supabase = await createClient()
  let sorov = supabase
    .from('nazorat_hodisalar')
    .select('id, turi, sana, teacher_id, profile_id, tafsilot, holat, yopish_izoh, created_at, teachers(ism), profiles:profile_id(ism)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (!hammasi) sorov = sorov.eq('holat', 'yangi')

  const [{ data: hXom }, { data: oXom }, { data: uXom }, { data: xXom }] = await Promise.all([
    sorov,
    supabase.from('ogohlantirishlar').select('teacher_id, profile_id').eq('davr', davr).eq('bekor', false),
    supabase.from('teachers').select('id, ism').eq('holat', 'faol').order('ism'),
    supabase.from('profiles').select('id, ism, rol').in('rol', ['admin', 'qabulxona', 'manager']).eq('holat', 'faol').order('ism'),
  ])

  const hodisalar = (hXom ?? []) as unknown as NazoratHodisa[]
  const ustozlar = (uXom ?? []) as { id: string; ism: string }[]
  const xodimlar = (xXom ?? []) as { id: string; ism: string; rol: string }[]
  const ism = new Map<string, string>([
    ...ustozlar.map((u) => [`u:${u.id}`, u.ism] as [string, string]),
    ...xodimlar.map((x) => [`p:${x.id}`, x.ism] as [string, string]),
  ])

  // Shu oy ogohlantirishlar — kim nechta
  const soni = new Map<string, number>()
  for (const o of (oXom ?? []) as { teacher_id: string | null; profile_id: string | null }[]) {
    const k = o.teacher_id ? `u:${o.teacher_id}` : `p:${o.profile_id}`
    soni.set(k, (soni.get(k) ?? 0) + 1)
  }
  const reyting = [...soni.entries()].sort((a, b) => b[1] - a[1])
  const yangi = hodisalar.filter((h) => h.holat === 'yangi').length

  const tanlov = (
    <>
      <optgroup label="Ustozlar">
        {ustozlar.map((u) => (
          <option key={u.id} value={`u:${u.id}`}>
            {u.ism}
          </option>
        ))}
      </optgroup>
      <optgroup label="Xodimlar">
        {xodimlar.map((x) => (
          <option key={x.id} value={`p:${x.id}`}>
            {x.ism}
          </option>
        ))}
      </optgroup>
    </>
  )

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Nazorat"
        izoh={`${davrNomi(davr)} · ustoz va adminlar · avtomatik har 30 daqiqada`}
        amal={
          <form action={tekshir}>
            <input type="hidden" name="qaytish" value={joriy} />
            <Yuborish tur="ikkilamchi" kutish="Tekshirilmoqda…">
              Hozir tekshirish
            </Yuborish>
          </form>
        }
      />

      <Xabar ok={s.ok} xato={s.xato} />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Stat label="Yangi hodisalar" value={yangi} sub="ko‘rib chiqilmagan" ton={yangi ? 'brand' : 'ok'} />
        <Stat label="Shu oy ogohlantirishlar" value={[...soni.values()].reduce((a, b) => a + b, 0)} sub={`${soni.size} kishiga`} />
        <Stat
          label="Jarima mumkin"
          value={reyting.filter(([, n]) => n >= 3).length}
          sub="3 va undan ko‘p ogohlantirish"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="flex flex-col">
          <CardHeader
            title={hammasi ? 'Hamma hodisalar' : 'Yangi hodisalar'}
            meta={
              <a href={hammasi ? '/crm/nazorat' : '/crm/nazorat?holat=hammasi'} className="underline underline-offset-2 hover:text-ink">
                {hammasi ? 'faqat yangilar' : 'hammasini ko‘rish'}
              </a>
            }
          />
          {hodisalar.length === 0 ? (
            <div className="px-5 pb-5">
              <Empty>Hozircha qoidabuzarlik yo‘q.</Empty>
            </div>
          ) : (
            <ul className="flex flex-col">
              {hodisalar.map((h) => {
                const t = NAZORAT_TURLAR[h.turi]
                const kim = h.teacher_id ? `u:${h.teacher_id}` : h.profile_id ? `p:${h.profile_id}` : ''
                const kimIsmi = h.teachers?.ism ?? h.profiles?.ism ?? null
                const n = kim ? (soni.get(kim) ?? 0) : 0
                return (
                  <li key={h.id} className="flex flex-col gap-2 border-t border-line-soft px-5 py-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
                          <Badge ton={t.kim === 'ustoz' ? 'accent' : 'brand'}>{t.nom}</Badge>
                          {kimIsmi ?? <span className="text-ink-3">mas’ul belgilanmagan</span>}
                          {n > 0 && <span className="tnum text-[11.5px] text-ink-3">· shu oy {n}/3</span>}
                        </span>
                        <span className="text-[12px] text-ink-2">{h.tafsilot}</span>
                        <span className="text-[11px] text-ink-3">{sanaFmt(h.sana)}</span>
                      </span>
                      {h.holat !== 'yangi' && <Badge ton={h.holat === 'ogohlantirildi' ? 'accent' : 'jim'}>{h.holat}</Badge>}
                    </div>
                    {h.holat === 'yangi' && (
                      <div className="flex flex-wrap gap-4">
                        <details className="min-w-0 flex-1">
                          <summary className="cursor-pointer text-[12.5px] font-semibold text-brand hover:underline">Ogohlantirish</summary>
                          <form action={ogohlantir} className="mt-2 flex flex-col gap-2">
                            <input type="hidden" name="hodisa_id" value={h.id} />
                            <input type="hidden" name="qaytish" value={joriy} />
                            <Maydon nom="Kimga">
                              <select name="kim" required defaultValue={kim} className={kirishKlass}>
                                <option value="" disabled>
                                  Tanlang…
                                </option>
                                {tanlov}
                              </select>
                            </Maydon>
                            <Maydon nom="Matn" izoh="Tayyor matn — xohlasangiz o‘zgartiring">
                              <textarea
                                name="matn"
                                required
                                rows={4}
                                defaultValue={ogohlantirishMatni(h, kimIsmi ?? '…')}
                                className={`${kirishKlass} py-2`}
                              />
                            </Maydon>
                            <Yuborish kutish="Yuborilmoqda…">Ogohlantirish yuborish</Yuborish>
                          </form>
                        </details>
                        <details>
                          <summary className="cursor-pointer text-[12.5px] text-ink-3 hover:text-ink">Yopish</summary>
                          <form action={hodisaYop} className="mt-2 flex flex-wrap items-end gap-2">
                            <input type="hidden" name="id" value={h.id} />
                            <input type="hidden" name="qaytish" value={joriy} />
                            <Maydon nom="Izoh">
                              <input name="izoh" placeholder="Masalan: sababli" className={kirishKlass} />
                            </Maydon>
                            <Yuborish tur="ikkilamchi" kutish="…">
                              Yopish
                            </Yuborish>
                          </form>
                        </details>
                      </div>
                    )}
                    {h.holat === 'yopildi' && h.yopish_izoh && <span className="text-[11.5px] text-ink-3">Izoh: {h.yopish_izoh}</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col">
            <CardHeader title="Shu oy ogohlantirishlar" meta={davrNomi(davr)} />
            {reyting.length === 0 ? (
              <div className="px-5 pb-5">
                <Empty>Bu oy hali hech kim ogohlantirilmagan.</Empty>
              </div>
            ) : (
              <ul className="flex flex-col">
                {reyting.map(([k, n]) => (
                  <li key={k} className="flex flex-col gap-2 border-t border-line-soft px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-semibold">{ism.get(k) ?? k.slice(2)}</span>
                      <Badge ton={n >= 3 ? 'brand' : 'jim'}>{n}/3</Badge>
                    </div>
                    {n >= 3 && (
                      <details>
                        <summary className="cursor-pointer text-[12.5px] font-semibold text-brand hover:underline">Jarima qo‘llash</summary>
                        <form action={jarimaQol} className="mt-2 flex flex-col gap-2">
                          <input type="hidden" name="kim" value={k} />
                          <input type="hidden" name="qaytish" value={joriy} />
                          <Maydon nom="Summa" izoh="Masalan: 50000 yoki 50 ming">
                            <input name="summa" required inputMode="numeric" className={kirishKlass} />
                          </Maydon>
                          <Maydon nom="Sabab">
                            <input name="sabab" required placeholder="Masalan: 3 marta kechikdi" className={kirishKlass} />
                          </Maydon>
                          <Yuborish tur="xavfli" kutish="…">
                            Jarima yozish
                          </Yuborish>
                        </form>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col">
            <CardHeader title="Qo‘lda ogohlantirish" meta="hodisasiz" />
            <form action={ogohlantir} className="flex flex-col gap-3 px-5 pb-5">
              <input type="hidden" name="qaytish" value={joriy} />
              <Maydon nom="Kimga">
                <select name="kim" required defaultValue="" className={kirishKlass}>
                  <option value="" disabled>
                    Tanlang…
                  </option>
                  {tanlov}
                </select>
              </Maydon>
              <Maydon nom="Matn">
                <textarea name="matn" required rows={3} className={`${kirishKlass} py-2`} />
              </Maydon>
              <Yuborish kutish="Yuborilmoqda…">Yuborish</Yuborish>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}

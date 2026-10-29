import Link from 'next/link'
import { talabRol, tasdiqlaydimi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Empty, Badge } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { sana as sanaFmt, joriyDavr, davrNomi } from '@/lib/format'
import { NAZORAT_TURLAR, ogohlantirishMatni, nazoratManba, type NazoratHodisa } from '@/lib/nazorat'
import { ogohlantir, hodisaYop, hodisalarniYop, jarimaQol, tekshir, direktorgaAlmashtir } from './actions'
import { OmmaviyYopish, OMMAVIY_FORMA } from './ommaviy-yopish'

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
  searchParams: Promise<{ holat?: string; kim?: string; ok?: string; xato?: string }>
}) {
  const profil = await talabRol('manager', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Nazorat" />

  const s = await searchParams
  // Bitta odamning hodisalari (26.10): kim=u:<ustoz> yoki p:<xodim> — hamma holatlar
  const kimFiltr = /^(u:[\w-]+|p:[0-9a-f-]{36})$/.test(s.kim ?? '') ? s.kim! : null
  const hammasi = s.holat === 'hammasi' || Boolean(kimFiltr)
  const joriyQs = new URLSearchParams()
  if (kimFiltr) joriyQs.set('kim', kimFiltr)
  else if (hammasi) joriyQs.set('holat', 'hammasi')
  const joriy = `/crm/nazorat${joriyQs.size ? `?${joriyQs}` : ''}`
  const davr = joriyDavr()

  const supabase = await createClient()
  let sorov = supabase
    .from('nazorat_hodisalar')
    .select('id, turi, sana, teacher_id, profile_id, group_id, student_id, lead_id, vazifa_id, payment_id, kalit, tafsilot, holat, yopish_izoh, created_at, teachers(ism), profiles:profile_id(ism)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (!hammasi) sorov = sorov.eq('holat', 'yangi')
  if (kimFiltr) sorov = kimFiltr.startsWith('u:') ? sorov.eq('teacher_id', kimFiltr.slice(2)) : sorov.eq('profile_id', kimFiltr.slice(2))

  const direktor = tasdiqlaydimi(profil.rol)
  const [{ data: hXom }, { data: oXom }, { data: uXom }, { data: xXom }, { data: menga }] = await Promise.all([
    sorov,
    supabase.from('ogohlantirishlar').select('id, teacher_id, profile_id, matn, created_at').eq('davr', davr).eq('bekor', false).order('created_at', { ascending: false }),
    supabase.from('teachers').select('id, ism').eq('holat', 'faol').order('ism'),
    supabase.from('profiles').select('id, ism, rol').in('rol', ['admin', 'qabulxona', 'manager']).eq('holat', 'faol').order('ism'),
    direktor ? supabase.rpc('nazorat_direktorga') : Promise.resolve({ data: false }),
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
  type Ogoh = { id: number; teacher_id: string | null; profile_id: string | null; matn: string; created_at: string }
  const ogohlar = (oXom ?? []) as Ogoh[]
  for (const o of ogohlar) {
    const k = o.teacher_id ? `u:${o.teacher_id}` : `p:${o.profile_id}`
    soni.set(k, (soni.get(k) ?? 0) + 1)
  }
  const reyting = [...soni.entries()].sort((a, b) => b[1] - a[1])
  const yangi = hodisalar.filter((h) => h.holat === 'yangi').length
  const kimOgohlari = kimFiltr ? ogohlar.filter((o) => (o.teacher_id ? `u:${o.teacher_id}` : `p:${o.profile_id}`) === kimFiltr) : []
  /** Ism → o'z sahifasi: ustoz profili yoki xodimlar ro'yxatidagi qatori */
  const kimHavola = (k: string) => (k.startsWith('u:') ? `/crm/ustozlar/${k.slice(2)}` : `/crm/xodimlar?b=x:${k.slice(2)}`)

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

      {/* 0078 — direktorga nazorat xabarlari: standart o'chiq, faqat direktor yoqadi */}
      {direktor && (
        <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13.5px] font-semibold">Nazorat xabarlari menga ham kelsin</span>
            <span className="text-[12px] text-ink-3">Saytda va Telegram’da. O‘chiq bo‘lsa — faqat managerga boradi.</span>
          </span>
          <form action={direktorgaAlmashtir}>
            <input type="hidden" name="qaytish" value={joriy} />
            <input type="hidden" name="yoq" value={menga ? '0' : '1'} />
            <button
              type="submit"
              role="switch"
              aria-checked={Boolean(menga)}
              aria-label="Nazorat xabarlari menga ham kelsin"
              className="flex min-h-11 items-center gap-2.5 px-1"
            >
              <span
                className={`relative h-6 w-11 rounded-full transition ${menga ? 'bg-ok' : 'bg-line'}`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${menga ? 'left-[22px]' : 'left-0.5'}`}
                />
              </span>
              <span className="w-9 text-left text-[12.5px] font-semibold text-ink-2">{menga ? 'Yoniq' : 'O‘chiq'}</span>
            </button>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Stat label="Yangi hodisalar" value={yangi} sub="ko‘rib chiqilmagan" ton={yangi ? 'brand' : 'ok'} href="/crm/nazorat" />
        <Stat label="Shu oy ogohlantirishlar" value={[...soni.values()].reduce((a, b) => a + b, 0)} sub={`${soni.size} kishiga`} href="/crm/nazorat?b=reyting" />
        <Stat
          href="/crm/nazorat?b=jarima"
          label="Jarima mumkin"
          value={reyting.filter(([, n]) => n >= 3).length}
          sub="3 va undan ko‘p ogohlantirish"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="flex flex-col">
          <CardHeader
            title={kimFiltr ? `${ism.get(kimFiltr) ?? kimFiltr.slice(2)} — hodisalar` : hammasi ? 'Hamma hodisalar' : 'Yangi hodisalar'}
            meta={
              <Link href={hammasi ? '/crm/nazorat' : '/crm/nazorat?holat=hammasi'} className="underline underline-offset-2 hover:text-ink">
                {hammasi ? 'faqat yangilar' : 'hammasini ko‘rish'}
              </Link>
            }
          />
          {kimFiltr && (
            <div className="flex flex-col gap-1.5 border-t border-line-soft px-5 py-3">
              <span className="lbl">
                {davrNomi(davr)} ogohlantirishlari · {kimOgohlari.length} ta
              </span>
              {kimOgohlari.length === 0 ? (
                <span className="text-[12px] text-ink-3">Bu oy ogohlantirish yo‘q.</span>
              ) : (
                kimOgohlari.map((o) => (
                  <span key={o.id} className="text-[12px] leading-snug text-ink-2">
                    <span className="tnum text-ink-3">{sanaFmt(o.created_at.slice(0, 10))}</span> — {o.matn}
                  </span>
                ))
              )}
            </div>
          )}
          {hodisalar.length === 0 ? (
            <div className="px-5 pb-5">
              <Empty>Hozircha qoidabuzarlik yo‘q.</Empty>
            </div>
          ) : (
            <>
            {yangi > 0 && <OmmaviyYopish action={hodisalarniYop} qaytish={joriy} jami={yangi} />}
            <ul className="flex flex-col">
              {hodisalar.map((h) => {
                const t = NAZORAT_TURLAR[h.turi]
                const kim = h.teacher_id ? `u:${h.teacher_id}` : h.profile_id ? `p:${h.profile_id}` : ''
                const kimIsmi = h.teachers?.ism ?? h.profiles?.ism ?? null
                const n = kim ? (soni.get(kim) ?? 0) : 0
                const [asosiy, ...boshqa] = nazoratManba(h)
                return (
                  <li key={h.id} data-belgi={`hodisa:${h.id}`} className="flex flex-col gap-2 border-t border-line-soft px-5 py-3.5">
                    <div className="flex items-start gap-3">
                      {h.holat === 'yangi' && (
                        <input
                          type="checkbox"
                          name="id"
                          value={h.id}
                          form={OMMAVIY_FORMA}
                          aria-label={`Belgilash: ${t.nom}${kimIsmi ? ` — ${kimIsmi}` : ''}`}
                          className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--color-brand)]"
                        />
                      )}
                    <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
                          <Badge ton={t.kim === 'ustoz' ? 'accent' : 'brand'}>{t.nom}</Badge>
                          {kimIsmi && kim ? (
                            <Link href={kimHavola(kim)} className="hover:text-brand hover:underline">{kimIsmi}</Link>
                          ) : (
                            kimIsmi ?? <span className="text-ink-3">mas’ul belgilanmagan</span>
                          )}
                          {n > 0 && kim && (
                            <Link href={`/crm/nazorat?kim=${kim}`} className="tnum text-[11.5px] text-ink-3 hover:text-ink hover:underline">· shu oy {n}/3</Link>
                          )}
                        </span>
                        {asosiy ? (
                          <Link href={asosiy.href} className="text-[12px] text-ink-2 underline decoration-line underline-offset-2 hover:text-brand hover:decoration-brand">
                            {h.tafsilot}
                          </Link>
                        ) : (
                          <span className="text-[12px] text-ink-2">{h.tafsilot}</span>
                        )}
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-3">
                          {sanaFmt(h.sana)}
                          {asosiy && (
                            <Link href={asosiy.href} className="flex min-h-8 items-center font-semibold text-brand hover:underline">
                              Tekshirish: {asosiy.nom} →
                            </Link>
                          )}
                          {boshqa.map((m) => (
                            <Link key={m.href} href={m.href} className="flex min-h-8 items-center hover:text-ink hover:underline">
                              {m.nom}
                            </Link>
                          ))}
                        </span>
                      </span>
                      {h.holat !== 'yangi' && <Badge ton={h.holat === 'ogohlantirildi' ? 'accent' : 'jim'}>{h.holat}</Badge>}
                    </div>
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
            </>
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
                  <li key={k} data-belgi={`reyting${n >= 3 ? ' jarima' : ''}`} className="flex flex-col gap-2 border-t border-line-soft px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/crm/nazorat?kim=${k}`} title="Shu odamning hodisalari va ogohlantirishlari" className="text-[13px] font-semibold hover:text-brand hover:underline">
                        {ism.get(k) ?? k.slice(2)}
                      </Link>
                      <Link href={`/crm/nazorat?kim=${k}`} aria-label={`${ism.get(k) ?? k.slice(2)}: ${n} ta ogohlantirish`}>
                        <Badge ton={n >= 3 ? 'brand' : 'jim'}>{n}/3</Badge>
                      </Link>
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

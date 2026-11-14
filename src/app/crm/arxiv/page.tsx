import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Empty, Badge, Button } from '@/components/ui'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { JonliForma } from '@/components/jonli-forma'
import { ketishNomi } from '@/lib/ketish'
import { royxatOl, royxatVariantlari, type RoyxatBand } from '@/lib/royxat'
import { ketishSababiBelgila, fanKetishSababiBelgila } from '../oquvchilar/actions'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { pul, sana, jadval } from '@/lib/format'
import type { ArxivFan } from '@/lib/types'

export const metadata = { title: 'Arxiv' }
export const dynamic = 'force-dynamic'

type Filtr = {
  ok?: string
  xato?: string
  q?: string
  tur?: string
  fan?: string
  ustoz?: string
  sabab?: string
  dan?: string
  gacha?: string
  qarz?: string
}

const SANA = /^\d{4}-\d{2}-\d{2}$/

/**
 * Arxiv (Sheets "Arxiv" varag'i, 0030): ketgan o'quvchilar — qarzi bilan,
 * bitta fanidan ketganlar (0124), yopilgan guruhlar va arxivdagi ustozlar.
 * Hech narsa o'chirilmaydi: o'quvchi shu ID bilan profilidan qaytariladi,
 * fan — o'sha guruhga qayta biriktirib, guruh — tahrirlashda "Faol" qilib.
 * Qidiruv va filtrlar jonli (JonliForma).
 */
export default async function Arxiv({ searchParams }: { searchParams: Promise<Filtr> }) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const s = await searchParams
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Arxiv" />

  const q = (s.q ?? '').trim().toLowerCase()
  const tur = s.tur === 'oquvchi' || s.tur === 'fan' ? s.tur : 'hammasi'
  const fanF = s.fan || ''
  const ustozF = s.ustoz || ''
  const sababF = s.sabab || ''
  const dan = SANA.test(s.dan ?? '') ? s.dan! : ''
  const gacha = SANA.test(s.gacha ?? '') ? s.gacha! : ''
  const faqatQarz = s.qarz === '1'
  const filtrBor = Boolean(q || tur !== 'hammasi' || fanF || ustozF || sababF || dan || gacha || faqatQarz)

  const supabase = await createClient()
  const ketishRoyxat = await royxatOl(supabase, 'ketish_sabab')
  const [
    { data: oquvchilar },
    { data: fanlarArx },
    { data: guruhlar },
    { data: ustozlar },
    { data: fanlar },
    { data: ketganFanlari },
  ] = await Promise.all([
    supabase.from('v_arxiv_oquvchilar').select('student_id, fish, arxiv_sana, arxiv_sabab, qarz, guruhlar, ketish_sababi').order('arxiv_sana', { ascending: false, nullsFirst: false }),
    supabase.from('v_arxiv_fanlar').select('*').order('tugadi', { ascending: false, nullsFirst: false }),
    supabase.from('groups').select('id, nom, boshlanish, tugash, kunlar, teachers(ism)').eq('holat', 'yopilgan').order('nom'),
    supabase.from('teachers').select('id, ism, telefon, holat').order('ism'),
    supabase.from('subjects').select('id, nom').order('nom'),
    // Butunlay ketganlarning fan/ustozi — filtr uchun
    fanF || ustozF
      ? supabase.from('enrollments').select('student_id, groups(subject_id, teacher_id), students!inner(holat)').eq('students.holat', 'ketgan')
      : Promise.resolve({ data: [] }),
  ])

  type Oquvchi = { student_id: string; fish: string; arxiv_sana: string | null; arxiv_sabab: string | null; qarz: number; guruhlar: string | null; ketish_sababi: string | null }
  type Guruh = { id: string; nom: string; boshlanish: string; tugash: string; kunlar: number[]; teachers: { ism: string } | null }
  type Ustoz = { id: string; ism: string; telefon: string | null; holat: string }
  const oHammasi = (oquvchilar ?? []) as unknown as Oquvchi[]
  const fHammasi = (fanlarArx ?? []) as unknown as ArxivFan[]
  const gList = (guruhlar ?? []) as unknown as Guruh[]
  const uHammasi = (ustozlar ?? []) as unknown as Ustoz[]
  const uList = uHammasi.filter((u) => u.holat === 'bloklangan')
  const fanVariant = (fanlar ?? []) as { id: string; nom: string }[]

  // O'quvchi → o'qigan fan va ustozlari (faqat fan/ustoz filtri bo'lsa)
  const oqFan = new Map<string, { fan: Set<string>; ustoz: Set<string> }>()
  for (const r of (ketganFanlari ?? []) as unknown as { student_id: string; groups: { subject_id: string | null; teacher_id: string | null } | null }[]) {
    const x = oqFan.get(r.student_id) ?? { fan: new Set<string>(), ustoz: new Set<string>() }
    if (r.groups?.subject_id) x.fan.add(r.groups.subject_id)
    if (r.groups?.teacher_id) x.ustoz.add(r.groups.teacher_id)
    oqFan.set(r.student_id, x)
  }

  const sababMos = (v: string | null) => !sababF || (sababF === 'belgilanmagan' ? !v : v === sababF)
  const sanaMos = (v: string | null) => (!dan || (v !== null && v >= dan)) && (!gacha || (v !== null && v <= gacha))

  const oList = tur === 'fan' ? [] : oHammasi.filter((o) => {
    if (q && !`${o.fish} ${o.student_id} ${o.guruhlar ?? ''} ${o.arxiv_sabab ?? ''}`.toLowerCase().includes(q)) return false
    if (fanF && !oqFan.get(o.student_id)?.fan.has(fanF)) return false
    if (ustozF && !oqFan.get(o.student_id)?.ustoz.has(ustozF)) return false
    if (faqatQarz && !(Number(o.qarz) > 0)) return false
    return sababMos(o.ketish_sababi) && sanaMos(o.arxiv_sana)
  })
  const fList = tur === 'oquvchi' ? [] : fHammasi.filter((f) => {
    if (q && !`${f.fish} ${f.student_id} ${f.guruh} ${f.fan ?? ''} ${f.ustoz ?? ''} ${f.ketish_izoh ?? ''}`.toLowerCase().includes(q)) return false
    if (fanF && f.subject_id !== fanF) return false
    if (ustozF && f.teacher_id !== ustozF) return false
    if (faqatQarz && !(Number(f.qarz) > 0)) return false
    return sababMos(f.ketish_sababi) && sanaMos(f.tugadi)
  })

  const qarzJami = oHammasi.reduce((a, o) => a + Math.max(0, Number(o.qarz) || 0), 0)
  const fanQarzJami = fHammasi.reduce((a, f) => a + Math.max(0, Number(f.qarz) || 0), 0)

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Arxiv" izoh="o‘chirilmaydi — qaytarish mumkin" />
      <Xabar ok={s.ok} xato={s.xato} />

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-5">
        <Stat label="Arxivdagi o‘quvchilar" value={oHammasi.length} href="/crm/arxiv?b=oq" />
        <Stat label="Arxivdagi fanlar" value={fHammasi.length} sub={fanQarzJami > 0 ? `o‘quvchi faol · qarz ${pul(fanQarzJami)}` : 'o‘quvchi faol, fandan ketgan'} href="/crm/arxiv?b=fan" />
        <Stat label="Arxivdagilar qarzi" value={qarzJami} sub="so‘m · butunlay ketganlar" ton={qarzJami > 0 ? 'brand' : undefined} href="/crm/arxiv?b=qarz" />
        <Stat label="Yopilgan guruhlar" value={gList.length} href="/crm/arxiv?b=guruh" />
        <Stat label="Arxivdagi ustozlar" value={uList.length} href="/crm/arxiv?b=ustoz" />
      </div>

      <Card className="flex flex-col gap-3 px-5 py-4">
        <JonliForma className="flex flex-wrap items-end gap-2">
          <Maydon nom="Qidiruv" className="min-w-[220px] flex-1">
            <input name="q" defaultValue={s.q ?? ''} placeholder="Ism, ID, guruh yoki izoh" className={kirishKlass} />
          </Maydon>
          <Maydon nom="Turi">
            <select name="tur" defaultValue={tur === 'hammasi' ? '' : tur} className={kirishKlass}>
              <option value="">Hammasi</option>
              <option value="oquvchi">Butunlay ketgan</option>
              <option value="fan">Fandan ketgan</option>
            </select>
          </Maydon>
          <Maydon nom="Fan">
            <select name="fan" defaultValue={fanF} className={kirishKlass}>
              <option value="">Hammasi</option>
              {fanVariant.map((f) => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
          </Maydon>
          <Maydon nom="Ustoz">
            <select name="ustoz" defaultValue={ustozF} className={kirishKlass}>
              <option value="">Hammasi</option>
              {uHammasi.map((u) => (
                <option key={u.id} value={u.id}>{u.ism}</option>
              ))}
            </select>
          </Maydon>
          <Maydon nom="Sabab">
            <select name="sabab" defaultValue={sababF} className={kirishKlass}>
              <option value="">Hammasi</option>
              <option value="belgilanmagan">Belgilanmagan</option>
              {royxatVariantlari(ketishRoyxat).map((b) => (
                <option key={b.kalit} value={b.kalit}>{b.nom}</option>
              ))}
            </select>
          </Maydon>
          <Maydon nom="Dan">
            <input type="date" name="dan" defaultValue={dan} className={kirishKlass} />
          </Maydon>
          <Maydon nom="Gacha">
            <input type="date" name="gacha" defaultValue={gacha} className={kirishKlass} />
          </Maydon>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" name="qarz" value="1" defaultChecked={faqatQarz} className="size-4" />
            Faqat qarzi borlar
          </label>
          {filtrBor && <Button href="/crm/arxiv" variant="ikkilamchi">Tozalash</Button>}
        </JonliForma>
      </Card>

      {tur !== 'fan' && (
        <Card className="flex flex-col">
          <CardHeader title="O‘quvchilar — butunlay ketgan" meta={filtrBor ? `${oList.length} / ${oHammasi.length} ta` : `${oList.length} ta`} />
          {oList.length === 0 ? (
            <div className="px-5 pb-5"><Empty>{filtrBor ? 'Filtr bo‘yicha topilmadi.' : 'Arxivda o‘quvchi yo‘q.'}</Empty></div>
          ) : (
            <ul className="flex flex-col">
              {oList.map((o) => (
                <li key={o.student_id} data-belgi={`oq${Number(o.qarz) > 0 ? ' qarz' : ''}`} className="border-b border-line-soft last:border-0">
                  <Link
                    href={`/crm/oquvchilar/${o.student_id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 transition hover:bg-surface-2"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[13.5px] font-semibold">{o.fish}</span>
                        <Badge ton={o.ketish_sababi ? 'jim' : 'accent'}>{ketishNomi(o.ketish_sababi, ketishRoyxat)}</Badge>
                      </span>
                      <span className="truncate text-[12px] text-ink-3">
                        {o.student_id}
                        {o.arxiv_sana ? ` · ${sana(o.arxiv_sana)}` : ''}
                        {o.arxiv_sabab ? ` · ${o.arxiv_sabab}` : ''}
                        {o.guruhlar ? ` · ${o.guruhlar}` : ''}
                      </span>
                    </span>
                    <QarzMatn qarz={o.qarz} />
                  </Link>
                  <SababForma
                    action={ketishSababiBelgila}
                    yashirin={{ student_id: o.student_id }}
                    joriy={o.ketish_sababi}
                    izoh={o.arxiv_sabab}
                    royxat={ketishRoyxat}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tur !== 'oquvchi' && (
        <Card className="flex flex-col">
          <CardHeader title="Fanlar — o‘quvchi faol, shu fandan ketgan" meta={filtrBor ? `${fList.length} / ${fHammasi.length} ta` : `${fList.length} ta`} />
          {fList.length === 0 ? (
            <div className="px-5 pb-5"><Empty>{filtrBor ? 'Filtr bo‘yicha topilmadi.' : 'Fandan ketgan yo‘q.'}</Empty></div>
          ) : (
            <ul className="flex flex-col">
              {fList.map((f) => (
                <li key={f.enrollment_id} data-belgi={`fan${Number(f.qarz) > 0 ? ' qarz' : ''}`} className="border-b border-line-soft last:border-0">
                  <Link
                    href={`/crm/oquvchilar/${f.student_id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 transition hover:bg-surface-2"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-[13.5px] font-semibold">{f.fish}</span>
                        <Badge ton="jim">{f.fan ?? f.guruh}</Badge>
                        <Badge ton={f.ketish_sababi ? 'jim' : 'accent'}>{ketishNomi(f.ketish_sababi, ketishRoyxat)}</Badge>
                      </span>
                      <span className="truncate text-[12px] text-ink-3">
                        {f.student_id} · {f.guruh}
                        {f.ustoz ? ` · ${f.ustoz}` : ''}
                        {` · ${sana(f.boshlandi)} — ${f.tugadi ? sana(f.tugadi) : '…'}`}
                        {f.ketish_izoh ? ` · ${f.ketish_izoh}` : ''}
                      </span>
                    </span>
                    <QarzMatn qarz={f.qarz} />
                  </Link>
                  <Link href={`/crm/oquvchilar/${f.student_id}?qayta=${f.enrollment_id}#qayta-${f.enrollment_id}`} className="mx-5 mb-1 inline-flex min-h-9 items-center text-[12px] font-semibold text-accent hover:text-ink">
                    Qayta o‘qish →
                  </Link>
                  <SababForma
                    action={fanKetishSababiBelgila}
                    yashirin={{ enrollment_id: f.enrollment_id }}
                    joriy={f.ketish_sababi}
                    izoh={f.ketish_izoh}
                    royxat={ketishRoyxat}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader title="Yopilgan guruhlar" meta={`${gList.length} ta`} />
          {gList.length === 0 ? (
            <div className="px-5 pb-5"><Empty>Yopilgan guruh yo‘q.</Empty></div>
          ) : (
            <ul className="flex flex-col">
              {gList.map((g) => (
                <li key={g.id} data-belgi="guruh">
                  <Link href={`/crm/guruhlar/${g.id}`} className="flex min-h-11 flex-col justify-center gap-0.5 border-b border-line-soft px-5 py-2.5 last:border-0 hover:bg-surface-2">
                    <span className="truncate text-[13px] font-semibold">{g.nom}</span>
                    <span className="truncate text-[11.5px] text-ink-3">
                      {g.teachers?.ism ?? '—'} · {jadval(g.boshlanish, g.tugash, g.kunlar)} · qayta ochish — tahrirlashda “Faol”
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Arxivdagi ustozlar" meta={`${uList.length} ta`} />
          {uList.length === 0 ? (
            <div className="px-5 pb-5"><Empty>Arxivda ustoz yo‘q.</Empty></div>
          ) : (
            <ul className="flex flex-col px-5 pb-3">
              {uList.map((u) => (
                <li key={u.id} data-belgi="ustoz" className="flex min-h-11 items-center justify-between border-b border-line-soft text-[13px] last:border-0">
                  <span>{u.ism}</span>
                  <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-ink-3">{u.id}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function QarzMatn({ qarz }: { qarz: number }) {
  const n = Number(qarz) || 0
  return (
    <span className={`tnum font-[family-name:var(--font-mono)] text-[12.5px] ${n > 0 ? 'text-brand' : 'text-ink-4'}`}>
      {n > 0 ? `qarz ${pul(n)}` : '—'}
    </span>
  )
}

function SababForma({
  action,
  yashirin,
  joriy,
  izoh,
  royxat,
}: {
  action: (fd: FormData) => Promise<void>
  yashirin: Record<string, string>
  joriy: string | null
  izoh: string | null
  royxat: RoyxatBand[]
}) {
  return (
    <details className="px-5 pb-3">
      <summary className="cursor-pointer text-[12px] text-ink-3 hover:text-ink">
        {joriy ? 'Sababni o‘zgartirish' : 'Sabab qo‘yish'}
      </summary>
      <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
        {Object.entries(yashirin).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="qaytish" value="/crm/arxiv" />
        <Maydon nom="Sabab">
          <select name="turi" required defaultValue={joriy ?? ''} className={kirishKlass}>
            <option value="" disabled>
              Tanlang…
            </option>
            {royxatVariantlari(royxat).map((b) => (
              <option key={b.kalit} value={b.kalit}>
                {b.nom}
              </option>
            ))}
          </select>
        </Maydon>
        <Maydon nom="Izoh" izoh="“Boshqa” bo‘lsa — majburiy">
          <input name="izoh" placeholder={izoh ?? ''} className={kirishKlass} />
        </Maydon>
        <Yuborish kutish="…">Saqlash</Yuborish>
      </form>
    </details>
  )
}

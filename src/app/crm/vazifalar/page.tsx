import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Badge, Empty, Stat } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { IconPhone, IconAlert, IconDebt, IconJadval, IconAttendance } from '@/components/icons'
import { bugunToshkent, pul, telefon } from '@/lib/format'
import { kunQosh } from '@/lib/lidlar'
import type { VazifaHolat, VazifaMuhimlik, VazifaTuri } from '@/lib/types'
import { vazifaHolat, vazifaQosh, vazifaSur } from './actions'

export const metadata = { title: 'Vazifalar' }
export const dynamic = 'force-dynamic'

const TUR_NOMI: Record<VazifaTuri, string> = {
  qongiroq: 'Qo‘ng‘iroq',
  tolov_eslatish: 'To‘lov eslatish',
  sinov_chaqirish: 'Sinov darsiga chaqirish',
  boshqa: 'Boshqa',
}
const MUHIM_NOMI: Record<VazifaMuhimlik, string> = { past: 'Past', orta: 'O‘rta', yuqori: 'Yuqori' }

const BOLIMLAR = {
  bugun: 'Bugun',
  kelgusi: 'Kelgusi',
  bajarilgan: 'Bajarilganlar',
} as const
type Bolim = keyof typeof BOLIMLAR

type Qator = {
  id: string
  nom: string
  turi: VazifaTuri
  muddat: string
  holat: VazifaHolat
  muhimlik: VazifaMuhimlik
  izoh: string | null
  avto: boolean
  lead_id: string | null
  student_id: string | null
  bajarildi_at: string | null
  leads: { ism: string; telefon: string } | null
  students: { fish: string; ota_tel: string | null; ona_tel: string | null; shaxsiy_tel: string | null } | null
  masul_p: { ism: string } | null
  bajardi_p: { ism: string } | null
}

/** timestamptz → Toshkent "YYYY-MM-DD" va "HH:MM" */
function toshkent(iso: string): { sana: string; soat: string } {
  const d = new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString()
  return { sana: d.slice(0, 10), soat: d.slice(11, 16) }
}

function muddatMatn(iso: string, bugun: string): string {
  const { sana, soat } = toshkent(iso)
  if (sana === bugun) return `Bugun, ${soat}`
  if (sana === kunQosh(bugun, 1)) return `Ertaga, ${soat}`
  if (sana === kunQosh(bugun, -1)) return `Kecha, ${soat}`
  const [y, m, d] = sana.split('-')
  return `${d}.${m}.${y.slice(2)}, ${soat}`
}

export default async function Vazifalar({
  searchParams,
}: {
  searchParams: Promise<{ bolim?: string; turi?: string; ok?: string; xato?: string; lid?: string; oquvchi?: string; yangi?: string }>
}) {
  await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Vazifalar" />

  const s = await searchParams
  const bolim: Bolim = (Object.keys(BOLIMLAR) as Bolim[]).find((b) => b === s.bolim) ?? 'bugun'
  const turi = (Object.keys(TUR_NOMI) as VazifaTuri[]).find((t) => t === s.turi)
  const bugun = bugunToshkent()
  const ertaga = kunQosh(bugun, 1)
  const kunOxiri = `${ertaga}T00:00:00+05:00`
  const kunBoshi = `${bugun}T00:00:00+05:00`
  const hozir = new Date().toISOString()

  const sorov = new URLSearchParams()
  if (bolim !== 'bugun') sorov.set('bolim', bolim)
  if (turi) sorov.set('turi', turi)
  const yol = `/crm/vazifalar${sorov.size ? `?${sorov}` : ''}`

  const supabase = await createClient()
  const ustunlar =
    'id, nom, turi, muddat, holat, muhimlik, izoh, avto, lead_id, student_id, bajarildi_at, leads(ism, telefon), students(fish, ota_tel, ona_tel, shaxsiy_tel), masul_p:profiles!vazifalar_masul_fkey(ism), bajardi_p:profiles!vazifalar_bajardi_fkey(ism)'

  let royxatSorov = supabase.from('vazifalar').select(ustunlar)
  if (bolim === 'bugun') royxatSorov = royxatSorov.in('holat', ['yangi', 'jarayonda']).lt('muddat', kunOxiri).order('muddat')
  else if (bolim === 'kelgusi') royxatSorov = royxatSorov.in('holat', ['yangi', 'jarayonda']).gte('muddat', kunOxiri).order('muddat')
  else royxatSorov = royxatSorov.eq('holat', 'bajarildi').order('bajarildi_at', { ascending: false })
  if (turi) royxatSorov = royxatSorov.eq('turi', turi)

  const [{ data }, { data: ochiqlar }, { count: bugunBajarildi }, { data: lidlar }, { data: qarzdorlar }, { data: oquvchilar }, { data: xodimlar }] =
    await Promise.all([
      royxatSorov.limit(200),
      supabase.from('vazifalar').select('muddat').in('holat', ['yangi', 'jarayonda']),
      supabase.from('vazifalar').select('id', { count: 'exact', head: true }).eq('holat', 'bajarildi').gte('bajarildi_at', kunBoshi),
      supabase.from('leads').select('id, ism').is('student_id', null).in('holat', ['yangi', 'qongiroq', 'keldi']).order('ism').limit(300),
      supabase.from('v_qarzdorlar').select('student_id, fish, qarz').order('qarz', { ascending: false }).limit(100),
      supabase.from('students').select('id, fish').eq('holat', 'faol').order('fish').limit(500),
      supabase.from('profiles').select('id, ism').in('rol', ['admin', 'direktor', 'qabulxona']).eq('holat', 'faol').order('ism'),
    ])

  const royxat = (data ?? []) as unknown as Qator[]
  const ochiq = (ochiqlar ?? []) as { muddat: string }[]
  const kechikkan = ochiq.filter((v) => v.muddat < hozir).length
  const bugunSoni = ochiq.filter((v) => v.muddat < kunOxiri).length
  const kelgusi = ochiq.length - bugunSoni
  const qarzMap = new Map(((qarzdorlar ?? []) as { student_id: string; qarz: number }[]).map((q) => [q.student_id, q.qarz]))

  const havola = (b: Bolim) => {
    const u = new URLSearchParams(sorov)
    if (b === 'bugun') u.delete('bolim')
    else u.set('bolim', b)
    return `/crm/vazifalar${u.size ? `?${u}` : ''}`
  }

  // Lid yoki o'quvchi sahifasidan "Vazifa qo'shish" bilan kelinsa — oldindan tanlangan
  const oldindan = s.lid ? `lead:${s.lid}` : s.oquvchi ? `student:${s.oquvchi}` : ''
  const soat18 = `${bugun}T18:00`

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Vazifalar" izoh="qo‘ng‘iroqlar, to‘lov eslatmalari, sinov darsiga chaqirish" />
      <Xabar ok={s.ok} xato={s.xato} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bugun" value={String(bugunSoni)} sub="bugun bajarilishi kerak" ton="accent" border={bugunSoni ? 'accent' : undefined} Icon={IconAlert} />
        <Stat label="Kechikkan" value={String(kechikkan)} sub="muddati o‘tib ketgan" ton="brand" border={kechikkan ? 'brand' : undefined} Icon={IconDebt} />
        <Stat label="Kelgusi" value={String(kelgusi)} sub="ertadan boshlab" Icon={IconJadval} />
        <Stat label="Bugun bajarildi" value={String(bugunBajarildi ?? 0)} ton="ok" Icon={IconAttendance} />
      </div>

      <Card className="flex flex-col">
        <details open={Boolean(oldindan) || s.yangi === '1'}>
          <summary className="flex min-h-12 cursor-pointer items-center px-5 font-[family-name:var(--font-display)] text-[15px] font-bold">
            + Yangi vazifa
          </summary>
          <form action={vazifaQosh} className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="qaytish" value={yol} />
            <Maydon nom="Nima qilish kerak" className="sm:col-span-2">
              <input name="nom" required maxLength={200} placeholder="Masalan: oktabr to‘lovini eslatish" className={kirishKlass} />
            </Maydon>
            <Maydon nom="Turi">
              <select name="turi" defaultValue={s.oquvchi ? 'tolov_eslatish' : 'qongiroq'} className={kirishKlass}>
                {(Object.keys(TUR_NOMI) as VazifaTuri[]).map((t) => (
                  <option key={t} value={t}>{TUR_NOMI[t]}</option>
                ))}
              </select>
            </Maydon>
            <Maydon nom="Muddat">
              <input name="muddat" type="datetime-local" required defaultValue={soat18} className={kirishKlass} />
            </Maydon>
            <Maydon nom="Kim bilan" izoh="Lid, qarzdor yoki o‘quvchi">
              <select name="bogliq" defaultValue={oldindan} className={kirishKlass}>
                <option value="">Hech kim (umumiy vazifa)</option>
                {(qarzdorlar ?? []).length > 0 && (
                  <optgroup label="Qarzdorlar">
                    {((qarzdorlar ?? []) as { student_id: string; fish: string; qarz: number }[]).map((q) => (
                      <option key={`q${q.student_id}`} value={`student:${q.student_id}`}>
                        {q.fish} — {pul(q.qarz)} so‘m
                      </option>
                    ))}
                  </optgroup>
                )}
                {(lidlar ?? []).length > 0 && (
                  <optgroup label="Lidlar">
                    {((lidlar ?? []) as { id: string; ism: string }[]).map((l) => (
                      <option key={l.id} value={`lead:${l.id}`}>{l.ism}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Barcha o‘quvchilar">
                  {((oquvchilar ?? []) as { id: string; fish: string }[])
                    .filter((o) => !qarzMap.has(o.id))
                    .map((o) => (
                      <option key={o.id} value={`student:${o.id}`}>{o.fish} ({o.id})</option>
                    ))}
                </optgroup>
              </select>
            </Maydon>
            <Maydon nom="Mas’ul">
              <select name="masul" defaultValue="" className={kirishKlass}>
                <option value="">Hammaga</option>
                {((xodimlar ?? []) as { id: string; ism: string }[]).map((x) => (
                  <option key={x.id} value={x.id}>{x.ism}</option>
                ))}
              </select>
            </Maydon>
            <Maydon nom="Muhimlik">
              <select name="muhimlik" defaultValue="orta" className={kirishKlass}>
                {(Object.keys(MUHIM_NOMI) as VazifaMuhimlik[]).map((m) => (
                  <option key={m} value={m}>{MUHIM_NOMI[m]}</option>
                ))}
              </select>
            </Maydon>
            <Maydon nom="Izoh" className="sm:col-span-2 lg:col-span-3">
              <input name="izoh" maxLength={1000} placeholder="Ixtiyoriy" className={kirishKlass} />
            </Maydon>
            <Yuborish className="sm:col-span-2 lg:col-span-3">Vazifa qo‘shish</Yuborish>
          </form>
        </details>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(BOLIMLAR) as Bolim[]).map((b) => (
          <Link
            key={b}
            href={havola(b)}
            className={`flex min-h-11 items-center gap-2 rounded-[9px] border px-4 text-[13px] transition ${
              bolim === b ? 'border-brand bg-brand-soft text-ink' : 'border-line text-ink-3 hover:text-ink'
            }`}
          >
            {BOLIMLAR[b]}
            {b !== 'bajarilgan' && (
              <span className="tnum font-[family-name:var(--font-mono)] text-[11px] text-ink-3">{b === 'bugun' ? bugunSoni : kelgusi}</span>
            )}
          </Link>
        ))}
        <form action="/crm/vazifalar" className="ml-auto flex items-center gap-2">
          {bolim !== 'bugun' && <input type="hidden" name="bolim" value={bolim} />}
          <select name="turi" defaultValue={turi ?? ''} aria-label="Turi" className={`${kirishKlass} !w-auto`}>
            <option value="">Barcha turlar</option>
            {(Object.keys(TUR_NOMI) as VazifaTuri[]).map((t) => (
              <option key={t} value={t}>{TUR_NOMI[t]}</option>
            ))}
          </select>
          <button className="min-h-11 rounded-[9px] border border-line px-4 text-[13px] text-ink-2 hover:border-ink-3 hover:text-ink">Ko‘rsatish</button>
        </form>
      </div>

      <Card className="flex flex-col">
        <CardHeader title={BOLIMLAR[bolim]} meta={`${royxat.length} ta`} />
        {royxat.length === 0 ? (
          <div className="px-5 pb-5">
            <Empty>
              {bolim === 'bugun'
                ? 'Bugunga vazifa yo‘q. Lidga "keyingi aloqa" sanasi qo‘yilsa, shu yerda avtomatik paydo bo‘ladi.'
                : 'Bu bo‘limda hech narsa yo‘q.'}
            </Empty>
          </div>
        ) : (
          <ul>
            {royxat.map((v) => {
              const kim = v.leads?.ism ?? v.students?.fish ?? null
              const tel = v.leads?.telefon ?? v.students?.shaxsiy_tel ?? v.students?.ota_tel ?? v.students?.ona_tel ?? null
              const kechikdi = v.holat !== 'bajarildi' && v.muddat < hozir
              const kimHavola = v.lead_id ? '/crm/lidlar' : v.student_id ? `/crm/oquvchilar/${v.student_id}` : null
              const qarz = v.student_id ? qarzMap.get(v.student_id) : undefined
              return (
                <li key={v.id} className="flex flex-col gap-2.5 border-t border-line-soft px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-semibold">{v.nom}</span>
                      <Badge ton={v.turi === 'tolov_eslatish' ? 'accent' : 'jim'}>{TUR_NOMI[v.turi]}</Badge>
                      {v.muhimlik === 'yuqori' && <Badge ton="brand">Muhim</Badge>}
                      {v.avto && <Badge>avto</Badge>}
                      {v.holat === 'jarayonda' && <Badge ton="ok" nuqta>Jarayonda</Badge>}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-3">
                      <span className={kechikdi ? 'font-semibold text-brand' : ''}>
                        {kechikdi ? 'Kechikdi · ' : ''}
                        {bolim === 'bajarilgan' && v.bajarildi_at
                          ? `Bajarildi: ${muddatMatn(v.bajarildi_at, bugun)}${v.bajardi_p ? ` · ${v.bajardi_p.ism}` : ''}`
                          : muddatMatn(v.muddat, bugun)}
                      </span>
                      {kim && kimHavola && (
                        <Link href={kimHavola} className="text-ink-2 underline-offset-4 hover:underline">{kim}</Link>
                      )}
                      {tel && (
                        <a href={`tel:${tel}`} className="flex items-center gap-1 text-ink-2 hover:text-ink">
                          <IconPhone size={13} /> {telefon(tel)}
                        </a>
                      )}
                      {qarz ? <span className="text-brand">qarz {pul(qarz)} so‘m</span> : null}
                      {v.masul_p && <span>mas’ul: {v.masul_p.ism}</span>}
                    </span>
                    {v.izoh && <span className="text-[12px] leading-snug text-ink-3">{v.izoh}</span>}
                  </div>

                  {bolim !== 'bajarilgan' ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <form action={vazifaHolat}>
                        <input type="hidden" name="qaytish" value={yol} />
                        <input type="hidden" name="id" value={v.id} />
                        <input type="hidden" name="holat" value="bajarildi" />
                        <Yuborish tur="ok" kutish="…">Bajarildi</Yuborish>
                      </form>
                      {v.holat === 'yangi' && (
                        <form action={vazifaHolat}>
                          <input type="hidden" name="qaytish" value={yol} />
                          <input type="hidden" name="id" value={v.id} />
                          <input type="hidden" name="holat" value="jarayonda" />
                        <Yuborish tur="ikkilamchi" kutish="…">Boshladim</Yuborish>
                        </form>
                      )}
                      <details className="relative">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-[9px] border border-line px-3 text-[13px] text-ink-2 hover:text-ink">
                          Yana
                        </summary>
                        <div className="absolute right-0 z-10 mt-1 flex w-64 flex-col gap-2 rounded-[10px] border border-line bg-surface p-3 shadow-xl">
                          <form action={vazifaSur} className="flex flex-col gap-2">
                            <input type="hidden" name="qaytish" value={yol} />
                            <input type="hidden" name="id" value={v.id} />
                            <label className="lbl" htmlFor={`sur-${v.id}`}>Muddatni surish</label>
                            <input id={`sur-${v.id}`} name="muddat" type="datetime-local" required defaultValue={`${ertaga}T${toshkent(v.muddat).soat}`} className={kirishKlass} />
                            <Yuborish tur="ikkilamchi">Surish</Yuborish>
                          </form>
                          <form action={vazifaHolat}>
                            <input type="hidden" name="qaytish" value={yol} />
                            <input type="hidden" name="id" value={v.id} />
                            <input type="hidden" name="holat" value="bekor" />
                        <Yuborish tur="xavfli" className="w-full">Bekor qilish</Yuborish>
                          </form>
                        </div>
                      </details>
                    </div>
                  ) : (
                    <form action={vazifaHolat}>
                      <input type="hidden" name="qaytish" value={yol} />
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="holat" value="yangi" />
                        <Yuborish tur="ikkilamchi" kutish="…">Qaytarish</Yuborish>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

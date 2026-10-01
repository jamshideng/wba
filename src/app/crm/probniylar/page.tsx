import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { IconPhone } from '@/components/icons'
import { sana, telefon, bugunToshkent } from '@/lib/format'
import { probniyQosh, probniyHolat, probniyGuruh, probniyDoimiy } from './actions'
import type { LeadStatus } from '@/lib/types'

export const metadata = { title: 'Probniylar' }
export const dynamic = 'force-dynamic'

/* Botdagi to'rt holat (Y_Probniy.js: PROB_HOLAT) */
const BOLIMLAR = {
  kutilmoqda: { nom: 'Kutilmoqda', holatlar: ['yangi', 'qongiroq', 'keldi'] as LeadStatus[] },
  doimiy: { nom: 'Doimiy', holatlar: ['yozildi'] as LeadStatus[] },
  kelmadi: { nom: 'Kelmadi', holatlar: ['kelmadi'] as LeadStatus[] },
  rad: { nom: 'Rad etdi', holatlar: ['rad'] as LeadStatus[] },
} as const

type Bolim = keyof typeof BOLIMLAR

type Probniy = {
  id: string
  ism: string
  telefon: string
  holat: LeadStatus
  izoh: string | null
  student_id: string | null
  group_id: string | null
  tugilgan_sana: string | null
  sinov_sana: string | null
  created_at: string
  groups: { nom: string } | null
}

export default async function Probniylar({
  searchParams,
}: {
  searchParams: Promise<{ bolim?: string; ok?: string; xato?: string }>
}) {
  await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Probniylar" />

  const s = await searchParams
  const bolim: Bolim = (Object.keys(BOLIMLAR) as Bolim[]).find((b) => b === s.bolim) ?? 'kutilmoqda'
  const yol = bolim === 'kutilmoqda' ? '/crm/probniylar' : `/crm/probniylar?bolim=${bolim}`
  const bugun = bugunToshkent()

  const supabase = await createClient()
  const [{ data }, { data: guruhlar }, { data: sonlar }] = await Promise.all([
    supabase
      .from('leads')
      .select('id, ism, telefon, holat, izoh, student_id, group_id, tugilgan_sana, sinov_sana, created_at, groups(nom)')
      .in('holat', BOLIMLAR[bolim].holatlar)
      .order('sinov_sana', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('groups').select('id, nom').eq('holat', 'faol').order('nom'),
    supabase.from('leads').select('holat'),
  ])

  const royxat = (data ?? []) as unknown as Probniy[]
  const gList = guruhlar ?? []
  const soni = (b: Bolim) =>
    ((sonlar ?? []) as { holat: LeadStatus }[]).filter((x) => BOLIMLAR[b].holatlar.includes(x.holat)).length

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Probniylar" izoh="sinov darsiga yozilganlar" />
      <Xabar ok={s.ok} xato={s.xato} />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(BOLIMLAR) as Bolim[]).map((b) => (
          <Link
            key={b}
            href={b === 'kutilmoqda' ? '/crm/probniylar' : `/crm/probniylar?bolim=${b}`}
            className={`flex min-h-11 items-center gap-2 rounded-[9px] border px-4 text-[13px] transition ${
              bolim === b ? 'border-brand bg-brand-soft text-ink' : 'border-line text-ink-3 hover:text-ink'
            }`}
          >
            {BOLIMLAR[b].nom}
            <span className="tnum font-[family-name:var(--font-mono)] text-[11px] text-ink-3">{soni(b)}</span>
          </Link>
        ))}
      </div>

      <Card className="flex flex-col">
        <details open={soni('kutilmoqda') === 0}>
          <summary className="flex min-h-12 cursor-pointer items-center px-5 font-[family-name:var(--font-display)] text-[15px] font-bold">
            + Yangi probniy
          </summary>
          <form action={probniyQosh} className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2">
            <input type="hidden" name="qaytish" value={yol} />
            <Maydon nom="Ism familya">
              <input name="ism" required className={kirishKlass} />
            </Maydon>
            <Maydon nom="Telefon">
              <input name="telefon" type="tel" required placeholder="90 123 45 67" className={kirishKlass} />
            </Maydon>
            <Maydon nom="Guruh" izoh="Doimiy qilish uchun kerak">
              <select name="group_id" defaultValue="" className={kirishKlass}>
                <option value="">Hali tanlanmagan</option>
                {gList.map((g) => (
                  <option key={g.id} value={g.id}>{g.nom}</option>
                ))}
              </select>
            </Maydon>
            <Maydon nom="Sinov darsi kuni">
              <input name="sinov_sana" type="date" defaultValue={bugun} className={kirishKlass} />
            </Maydon>
            <Maydon nom="Tug‘ilgan sana">
              <input name="tugilgan_sana" type="date" max={bugun} className={kirishKlass} />
            </Maydon>
            <Maydon nom="Qayerdan bildi">
              <select name="manba" defaultValue="boshqa" className={kirishKlass}>
                <option value="tavsiya">Tanishlar tavsiyasi</option>
                <option value="instagram">Instagram</option>
                <option value="telegram">Telegram</option>
                <option value="sayt">Sayt</option>
                <option value="boshqa">Boshqa</option>
              </select>
            </Maydon>
            <Maydon nom="Izoh" className="sm:col-span-2">
              <input name="izoh" placeholder="Ixtiyoriy" className={kirishKlass} />
            </Maydon>
            <Yuborish className="sm:col-span-2">Probniyga yozish</Yuborish>
          </form>
        </details>
      </Card>

      <Card className="flex flex-col">
        <CardHeader title={BOLIMLAR[bolim].nom} meta={`${royxat.length} ta`} />
        {royxat.length === 0 ? (
          <div className="px-5 pb-5">
            <Empty>Bu bo‘limda hech kim yo‘q.</Empty>
          </div>
        ) : (
          <ul>
            {royxat.map((p) => {
              const bugunmi = p.sinov_sana === bugun
              return (
                <li key={p.id} className="flex flex-col gap-2.5 border-t border-line-soft px-5 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[13.5px] font-semibold">{p.ism}</span>
                      <span className="text-[12px] text-ink-3">
                        {p.groups?.nom ?? 'guruh tanlanmagan'}
                        {p.sinov_sana ? ` · sinov ${sana(p.sinov_sana)}` : ''}
                      </span>
                      {p.izoh && <span className="text-[12px] text-ink-3">{p.izoh}</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      {bugunmi && bolim === 'kutilmoqda' && <Badge ton="accent" nuqta>bugun</Badge>}
                      {p.student_id && (
                        <Link href={`/crm/oquvchilar/${p.student_id}`} className="text-[12.5px] text-accent hover:text-brand">
                          {p.student_id} →
                        </Link>
                      )}
                      <a
                        href={`tel:${p.telefon}`}
                        title={telefon(p.telefon)}
                        aria-label={`${p.ism}ga qo‘ng‘iroq`}
                        className="flex size-11 items-center justify-center rounded-[9px] border border-line text-ink-3 hover:text-ink"
                      >
                        <IconPhone size={16} />
                      </a>
                    </span>
                  </div>

                  {!p.student_id && (
                    <div className="flex flex-wrap items-center gap-2">
                      {p.group_id ? (
                        <details>
                          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-[9px] border border-ok bg-ok-soft px-4 text-[13px] font-semibold text-ok">
                            Doimiy qilish
                          </summary>
                          <form action={probniyDoimiy} className="mt-2 flex flex-wrap items-end gap-2">
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="qaytish" value={yol} />
                            <Maydon nom="Boshlagan sana">
                              <input type="date" name="boshlandi" defaultValue={bugun} className={kirishKlass} />
                            </Maydon>
                            <Yuborish tur="ok" kutish="…">O‘quvchi qilish</Yuborish>
                          </form>
                        </details>
                      ) : null}

                      <details>
                        <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-[9px] border border-line px-4 text-[13px] text-ink-3 hover:text-ink">
                          {p.group_id ? 'Guruhni o‘zgartirish' : 'Guruh tanlash'}
                        </summary>
                        <form action={probniyGuruh} className="mt-2 flex flex-wrap items-end gap-2">
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="qaytish" value={yol} />
                          <Maydon nom="Guruh">
                            <select name="group_id" defaultValue={p.group_id ?? ''} className={kirishKlass}>
                              <option value="">—</option>
                              {gList.map((g) => (
                                <option key={g.id} value={g.id}>{g.nom}</option>
                              ))}
                            </select>
                          </Maydon>
                          <Maydon nom="Sinov kuni">
                            <input type="date" name="sinov_sana" defaultValue={p.sinov_sana ?? ''} className={kirishKlass} />
                          </Maydon>
                          <Yuborish tur="ikkilamchi" kutish="…">Saqlash</Yuborish>
                        </form>
                      </details>

                      {(['kelmadi', 'rad', 'yangi'] as const)
                        .filter((h) => !BOLIMLAR[bolim].holatlar.includes(h))
                        .map((h) => (
                          <form key={h} action={probniyHolat}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="holat" value={h} />
                            <input type="hidden" name="qaytish" value={yol} />
                            <Yuborish tur={h === 'yangi' ? 'ikkilamchi' : 'xavfli'} kutish="…">
                              {h === 'kelmadi' ? 'Kelmadi' : h === 'rad' ? 'Rad etdi' : 'Qaytadan kutish'}
                            </Yuborish>
                          </form>
                        ))}
                    </div>
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

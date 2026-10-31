import Link from 'next/link'
import { talabProfil, getUstoz, staffmi, ustozRejimi } from '@/lib/auth'
import { JonliForma } from '@/components/jonli-forma'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { bugunToshkent, sana } from '@/lib/format'
import { xatoMatni } from '@/lib/kiritish'
import { royxatOl, royxatNomi } from '@/lib/royxat'
import type { WoblrTarixQatori } from '@/lib/types'

export const metadata = { title: 'Woblar tarixi' }

/**
 * Woblar tarixi (0071, woblr_tarix): kim, kimga, qaysi dars/guruhda,
 * nechta va nima uchun. Kim nimani ko'rishini baza hal qiladi:
 *   • o'quvchi / ota-ona — o'ziniki;
 *   • ustoz — o'zi bergan woblar;
 *   • xodim — hammasi, ustoz / o'quvchi / guruh filtri va "kim qancha berdi".
 */

type Qidiruv = { dan?: string; gacha?: string; kim?: string; oquvchi?: string; guruh?: string }

const ishora = (n: number) => (n > 0 ? `+${n}` : String(n))

export default async function WoblarTarixi({ searchParams }: { searchParams: Promise<Qidiruv> }) {
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Woblar tarixi" />
  const profil = await talabProfil()
  const ustoz = await getUstoz()
  const s = await searchParams
  const supabase = await createClient()
  const sabablar = await royxatOl(supabase, 'woblar_sabab')
  const xodim = staffmi(profil.rol)
  const ustozmi = !xodim && Boolean(ustoz)

  // Standart — oxirgi 30 kun
  const bugun = bugunToshkent()
  const oy = new Date(Date.now() - 30 * 86400000)
  const dan = s.dan || bugunToshkent(oy)
  const gacha = s.gacha || bugun

  const [{ data, error }, ustozlar, oquvchilar, guruhlar] = await Promise.all([
    supabase.rpc('woblr_tarix', {
      p_dan: dan,
      p_gacha: gacha,
      // Xodim "Ustoz" rolida — faqat o'zi bergan woblar (oddiy ustozga buni RLS qiladi)
      p_bergan: xodim && s.kim ? s.kim : ustozRejimi(profil) ? profil.id : null,
      p_student: xodim && s.oquvchi ? s.oquvchi : null,
      p_group: (xodim || ustozmi) && s.guruh ? s.guruh : null,
      p_limit: 1000,
    }),
    xodim
      ? supabase.from('profiles').select('id, ism, rol').in('rol', ['admin', 'direktor', 'manager', 'ustoz']).eq('holat', 'faol').order('ism')
      : Promise.resolve({ data: [] }),
    xodim ? supabase.from('students').select('id, fish').eq('holat', 'faol').order('fish') : Promise.resolve({ data: [] }),
    xodim || ustozmi
      ? ustozRejimi(profil) && ustoz
        ? supabase.from('groups').select('id, nom').eq('holat', 'faol').eq('teacher_id', ustoz.id).order('nom')
        : supabase.from('groups').select('id, nom').eq('holat', 'faol').order('nom')
      : Promise.resolve({ data: [] }),
  ])
  const qatorlar = (data ?? []) as WoblrTarixQatori[]

  const jami = qatorlar.reduce((a, q) => a + q.ball, 0)
  const bolalar = new Set(qatorlar.map((q) => q.student_id)).size

  // Kim qancha berdi (xodim uchun)
  const kimlar = new Map<string, { nom: string; soni: number; plus: number; minus: number; bolalar: Set<string> }>()
  if (xodim) {
    for (const q of qatorlar) {
      const k = q.bergan_profile ?? q.bergan
      const x = kimlar.get(k) ?? { nom: q.bergan, soni: 0, plus: 0, minus: 0, bolalar: new Set<string>() }
      x.soni++
      if (q.ball > 0) x.plus += q.ball
      else x.minus += q.ball
      x.bolalar.add(q.student_id)
      kimlar.set(k, x)
    }
  }
  const kimRoyxat = [...kimlar.values()].sort((a, b) => b.plus - a.plus)

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Woblar tarixi"
        izoh={xodim ? 'kim, kimga, qaysi darsda, nechta' : ustozmi ? 'siz bergan woblar' : 'siz olgan woblar'}
        amal={
          <Link href="/crm/woblr" className="text-[12.5px] text-accent hover:text-brand">
            Reytingga →
          </Link>
        }
      />

      <Xabar xato={error ? xatoMatni(error) : undefined} />

      <JonliForma className="flex flex-wrap items-end gap-2.5">
        <Maydon nom="Dan">
          <input type="date" name="dan" defaultValue={dan} max={bugun} className={kirishKlass} />
        </Maydon>
        <Maydon nom="Gacha">
          <input type="date" name="gacha" defaultValue={gacha} max={bugun} className={kirishKlass} />
        </Maydon>
        {xodim && (
          <Maydon nom="Kim berdi">
            <select name="kim" defaultValue={s.kim ?? ''} className={kirishKlass}>
              <option value="">Hammasi</option>
              {((ustozlar.data ?? []) as { id: string; ism: string | null }[]).map((u) => (
                <option key={u.id} value={u.id}>{u.ism ?? '—'}</option>
              ))}
            </select>
          </Maydon>
        )}
        {xodim && (
          <Maydon nom="O‘quvchi">
            <select name="oquvchi" defaultValue={s.oquvchi ?? ''} className={kirishKlass}>
              <option value="">Hammasi</option>
              {((oquvchilar.data ?? []) as { id: string; fish: string }[]).map((o) => (
                <option key={o.id} value={o.id}>{o.fish}</option>
              ))}
            </select>
          </Maydon>
        )}
        {(xodim || ustozmi) && (
          <Maydon nom="Guruh">
            <select name="guruh" defaultValue={s.guruh ?? ''} className={kirishKlass}>
              <option value="">Hammasi</option>
              {((guruhlar.data ?? []) as { id: string; nom: string }[]).map((g) => (
                <option key={g.id} value={g.id}>{g.nom}</option>
              ))}
            </select>
          </Maydon>
        )}
      </JonliForma>

      {xodim && kimRoyxat.length > 0 && (
        <Card className="flex flex-col">
          <CardHeader title="Kim qancha berdi" meta={`${sana(dan)} – ${sana(gacha)}`} />
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11.5px] text-ink-3">
                <tr>
                  <th className="px-5 py-2 font-medium">Kim</th>
                  <th className="px-3 py-2 text-right font-medium">Berishlar</th>
                  <th className="px-3 py-2 text-right font-medium">Bolalar</th>
                  <th className="px-3 py-2 text-right font-medium">Berdi</th>
                  <th className="px-5 py-2 text-right font-medium">Ayirdi</th>
                </tr>
              </thead>
              <tbody>
                {kimRoyxat.map((k) => (
                  <tr key={k.nom} className="border-t border-line-soft">
                    <td className="px-5 py-2.5 font-semibold">{k.nom}</td>
                    <td className="tnum px-3 py-2.5 text-right">{k.soni}</td>
                    <td className="tnum px-3 py-2.5 text-right">{k.bolalar.size}</td>
                    <td className="tnum px-3 py-2.5 text-right text-accent">+{k.plus}</td>
                    <td className="tnum px-5 py-2.5 text-right text-ink-3">{k.minus || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="flex flex-col">
        <CardHeader
          title="Tarix"
          meta={
            xodim || ustozmi
              ? `${qatorlar.length} ta · ${bolalar} bola · jami ${ishora(jami)} W`
              : `${qatorlar.length} ta · jami ${ishora(jami)} W`
          }
        />
        {qatorlar.length === 0 ? (
          <div className="px-5 pb-5">
            <Empty>Bu davrda woblar yo‘q.</Empty>
          </div>
        ) : (
          <ul>
            {qatorlar.map((q) => {
              const vaqt = new Date(q.vaqt).toLocaleString('uz-UZ', {
                timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
              })
              return (
                <li key={q.id} className="flex items-start gap-3 border-t border-line-soft px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      {(xodim || ustozmi) && (
                        xodim ? (
                          <Link href={`/crm/oquvchilar/${q.student_id}`} className="truncate text-[13.5px] font-semibold hover:text-brand">
                            {q.fish}
                          </Link>
                        ) : (
                          <span className="truncate text-[13.5px] font-semibold">{q.fish}</span>
                        )
                      )}
                      {!xodim && !ustozmi && (
                        <span className="truncate text-[13.5px] font-semibold">{q.fan ?? q.guruh ?? 'Woblar'}</span>
                      )}
                      <span className="text-[12px] text-ink-3">{royxatNomi(sabablar, q.sabab)}</span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-ink-3">
                      {vaqt}
                      {q.dars_sana ? ' · darsda' : ''}
                      {(xodim || ustozmi) && q.guruh ? ` · ${q.guruh}` : ''}
                      {!ustozmi ? ` · ${q.bergan}` : ''}
                    </div>
                    {q.izoh && <div className="mt-0.5 text-[12.5px] text-ink-2">{q.izoh}</div>}
                  </div>
                  <Badge ton={q.ball > 0 ? 'accent' : 'brand'}>{ishora(q.ball)} W</Badge>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

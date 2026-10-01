import Link from 'next/link'
import { talabRol, getUstoz, staffmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { vaqt, HAFTA_KUNLARI, haftaKuni, bugunToshkent } from '@/lib/format'
import { haftalikJadval, type JadvalGuruh } from '@/lib/jadval'

export const metadata = { title: 'Dars jadvali' }
export const dynamic = 'force-dynamic'

/**
 * Haftalik dars jadvali (LevelUp "Schedule" o'rni). Faol guruhlar hafta
 * kunlari bo'yicha, vaqt tartibida. Bitta ustozning darslari ustma-ust
 * tushsa — ogohlantirish. Ustozga RLS faqat o'z guruhlarini beradi.
 * Xonalar hozircha yo'q (LevelUp'dagi xona taqsimoti — keyingi qadam).
 */
export default async function DarsJadvali() {
  const profil = await talabRol('admin', 'direktor', 'qabulxona', 'ustoz')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Dars jadvali" />

  const ustoz = await getUstoz()
  const supabase = await createClient()
  const [{ data: guruhlar }, { data: yozilishlar }] = await Promise.all([
    supabase.from('groups').select('id, nom, kunlar, boshlanish, tugash, teacher_id, teachers(ism)').eq('holat', 'faol'),
    supabase.from('enrollments').select('group_id').neq('holat', 'tugagan'),
  ])

  const soni = new Map<string, number>()
  for (const y of (yozilishlar ?? []) as { group_id: string }[]) soni.set(y.group_id, (soni.get(y.group_id) ?? 0) + 1)

  type Xom = Omit<JadvalGuruh, 'ustoz' | 'oquvchilar'> & { teachers: { ism: string } | null }
  const jadval = haftalikJadval(
    ((guruhlar ?? []) as unknown as Xom[]).map((g) => ({
      id: g.id,
      nom: g.nom,
      kunlar: g.kunlar,
      boshlanish: g.boshlanish,
      tugash: g.tugash,
      teacher_id: g.teacher_id,
      ustoz: g.teachers?.ism ?? null,
      oquvchilar: soni.get(g.id) ?? 0,
    })),
  )

  const bugun = haftaKuni(bugunToshkent())
  const toqnashlar = jadval.reduce((a, k) => a + k.darslar.filter((d) => d.toqnash.length).length, 0)
  const jamiDars = jadval.reduce((a, k) => a + k.darslar.length, 0)
  const xodim = staffmi(profil.rol)

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Dars jadvali"
        izoh={`${xodim ? 'Barcha faol guruhlar' : `Guruhlarim${ustoz ? ` · ${ustoz.ism}` : ''}`} · haftada ${jamiDars} ta dars`}
        amal={toqnashlar ? <Badge ton="brand">{toqnashlar} ta to‘qnashuv</Badge> : undefined}
      />

      {jamiDars === 0 ? (
        <Card className="p-5">
          <Empty>Faol guruh yo‘q.</Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
          {jadval
            .filter((k) => k.darslar.length > 0 || k.kun <= 6)
            .map((k) => {
              const nom = HAFTA_KUNLARI[k.kun - 1].nom
              return (
                <Card key={k.kun} className={`flex flex-col ${k.kun === bugun ? 'border-brand-line' : ''}`}>
                  <CardHeader
                    title={k.kun === bugun ? `${nom} · bugun` : nom}
                    meta={k.darslar.length ? `${k.darslar.length} ta dars` : 'dars yo‘q'}
                  />
                  <ul className="flex flex-col gap-1.5 px-3 pb-3">
                    {k.darslar.map((d) => (
                      <li key={d.id}>
                        <Link
                          href={`/crm/davomat/${d.id}`}
                          className={`flex flex-col gap-0.5 rounded-[9px] border px-3 py-2 transition hover:border-ink-3 ${
                            d.toqnash.length ? 'border-brand-line bg-brand-soft' : 'border-line-soft'
                          }`}
                        >
                          <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-ink-3">
                            {vaqt(d.boshlanish)}–{vaqt(d.tugash)} · {d.oquvchilar} o‘quvchi
                          </span>
                          <span className="truncate text-[13px] font-semibold">{d.nom}</span>
                          {xodim && <span className="truncate text-[12px] text-ink-2">{d.ustoz ?? '[ustoz yo‘q]'}</span>}
                          {d.toqnash.length > 0 && (
                            <span className="text-[11.5px] text-brand">Ustoz bir vaqtda: {d.toqnash.join(', ')}</span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )
            })}
        </div>
      )}
    </div>
  )
}

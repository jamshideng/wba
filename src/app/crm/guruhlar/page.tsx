import Link from 'next/link'
import { talabRol, getUstoz, staffmi, adminmi, ustozRejimi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Badge, Empty, Button } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { pul, jadval, vaqt, kunlarNomi, KUN_NOMI, guruhQisqa } from '@/lib/format'
import type { DayType } from '@/lib/types'

export const metadata = { title: 'Guruhlar' }
export const dynamic = 'force-dynamic'

export default async function Guruhlar() {
  const profil = await talabRol('admin', 'direktor', 'qabulxona', 'ustoz')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Guruhlar" />

  const ustoz = await getUstoz()
  const pulKoradi = staffmi(profil.rol)
  const supabase = await createClient()

  /* RLS ustozga faqat o'z guruhlarini beradi — bu yerda qo'shimcha
     filtr shart emas, sarlavha esa kimligiga qarab o'zgaradi. */
  let sorov = supabase
    .from('groups')
    .select('id, nom, boshlanish, tugash, kunlar, oylik_narx, holat, teachers(ism)')
    .order('holat')
    .order('nom')
  // Xodim "Ustoz" rolida — faqat o'z guruhlari (RLS unga hammasini beradi)
  if (ustozRejimi(profil) && ustoz) sorov = sorov.eq('teacher_id', ustoz.id)
  const { data: guruhlar } = await sorov

  type Guruh = {
    id: string
    nom: string
    boshlanish: string
    tugash: string
    kunlar: number[]
    oylik_narx: number
    holat: string
    teachers: { ism: string } | null
  }

  const gList = (guruhlar ?? []) as unknown as Guruh[]
  const idlar = gList.map((g) => g.id)

  const { data: stats } = idlar.length
    ? await supabase.from('v_group_stats').select('group_id, oquvchilar, tushum, qarz').in('group_id', idlar)
    : { data: [] }

  const sMap = new Map(
    ((stats ?? []) as { group_id: string; oquvchilar: number; tushum: number; qarz: number }[]).map((s) => [
      s.group_id,
      s,
    ]),
  )

  /* Ustoz paneli: fan nomi katta, ism yo'q (o'ziniki), vaqt va kunlar pastda katta */
  const ustozKarta = !pulKoradi || ustozRejimi(profil)

  const faol = gList.filter((g) => g.holat === 'faol').length

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom={ustoz && !pulKoradi ? 'Guruhlarim' : 'Guruhlar'}
        izoh={`${faol} ta faol guruh${gList.length > faol ? ` · ${gList.length - faol} ta yopilgan` : ''}`}
        amal={adminmi(profil.rol) ? <Button href="/crm/guruhlar/yangi">Guruh ochish</Button> : undefined}
      />

      {gList.length === 0 ? (
        <Card className="p-5">
          <Empty>
            {ustoz
              ? 'Sizga hali guruh biriktirilmagan.'
              : 'Hali guruh yo‘q. Ko‘chirish skripti ishga tushirilsa shu yerda ko‘rinadi.'}
          </Empty>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {gList.map((g) => {
            const s = sMap.get(g.id)
            const qarz = Number(s?.qarz ?? 0)
            if (ustozKarta) {
              const kun = Array.isArray(g.kunlar) ? kunlarNomi(g.kunlar) : KUN_NOMI[(g.kunlar as DayType | null) ?? 'har_kuni']
              return (
                <li key={g.id}>
                  <Link
                    href={`/crm/guruhlar/${g.id}`}
                    className="flex h-full flex-col gap-4 rounded-[12px] border border-line bg-surface p-5 transition hover:border-ink-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 truncate font-[family-name:var(--font-display)] text-[20px] font-bold leading-tight">
                        {guruhQisqa(g.nom)}
                      </span>
                      {g.holat !== 'faol' && <Badge ton="jim">Yopilgan</Badge>}
                    </div>

                    <span className="flex items-baseline gap-1.5 text-ink-2">
                      <span className="tnum text-[15px] font-semibold text-ink">{Number(s?.oquvchilar ?? 0)}</span>
                      <span className="text-[13px]">o‘quvchi</span>
                    </span>

                    <div className="mt-auto flex flex-col gap-1 border-t border-line-soft pt-3.5">
                      <span className="tnum font-[family-name:var(--font-mono)] text-[18px] font-semibold">
                        {g.boshlanish && g.tugash ? `${vaqt(g.boshlanish)}–${vaqt(g.tugash)}` : '—'}
                      </span>
                      <span className="text-[14px] text-ink-2">{kun}</span>
                    </div>
                  </Link>
                </li>
              )
            }
            return (
              <li key={g.id}>
                <Link
                  href={`/crm/guruhlar/${g.id}`}
                  className="flex h-full flex-col gap-3 rounded-[12px] border border-line bg-surface p-4 transition hover:border-ink-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-[14px] font-semibold">{guruhQisqa(g.nom)}</span>
                      <span className="text-[12px] text-ink-3">
                        {g.teachers?.ism ?? '[ANIQLANMAGAN]'}
                      </span>
                    </span>
                    {g.holat !== 'faol' && <Badge ton="jim">Yopilgan</Badge>}
                  </div>

                  <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-ink-2">
                    {jadval(g.boshlanish, g.tugash, g.kunlar)}
                  </span>

                  <div className="mt-auto flex items-end justify-between gap-3 border-t border-line-soft pt-3">
                    <span className="flex flex-col gap-0.5">
                      <span className="lbl">O‘quvchi</span>
                      <span className="tnum font-[family-name:var(--font-display)] text-[19px] font-bold">
                        {Number(s?.oquvchilar ?? 0)}
                      </span>
                    </span>

                    {pulKoradi && (
                      <span className="flex flex-col items-end gap-0.5">
                        <span className="lbl">oyiga {pul(g.oylik_narx)}</span>
                        <span
                          className={`tnum font-[family-name:var(--font-mono)] text-[12.5px] ${
                            qarz > 0 ? 'text-brand' : 'text-ok'
                          }`}
                        >
                          {qarz > 0 ? `qarz ${pul(qarz)}` : 'qarzi yo‘q'}
                        </span>
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar } from '@/components/forma'
import { sana } from '@/lib/format'
import { KIMLAR } from '@/lib/elon'
import { BTUR_NOMI } from '@/lib/bildirishnoma'
import type { Bildirishnoma, TelegramKim } from '@/lib/types'
import { BildirishnomaForma } from './forma'
import { bildirishnomaHolat, bildirishnomaOchir } from './actions'

export const metadata = { title: 'Bildirishnomalar' }
export const dynamic = 'force-dynamic'

const KIM_NOMI = Object.fromEntries(KIMLAR.map((k) => [k.qiymat, k.nom])) as Record<TelegramKim, string>

/**
 * Sayt ichidagi bildirishnomalar (0047) — admin e'lon qiladi, kimga
 * ko'rinishini tanlaydi; foydalanuvchiga saytga kirganda tepadan chiqadi.
 * Telegram e'loni — alohida ("Xabarlar" bo'limi).
 */
export default async function Bildirishnomalar({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  await talabRol('admin', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Bildirishnomalar" />
  const s = await searchParams

  const supabase = await createClient()
  const [{ data: royxat }, { data: stat }, { data: guruhlar }] = await Promise.all([
    supabase.from('bildirishnomalar').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.rpc('bildirishnoma_statistika'),
    supabase.from('groups').select('id, nom, subject_id, subjects(nom)').eq('holat', 'faol').order('nom'),
  ])
  const bList = (royxat ?? []) as Bildirishnoma[]
  const statMap = new Map(((stat ?? []) as { bildirishnoma_id: number; korgan: number; yopgan: number; javob_bergan: number }[]).map((x) => [x.bildirishnoma_id, x]))

  // So'rovnoma natijalari (admin har doim ko'radi)
  const sorovlar = bList.filter((b) => b.turi === 'sorovnoma')
  const natijalar = new Map<number, { variant_id: number; matn: string; ovoz: number; jami: number }[]>()
  await Promise.all(sorovlar.map(async (b) => {
    const { data } = await supabase.rpc('sorovnoma_natija', { p_id: b.id })
    natijalar.set(b.id, (data ?? []) as { variant_id: number; matn: string; ovoz: number; jami: number }[])
  }))

  type G = { id: string; nom: string; subject_id: string | null; subjects: { nom: string } | null }
  const gList = (guruhlar ?? []) as unknown as G[]
  const fanlar = [...new Map(gList.filter((g) => g.subject_id).map((g) => [g.subject_id!, g.subjects?.nom ?? g.subject_id!]))]
    .sort((a, b) => a[1].localeCompare(b[1], 'uz')) as [string, string][]
  const guruhNomi = new Map(gList.map((g) => [g.id, g.nom]))
  const fanNomi = new Map(fanlar)
  const kimlar = (b: Bildirishnoma) => {
    const f = b.filtr as { guruh?: string; fan?: string; qarzdor?: boolean }
    const qism = b.kimga.map((k) => KIM_NOMI[k]).join(', ')
    const filtr = f.guruh ? ` · ${guruhNomi.get(f.guruh) ?? f.guruh}` : f.fan ? ` · ${fanNomi.get(f.fan) ?? f.fan}` : f.qarzdor ? ' · qarzdorlar' : ''
    return qism + filtr
  }
  const hozir = Date.now()
  const holatNomi = (b: Bildirishnoma): [string, 'ok' | 'jim' | 'accent'] =>
    b.holat !== 'faol' ? ['yopilgan', 'jim']
    : Date.parse(b.boshlanish) > hozir ? ['rejada', 'accent']
    : b.tugash && Date.parse(b.tugash) <= hozir ? ['muddati tugagan', 'jim']
    : ['faol', 'ok']

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Bildirishnomalar" izoh="saytga kirganda tepadan chiqadigan eslatma, e’lon, reklama va so‘rovnomalar" />
      <Xabar ok={s.ok} xato={s.xato} />

      <Card className="flex flex-col gap-4 p-5">
        <h2 className="h-display text-[18px]">Yangi bildirishnoma</h2>
        <BildirishnomaForma guruhlar={gList.map((g) => ({ id: g.id, nom: g.nom }))} fanlar={fanlar} />
      </Card>

      <Card className="flex flex-col">
        <CardHeader title="Berilganlar" meta="ko‘rdi · yopdi · javob berdi" />
        {bList.length === 0 ? (
          <div className="px-5 pb-5"><Empty>Hali bildirishnoma yo‘q.</Empty></div>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {bList.map((b) => {
              const st = statMap.get(b.id)
              const [hn, ht] = holatNomi(b)
              const nat = natijalar.get(b.id)
              return (
                <li key={b.id} className="flex flex-col gap-2.5 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge ton="brand">{BTUR_NOMI[b.turi]}</Badge>
                        <Badge ton={ht}>{hn}</Badge>
                        {b.muhim && <Badge ton="accent">muhim</Badge>}
                      </span>
                      <span className="text-[14.5px] font-bold">{b.sarlavha}</span>
                      <span className="text-[12px] text-ink-3">
                        {kimlar(b)} · {sana(b.created_at)}{b.tugash ? ` → ${sana(b.tugash)} gacha` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="tnum flex gap-3 text-[12px] text-ink-3">
                        <span><b className="text-ink">{st?.korgan ?? 0}</b> ko‘rdi</span>
                        <span><b className="text-ink">{st?.yopgan ?? 0}</b> yopdi</span>
                        {b.turi === 'sorovnoma' && <span><b className="text-ink">{st?.javob_bergan ?? 0}</b> javob</span>}
                      </span>
                      <form action={bildirishnomaHolat}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="holat" value={b.holat === 'faol' ? 'yopilgan' : 'faol'} />
                        <button type="submit" className="min-h-10 rounded-[9px] border border-line px-3 text-[12.5px] text-ink-2 hover:border-ink-3 hover:text-ink">
                          {b.holat === 'faol' ? 'Yopish' : 'Qayta ochish'}
                        </button>
                      </form>
                      <form action={bildirishnomaOchir}>
                        <input type="hidden" name="id" value={b.id} />
                        <button type="submit" aria-label="O‘chirish" title="O‘chirish (javoblari bilan)" className="min-h-10 rounded-[9px] border border-line px-3 text-[12.5px] text-ink-3 hover:border-brand hover:text-brand">
                          O‘chirish
                        </button>
                      </form>
                    </div>
                  </div>
                  {b.matn && <p className="max-w-3xl text-[12.5px] leading-relaxed whitespace-pre-line text-ink-2">{b.matn}</p>}
                  {nat && nat.length > 0 && (
                    <ul className="flex max-w-xl flex-col gap-1.5">
                      {nat.map((n) => {
                        const f = n.jami ? Math.round((n.ovoz * 100) / n.jami) : 0
                        return (
                          <li key={n.variant_id} className="relative overflow-hidden rounded-[8px] border border-line px-3 py-1.5 text-[12.5px]">
                            <span className="absolute inset-y-0 left-0 bg-brand-soft" style={{ width: `${f}%` }} />
                            <span className="relative flex justify-between gap-2">
                              <span>{n.matn}</span>
                              <b className="tnum">{n.ovoz} · {f}%</b>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
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

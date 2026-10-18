import Link from 'next/link'
import { talabRol, getUstoz, staffmi, ustozRejimi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { vaqt, HAFTA_KUNLARI, haftaKuni, bugunToshkent, guruhQisqa } from '@/lib/format'
import { haftalikJadval, yolaklar, type JadvalGuruh } from '@/lib/jadval'

export const metadata = { title: 'Dars jadvali' }
export const dynamic = 'force-dynamic'

/**
 * Haftalik dars jadvali (LevelUp "Schedule" o'rni). Faol guruhlar hafta
 * kunlari bo'yicha, vaqt tartibida. Bitta ustozning darslari ustma-ust
 * tushsa — ogohlantirish. Ustozga RLS faqat o'z guruhlarini beradi.
 * Xonalar hozircha yo'q (LevelUp'dagi xona taqsimoti — keyingi qadam).
 * Ko'rinish — Excel kabi setka: ustunlar hafta kunlari, qatorlar soatlar,
 * guruh kartasi o'z kuni va vaqtiga joylashadi (Jamshid, 18.10).
 */

/** Bir soat balandligi (px) */
const SOAT = 72
/** Fan bo'yicha rang — bir fan har kuni bir xil rangda */
const RANGLAR = ['var(--color-osmon)', 'var(--color-binafsha)', 'var(--color-firuza)', 'var(--color-accent)', 'var(--color-ok)', 'var(--color-bronza)']

/** Toshkent vaqti bo'yicha hozirgi daqiqa (0–1439) */
function hozirToshkent(): number {
  const [s, d] = new Date()
    .toLocaleTimeString('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false })
    .split(':')
    .map(Number)
  return (s % 24) * 60 + d
}
export default async function DarsJadvali() {
  const profil = await talabRol('admin', 'direktor', 'qabulxona', 'ustoz')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Dars jadvali" />

  const ustoz = await getUstoz()
  const supabase = await createClient()
  const [{ data: guruhlar }, { data: yozilishlar }] = await Promise.all([
    // Xodim "Ustoz" rolida — faqat o'z guruhlari
    ustozRejimi(profil) && ustoz
      ? supabase.from('groups').select('id, nom, kunlar, boshlanish, tugash, teacher_id, teachers(ism)').eq('holat', 'faol').eq('teacher_id', ustoz.id)
      : supabase.from('groups').select('id, nom, kunlar, boshlanish, tugash, teacher_id, teachers(ism)').eq('holat', 'faol'),
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

  // Yakshanba faqat darsi bo'lsa ko'rinadi
  const kunlar = jadval.filter((k) => k.darslar.length > 0 || k.kun <= 6)
  // Setka soatlari: eng erta darsdan eng kech darsgacha (kamida 08:00–20:00)
  let boshSoat = 8
  let oxirSoat = 20
  const fanRangi = new Map<string, number>()
  for (const k of jadval)
    for (const d of yolaklar(k.darslar)) {
      boshSoat = Math.min(boshSoat, Math.floor(d.bosh / 60))
      oxirSoat = Math.max(oxirSoat, Math.ceil(d.oxir / 60))
      const fan = guruhQisqa(d.nom)
      if (!fanRangi.has(fan)) fanRangi.set(fan, fanRangi.size % RANGLAR.length)
    }
  const soatlar = Array.from({ length: oxirSoat - boshSoat }, (_, i) => boshSoat + i)
  const hozir = hozirToshkent()

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
        <Card className="overflow-hidden">
          {/* Telefonda setka o'z ichida suriladi (sahifa emas); soat ustuni joyida qoladi */}
          <div className="overflow-x-auto">
            <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `56px repeat(${kunlar.length}, minmax(0, 1fr))` }}>
              {/* Sarlavha qatori — kunlar */}
              <div className="sticky left-0 z-30 border-b border-line bg-surface" />
              {kunlar.map((k) => (
                <div
                  key={k.kun}
                  className={`flex flex-col items-center gap-0.5 border-b border-l border-line px-2 py-2.5 text-center ${
                    k.kun === bugun ? 'bg-brand-soft' : 'bg-surface'
                  }`}
                >
                  <span className={`text-[13px] font-bold ${k.kun === bugun ? 'text-brand' : ''}`}>{HAFTA_KUNLARI[k.kun - 1].nom}</span>
                  <span className="text-[11px] text-ink-3">
                    {k.kun === bugun ? 'bugun · ' : ''}
                    {k.darslar.length ? `${k.darslar.length} ta dars` : 'dars yo‘q'}
                  </span>
                </div>
              ))}

              {/* Soatlar ustuni */}
              <div className="sticky left-0 z-30 border-r border-line bg-surface" style={{ height: soatlar.length * SOAT }}>
                {soatlar.map((h, i) => (
                  <span
                    key={h}
                    className="tnum absolute right-2 font-[family-name:var(--font-mono)] text-[11.5px] text-ink-3"
                    style={{ top: i * SOAT + 4 }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </span>
                ))}
              </div>

              {/* Kun ustunlari: soat chiziqlari (to'liq soat — qalin, yarim — ingichka) va darslar */}
              {kunlar.map((k) => (
                <div
                  key={k.kun}
                  className={`relative border-l border-line ${k.kun === bugun ? 'bg-brand-soft/30' : ''}`}
                  style={{
                    height: soatlar.length * SOAT,
                    backgroundImage: `linear-gradient(to bottom, var(--color-line) 1px, transparent 1px), linear-gradient(to bottom, var(--color-line-soft) 1px, transparent 1px)`,
                    backgroundSize: `100% ${SOAT}px, 100% ${SOAT / 2}px`,
                  }}
                >
                  {k.kun === bugun && hozir >= boshSoat * 60 && hozir <= oxirSoat * 60 && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                      style={{ top: ((hozir - boshSoat * 60) / 60) * SOAT - 4 }}
                      aria-label="Hozirgi vaqt"
                    >
                      <span className="size-2 shrink-0 rounded-full bg-brand" />
                      <span className="h-0.5 flex-1 bg-brand" />
                    </div>
                  )}
                  {yolaklar(k.darslar).map((d) => {
                    const rang = RANGLAR[fanRangi.get(guruhQisqa(d.nom)) ?? 0]
                    const top = ((d.bosh - boshSoat * 60) / 60) * SOAT
                    const h = Math.max(((d.oxir - d.bosh) / 60) * SOAT, 30)
                    const toq = d.toqnash.length > 0
                    return (
                      <Link
                        key={d.id}
                        href={`/crm/davomat/${d.id}`}
                        title={`${guruhQisqa(d.nom)} · ${vaqt(d.boshlanish)}–${vaqt(d.tugash)} · ${d.oquvchilar} o‘quvchi${
                          xodim && d.ustoz ? ` · ${d.ustoz}` : ''
                        }${toq ? ` · ustoz bir vaqtda: ${d.toqnash.map(guruhQisqa).join(', ')}` : ''}`}
                        className="absolute z-10 flex flex-col gap-0.5 overflow-hidden rounded-[8px] border-l-[3px] px-2 py-1.5 shadow-sm transition hover:z-20 hover:-translate-y-px hover:shadow-md focus-visible:z-20"
                        style={{
                          top: top + 1,
                          height: h - 2,
                          left: `calc(${(d.yolak / d.yolaklar) * 100}% + 3px)`,
                          width: `calc(${100 / d.yolaklar}% - 6px)`,
                          borderLeftColor: toq ? 'var(--color-brand)' : rang,
                          background: toq ? 'var(--color-brand-soft)' : `color-mix(in srgb, ${rang} 16%, var(--color-surface))`,
                        }}
                      >
                        <span className="truncate text-[12.5px] leading-tight font-bold">{guruhQisqa(d.nom)}</span>
                        <span className="tnum truncate font-[family-name:var(--font-mono)] text-[11px] text-ink-2">
                          {vaqt(d.boshlanish)}–{vaqt(d.tugash)}
                        </span>
                        {h >= 60 && (
                          <span className="truncate text-[11px] text-ink-2">
                            {d.oquvchilar} o‘quvchi{xodim && d.ustoz ? ` · ${d.ustoz}` : ''}
                          </span>
                        )}
                        {toq && h >= 80 && <span className="truncate text-[11px] font-semibold text-brand">to‘qnashuv</span>}
                      </Link>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

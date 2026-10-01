import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, kirishKlass } from '@/components/forma'
import { sana, bugunToshkent } from '@/lib/format'
import type { Hisobot, HisobotGrafik, HisobotDavomat, HisobotMoliya, HisobotOquvchilar, HisobotUstoz, MonthlyIncome } from '@/lib/types'
import { DavomatBolimi, MoliyaBolimi, OquvchilarBolimi, UstozlarBolimi } from './bolimlar'
import { UmumiyBolim } from './umumiy'

export const metadata = { title: 'Hisobotlar' }
export const dynamic = 'force-dynamic'

/** Bo'limlar: Umumiy — tushum va kunlik nazorat; qolganlari — tahlil */
const BOLIMLAR = {
  umumiy: 'Umumiy',
  moliya: 'Moliya',
  oquvchilar: 'O‘quvchilar',
  ustozlar: 'Ustozlar',
  davomat: 'Davomat',
} as const
type Bolim = keyof typeof BOLIMLAR
/** Oylik bo'limlar (Moliya, O'quvchilar) sana oralig'i emas, oxirgi N oy bilan */
const OYLIK: Bolim[] = ['moliya', 'oquvchilar']
const OY_TANLOV = [3, 6, 12] as const

/** Bo'lim havolasi: boshqa parametrlar bilan birga */
function yol(q: Record<string, string>): string {
  const p = new URLSearchParams(q).toString()
  return p ? `/crm/hisobotlar?${p}` : '/crm/hisobotlar'
}

/** "2026-09-17" dan n kun oldin/keyin. */
function kunQosh(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Oraliq — botdagi tugmalar: "Bugun", "Shu oy", "Hisobot (sana oralig'i)".
 * Hafta dushanbadan boshlanadi.
 */
function oraliq(tur: string, dan?: string, gacha?: string): { tur: string; dan: string; gacha: string } {
  const bugun = bugunToshkent()
  if (tur === 'bugun') return { tur, dan: bugun, gacha: bugun }
  if (tur === 'hafta') {
    const haftaKuni = (new Date(`${bugun}T00:00:00Z`).getUTCDay() + 6) % 7 // dushanba = 0
    return { tur, dan: kunQosh(bugun, -haftaKuni), gacha: bugun }
  }
  if (tur === '7kun') return { tur, dan: kunQosh(bugun, -6), gacha: bugun }
  if (tur === '30kun') return { tur, dan: kunQosh(bugun, -29), gacha: bugun }
  if (tur === '90kun') return { tur, dan: kunQosh(bugun, -89), gacha: bugun }
  if (tur === 'otgan') {
    const boshi = `${bugun.slice(0, 7)}-01`
    const oxiri = kunQosh(boshi, -1)
    return { tur, dan: `${oxiri.slice(0, 7)}-01`, gacha: oxiri }
  }
  if (tur === 'oraliq' && dan && gacha && /^\d{4}-\d{2}-\d{2}$/.test(dan) && /^\d{4}-\d{2}-\d{2}$/.test(gacha)) {
    return dan <= gacha ? { tur, dan, gacha } : { tur, dan: gacha, gacha: dan }
  }
  return { tur: 'oy', dan: `${bugun.slice(0, 7)}-01`, gacha: bugun }
}

export default async function Hisobotlar({
  searchParams,
}: {
  searchParams: Promise<{ tur?: string; dan?: string; gacha?: string; bolim?: string; oy?: string }>
}) {
  await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Hisobotlar" />

  const s = await searchParams
  const bolim: Bolim = (Object.keys(BOLIMLAR) as Bolim[]).find((b) => b === s.bolim) ?? 'umumiy'
  // Standart — oxirgi 30 kun (LevelUp kabi; oy boshida "Shu oy" bo'sh bo'ladi)
  const standartTur = '30kun'
  const o = oraliq(s.tur ?? standartTur, s.dan, s.gacha)
  const oyNechta = OY_TANLOV.find((n) => String(n) === s.oy) ?? 6
  const oylikmi = OYLIK.includes(bolim)

  // Bo'limlar orasida o'tganda tanlangan oraliq / oy saqlanadi
  const oraliqQs: Record<string, string> =
    o.tur === 'oraliq' ? { tur: 'oraliq', dan: o.dan, gacha: o.gacha } : o.tur === standartTur ? {} : { tur: o.tur }
  const bolimQs: Record<string, string> = bolim === 'umumiy' ? {} : { bolim }
  const bolimHavola = (b: Bolim) =>
    yol({ ...(b === 'umumiy' ? {} : { bolim: b }), ...(OYLIK.includes(b) ? (s.oy ? { oy: s.oy } : {}) : oraliqQs) })

  const supabase = await createClient()
  const [{ data: hisobot, error }, { data: oylik }, bolimData, { data: grafik }] = await Promise.all([
    bolim === 'umumiy'
      ? supabase.rpc('tushum_hisobot', { p_dan: o.dan, p_gacha: o.gacha })
      : Promise.resolve({ data: null, error: null }),
    bolim === 'umumiy'
      ? supabase.from('v_monthly_income').select('*').order('davr', { ascending: false }).limit(12)
      : Promise.resolve({ data: [] }),
    bolim === 'moliya'
      ? supabase.rpc('hisobot_moliya', { p_oylar: oyNechta })
      : bolim === 'oquvchilar'
        ? supabase.rpc('hisobot_oquvchilar', { p_oylar: oyNechta })
        : bolim === 'ustozlar'
          ? supabase.rpc('hisobot_ustozlar', { p_dan: o.dan, p_gacha: o.gacha })
          : bolim === 'davomat'
            ? supabase.rpc('hisobot_davomat', { p_dan: o.dan, p_gacha: o.gacha })
            : Promise.resolve({ data: null, error: null }),
    bolim === 'umumiy'
      ? supabase.rpc('hisobot_grafik', { p_dan: o.dan, p_gacha: o.gacha })
      : Promise.resolve({ data: null }),
  ])

  const h = hisobot as Hisobot | null
  const g = grafik as HisobotGrafik | null
  const oylar = ((oylik ?? []) as MonthlyIncome[]).slice().reverse()

  const tugma = (tur: string, nom: string) => (
    <Link
      href={yol({ ...bolimQs, ...(tur === standartTur ? {} : { tur }) })}
      className={`flex min-h-11 items-center rounded-[9px] border px-4 text-[13px] transition ${
        o.tur === tur ? 'border-brand bg-brand-soft text-ink' : 'border-line text-ink-3 hover:text-ink'
      }`}
    >
      {nom}
    </Link>
  )


  /* Qilinmagan darslar — ustoz bo'yicha guruhlab (botdagi kabi) */
  const qilinmagan = new Map<string, { nom: string; sana: string }[]>()
  for (const q of h?.qilinmagan ?? []) {
    const r = qilinmagan.get(q.ustoz) ?? []
    r.push({ nom: q.nom, sana: q.sana })
    qilinmagan.set(q.ustoz, r)
  }


  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Hisobotlar"
        izoh={oylikmi ? `oxirgi ${oyNechta} oy` : o.dan === o.gacha ? sana(o.dan) : `${sana(o.dan)} — ${sana(o.gacha)}`}
      />

      <nav aria-label="Hisobot bo‘limlari" className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
        {(Object.keys(BOLIMLAR) as Bolim[]).map((b) => (
          <Link
            key={b}
            href={bolimHavola(b)}
            aria-current={bolim === b ? 'page' : undefined}
            className={`-mb-px flex min-h-11 shrink-0 items-center border-b-2 px-4 text-[13.5px] font-semibold transition ${
              bolim === b ? 'border-brand text-ink' : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            {BOLIMLAR[b]}
          </Link>
        ))}
      </nav>

      {oylikmi ? (
        <div className="flex flex-wrap items-center gap-2">
          {OY_TANLOV.map((n) => (
            <Link
              key={n}
              href={yol({ ...bolimQs, oy: String(n) })}
              className={`flex min-h-11 items-center rounded-[9px] border px-4 text-[13px] transition ${
                oyNechta === n ? 'border-brand bg-brand-soft text-ink' : 'border-line text-ink-3 hover:text-ink'
              }`}
            >
              Oxirgi {n} oy
            </Link>
          ))}
        </div>
      ) : (
      <div className="flex flex-wrap items-end gap-2">
        {tugma('bugun', 'Bugun')}
        {tugma('7kun', '7 kun')}
        {tugma('30kun', '30 kun')}
        {tugma('90kun', '90 kun')}
        {tugma('oy', 'Shu oy')}
        {tugma('otgan', 'O‘tgan oy')}
        <form className="flex flex-wrap items-end gap-2">
          {bolim !== 'umumiy' && <input type="hidden" name="bolim" value={bolim} />}
          <input type="hidden" name="tur" value="oraliq" />
          <Maydon nom="Dan">
            <input type="date" name="dan" defaultValue={o.dan} className={kirishKlass} />
          </Maydon>
          <Maydon nom="Gacha">
            <input type="date" name="gacha" defaultValue={o.gacha} className={kirishKlass} />
          </Maydon>
          <button type="submit" className="min-h-11 rounded-[9px] border border-line px-4 text-[13px] text-ink-2 hover:text-ink">
            Ko‘rsatish
          </button>
        </form>
      </div>
      )}

      {bolim !== 'umumiy' ? (
        bolimData.error || !bolimData.data ? (
          <Card className="p-5">
            <Empty>Hisobotni olib bo‘lmadi{bolimData.error ? `: ${bolimData.error.message}` : ''}.</Empty>
          </Card>
        ) : bolim === 'moliya' ? (
          <MoliyaBolimi m={bolimData.data as HisobotMoliya} />
        ) : bolim === 'oquvchilar' ? (
          <OquvchilarBolimi o={bolimData.data as HisobotOquvchilar} />
        ) : bolim === 'ustozlar' ? (
          <UstozlarBolimi u={bolimData.data as HisobotUstoz[]} />
        ) : (
          <DavomatBolimi d={bolimData.data as HisobotDavomat} />
        )
      ) : error || !h || !g ? (
        <Card className="p-5">
          <Empty>Hisobotni olib bo‘lmadi{error ? `: ${error.message}` : ''}.</Empty>
        </Card>
      ) : (
        <>
          <UmumiyBolim h={h} g={g} oylar={oylar} />
          {qilinmagan.size > 0 && (
            <Card className="flex flex-col">
              <CardHeader title="Davomat qilinmagan darslar" meta="jadval bo‘yicha dars bor, belgi yo‘q" />
              <div className="flex flex-col gap-3 px-5 pb-4">
                {qilinmagan.size === 0 ? (
                  <Empty>Hamma darsga davomat qo‘yilgan.</Empty>
                ) : (
                  [...qilinmagan.entries()].map(([ustoz, darslar]) => (
                    <div key={ustoz} className="flex flex-col gap-1">
                      <span className="text-[13px] font-semibold">
                        {ustoz} <span className="text-ink-3">— {darslar.length} ta</span>
                      </span>
                      <span className="text-[12px] leading-relaxed text-ink-3">
                        {darslar.slice(0, 8).map((d) => `${d.nom.split(' · ')[0]} ${d.sana.slice(8, 10)}.${d.sana.slice(5, 7)}`).join(', ')}
                        {darslar.length > 8 ? ' …' : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Card>

          )}
        </>
      )}
    </div>
  )
}

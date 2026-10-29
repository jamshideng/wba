import Link from 'next/link'
import { redirect } from 'next/navigation'
import { talabProfil, adminmi, panelYoli } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Logo, Button } from '@/components/ui'
import { Ulanmagan } from '@/components/crm'
import { IconArrowLeft } from '@/components/icons'
import { davrNomi, joriyDavr, sana } from '@/lib/format'
import { davrOqi } from '@/lib/kiritish'
import { asosiy, natijaMatni, son, type OylikNatija } from '@/lib/oylik-test'
import { ChopTugma } from './chop-tugma'

export const metadata = { title: 'Oylik test natijalari' }
export const dynamic = 'force-dynamic'

/**
 * Oylik test natijalari — chop etish / PDF hujjati (faqat admin).
 * "PDF yuklab olish" brauzerning chop etish oynasini ochadi; chop
 * etishda faqat #chop-hujjat qoladi (menyu, tugmalar yashiriladi).
 * ?guruh=G13 — bitta guruh.
 */
export default async function Chop({
  searchParams,
}: {
  searchParams: Promise<{ davr?: string; guruh?: string }>
}) {
  const profil = await talabProfil()
  if (!adminmi(profil.rol)) redirect(panelYoli(profil.rol))
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Oylik test" />

  const s = await searchParams
  const davr = davrOqi(s.davr ?? null) ?? joriyDavr()
  const supabase = await createClient()
  let so = supabase.from('v_oylik_natijalar').select('*').eq('davr', davr)
  if (s.guruh) so = so.eq('group_id', s.guruh)
  const { data } = await so
  const natijalar = (data ?? []) as OylikNatija[]

  const guruhlar = new Map<string, OylikNatija[]>()
  for (const n of [...natijalar].sort((a, b) => a.guruh.localeCompare(b.guruh, 'uz'))) {
    guruhlar.set(n.group_id, [...(guruhlar.get(n.group_id) ?? []), n])
  }
  for (const r of guruhlar.values()) {
    r.sort((a, b) => (a.orin ?? 999) - (b.orin ?? 999) || a.fish.localeCompare(b.fish, 'uz'))
  }
  const f = natijalar.filter((n) => n.foiz != null).map((n) => Number(n.foiz))
  const ortacha = f.length ? f.reduce((a, b) => a + b, 0) / f.length : null

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm 12mm; }
          body * { visibility: hidden !important; }
          #chop-hujjat, #chop-hujjat * { visibility: visible !important; }
          #chop-hujjat { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0 !important; box-shadow: none !important; }
          .chop-bolim { break-inside: avoid; }
          html, body { background: #fff !important; }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/crm/oylik-test?davr=${davr}`} className="inline-flex min-h-11 items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
          <IconArrowLeft size={16} /> Oylik test
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button href={`/crm/oylik-test/eksport?davr=${davr}`} yuklab variant="ikkilamchi">Excel</Button>
          <ChopTugma />
        </div>
      </div>
      <p className="text-[12px] text-ink-3">Chop etish oynasida “Printer” o‘rniga “PDF sifatida saqlash”ni tanlang.</p>

      <article id="chop-hujjat" className="mx-auto flex w-full max-w-[820px] flex-col gap-6 rounded-[12px] hujjat-yorug border border-line bg-surface p-8 text-ink">
        <header className="flex items-start justify-between gap-4 border-b-2 border-brand pb-4">
          <Logo size="lg" />
          <div className="text-right">
            <h1 className="font-[family-name:var(--font-display)] text-[20px] font-extrabold">Oylik test natijalari</h1>
            <p className="text-[13px] text-ink-2">{davrNomi(davr)}</p>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-[10px] bg-surface-2 p-3">
            <div className="text-[11px] uppercase tracking-wide text-ink-3">Guruhlar</div>
            <div className="text-[20px] font-extrabold">{guruhlar.size}</div>
          </div>
          <div className="rounded-[10px] bg-surface-2 p-3">
            <div className="text-[11px] uppercase tracking-wide text-ink-3">O‘quvchilar</div>
            <div className="text-[20px] font-extrabold">{natijalar.length}</div>
          </div>
          <div className="rounded-[10px] bg-surface-2 p-3">
            <div className="text-[11px] uppercase tracking-wide text-ink-3">O‘rtacha natija</div>
            <div className="text-[20px] font-extrabold">{ortacha == null ? '—' : `${son(ortacha)}%`}</div>
          </div>
        </div>

        {guruhlar.size === 0 && <p className="text-center text-[13px] text-ink-3">Bu oy uchun natija kiritilmagan.</p>}

        {[...guruhlar.values()].map((r) => {
          const gf = r.filter((n) => n.foiz != null).map((n) => Number(n.foiz))
          const gOrt = gf.length ? gf.reduce((a, b) => a + b, 0) / gf.length : null
          return (
            <section key={r[0].group_id} className="chop-bolim flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[14px] font-bold">{r[0].guruh}</h2>
                <span className="text-[12px] text-ink-2">
                  {r[0].sana ? `${sana(r[0].sana)} · ` : ''}o‘rtacha {gOrt == null ? '—' : `${son(gOrt)}%`}
                </span>
              </div>
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="bg-surface-2 text-left">
                    <th className="border border-line px-2 py-1.5 w-8">№</th>
                    <th className="border border-line px-2 py-1.5">F.I.Sh</th>
                    <th className="border border-line px-2 py-1.5">Natija</th>
                    <th className="border border-line px-2 py-1.5 w-20 text-right">Umumiy</th>
                    <th className="border border-line px-2 py-1.5 w-14 text-center">O‘rin</th>
                  </tr>
                </thead>
                <tbody>
                  {r.map((n, i) => (
                    <tr key={n.id}>
                      <td className="border border-line px-2 py-1.5">{i + 1}</td>
                      <td className="border border-line px-2 py-1.5 font-semibold">{n.fish}</td>
                      <td className="border border-line px-2 py-1.5">{natijaMatni(n)}</td>
                      <td className="border border-line px-2 py-1.5 text-right font-bold">{asosiy(n)}</td>
                      <td className="border border-line px-2 py-1.5 text-center">{n.orin ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )
        })}

        <footer className="mt-2 flex justify-between border-t border-line pt-3 text-[11px] text-ink-3">
          <span>World Bridge Academy · wbalc.uz</span>
          <span>Tayyorladi: {profil.ism}</span>
        </footer>
      </article>
    </div>
  )
}

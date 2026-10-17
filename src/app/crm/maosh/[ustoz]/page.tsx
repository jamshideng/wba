import Link from 'next/link'
import { redirect } from 'next/navigation'
import { talabProfil, adminmi, getUstoz } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Empty, Badge } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { kirishKlass } from '@/components/forma'
import { JonliForma } from '@/components/jonli-forma'
import { IconArrowLeft } from '@/components/icons'
import { pul, davrNomi, joriyDavr, guruhQisqa } from '@/lib/format'
import type { MaoshHarakat, MaoshTafsilot, UstozMaosh } from '@/lib/types'

export const metadata = { title: 'Maosh' }
export const dynamic = 'force-dynamic'

const TURLAR: Record<MaoshHarakat['turi'], string> = { avans: 'Avans', bonus: 'Bonus', jarima: 'Jarima', tuzatish: 'Tuzatish' }

/**
 * Bitta ustozning maoshi (0075): guruh → o'quvchi bo'yicha hisob.
 * /crm/maosh/men — ustozning o'zi (har davomatdan keyin yangilanadi).
 * Admin/direktor — istalgan ustoz. Boshqa ustozni bazaning o'zi bermaydi.
 */
export default async function UstozMaoshi({
  params,
  searchParams,
}: {
  params: Promise<{ ustoz: string }>
  searchParams: Promise<{ davr?: string }>
}) {
  const profil = await talabProfil()
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Maosh" />
  const admin = adminmi(profil.rol)

  const [{ ustoz: param }, s] = await Promise.all([params, searchParams])
  const men = await getUstoz()
  const ustozId = param === 'men' ? men?.id : param
  if (!ustozId) redirect(admin ? '/crm/maosh' : '/crm?xato=huquq')
  if (!admin && ustozId !== men?.id) redirect('/crm/maosh/men')

  const davr = /^\d{4}-(0[1-9]|1[0-2])$/.test(s.davr ?? '') ? s.davr! : joriyDavr()

  const supabase = await createClient()
  const [{ data: jamXom }, { data: tafXom, error: xato }, { data: harXom }] = await Promise.all([
    supabase.rpc('ustoz_maosh', { p_davr: davr }),
    supabase.rpc('ustoz_maosh_tafsilot', { p_davr: davr, p_ustoz: ustozId! }),
    supabase
      .from('maosh_harakatlar')
      .select('id, teacher_id, davr, turi, summa, izoh, bekor, bekor_sabab, created_at')
      .eq('davr', davr)
      .eq('teacher_id', ustozId!)
      .eq('bekor', false)
      .order('id'),
  ])

  const jam = ((jamXom ?? []) as UstozMaosh[]).find((q) => q.teacher_id === ustozId) ?? null
  const qatorlar = (tafXom ?? []) as MaoshTafsilot[]
  const harakatlar = (harXom ?? []) as MaoshHarakat[]

  // Guruhlar bo'yicha: o'z guruhlari, keyin zamena qilganlari
  const guruhlar = new Map<string, { nom: string; zamena: boolean; n: number; stavka: number | null; qator: MaoshTafsilot[] }>()
  for (const q of qatorlar) {
    const k = `${q.zamena ? 'z' : 'o'}:${q.group_id}`
    const g = guruhlar.get(k) ?? { nom: q.guruh, zamena: q.zamena, n: q.n, stavka: q.stavka, qator: [] }
    g.qator.push(q)
    guruhlar.set(k, g)
  }
  const ism = jam?.ism ?? (param === 'men' ? men?.ism : null) ?? ustozId!
  const ortga = admin ? `/crm/maosh?davr=${davr}` : null

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      {ortga && (
        <Link href={ortga} className="flex items-center gap-2 text-[13px] text-ink-3 transition hover:text-ink">
          <IconArrowLeft size={15} />
          Maosh
        </Link>
      )}

      <Sarlavha
        nom={param === 'men' ? 'Maoshim' : ism}
        izoh={`${davrNomi(davr)}${jam?.tasdiqlangan ? ' · direktor tasdiqlagan' : ' · har davomatdan keyin yangilanadi'}`}
        amal={
          <JonliForma className="flex items-end gap-2">
            <input type="month" name="davr" defaultValue={davr} className={kirishKlass} aria-label="Oy" />
          </JonliForma>
        }
      />

      {xato && <p className="text-[13px] text-brand">Maoshni o‘qib bo‘lmadi.</p>}

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="To‘lanadigan" value={pul(jam?.yakuniy ?? 0)} sub="so‘m" ton="ok" />
        <Stat label="Darslar bo‘yicha" value={pul(jam?.hisob ?? 0)} sub={`${jam?.oquvchilar ?? 0} o‘quvchi`} />
        <Stat
          label="Avans va jarima"
          value={pul(Number(jam?.avans ?? 0) + Number(jam?.jarima ?? 0))}
          sub="ayiriladi"
        />
        <Stat
          label="Bonus va tuzatish"
          value={pul(Number(jam?.bonus ?? 0) + Number(jam?.tuzatish ?? 0))}
          sub="qo‘shiladi"
        />
      </div>

      <Card className="px-5 py-4 text-[12.5px] leading-relaxed text-ink-2">
        Har o‘quvchi uchun: <b>stavka ÷ oydagi darslar</b> (kamida 12) <b>× hisobga kirgan darslar</b>. Ketma-ket 3 va undan
        ko‘p qoldirilgan darslar ayiriladi, 1–2 tasi to‘lanadi. Oy o‘rtasida kelgan o‘quvchi kelgan kunidan hisoblanadi.
        Zamena darsi o‘tgan ustozga yoziladi.
        {jam?.aniqmas && (
          <span className="mt-2 block text-brand">Ba’zi guruhlarda stavka belgilanmagan — summa [ANIQLANMAGAN].</span>
        )}
      </Card>

      {guruhlar.size === 0 ? (
        <Card className="p-5">
          <Empty>Bu oyda hali o‘tilgan dars yo‘q.</Empty>
        </Card>
      ) : (
        [...guruhlar.entries()].map(([k, g]) => {
          const jami = g.qator.reduce((a, q) => a + Number(q.summa ?? 0), 0)
          return (
            <Card key={k} className="flex flex-col">
              <CardHeader
                title={admin ? g.nom : guruhQisqa(g.nom)}
                meta={`${g.zamena ? 'zamena · ' : ''}${g.stavka === null ? 'stavka yo‘q' : `${pul(g.stavka)} ÷ ${g.n} dars`} · ${pul(jami)}`}
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-[12.5px]">
                  <thead>
                    <tr className="border-t border-line-soft text-left text-[11.5px] text-ink-3">
                      <th className="px-5 py-2 font-medium">O‘quvchi</th>
                      <th className="px-3 py-2 text-right font-medium">Darslar</th>
                      <th className="px-3 py-2 text-right font-medium">Ayirildi</th>
                      <th className="px-5 py-2 text-right font-medium">Summa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.qator.map((q) => (
                      <tr key={`${q.student_id}-${q.group_id}`} className="border-t border-line-soft">
                        <td className="px-5 py-2.5">{q.fish}</td>
                        <td className="tnum px-3 py-2.5 text-right">
                          {q.hisob_darslar} / {q.darslar}
                        </td>
                        <td className="tnum px-3 py-2.5 text-right">
                          {q.ayirildi > 0 ? <Badge ton="brand">−{q.ayirildi}</Badge> : <span className="text-ink-4">—</span>}
                        </td>
                        <td className="tnum px-5 py-2.5 text-right font-[family-name:var(--font-mono)] font-semibold">
                          {q.summa === null ? '[ANIQLANMAGAN]' : pul(q.summa)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        })
      )}

      {harakatlar.length > 0 && (
        <Card className="flex flex-col">
          <CardHeader title="Avans, bonus, jarima, tuzatish" meta={`${harakatlar.length} ta`} />
          <ul className="flex flex-col">
            {harakatlar.map((h) => {
              const t = h.turi === 'avans' || h.turi === 'jarima' ? -Number(h.summa) : Number(h.summa)
              return (
                <li key={h.id} className="flex items-start justify-between gap-3 border-t border-line-soft px-5 py-3">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13px] font-semibold">{TURLAR[h.turi]}</span>
                    {h.izoh && <span className="text-[11.5px] text-ink-3">{h.izoh}</span>}
                  </span>
                  <span
                    className={`tnum font-[family-name:var(--font-mono)] text-[13px] font-semibold ${t > 0 ? 'text-ok' : 'text-brand'}`}
                  >
                    {t > 0 ? '+' : '−'}
                    {pul(Math.abs(t))}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}

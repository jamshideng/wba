import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Stat } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { JonliForma } from '@/components/jonli-forma'
import { IconSearch, IconLeads, IconPhone, IconAlert, IconStudents } from '@/components/icons'
import { bugunToshkent } from '@/lib/format'
import { BOSQICHLAR, MANBALAR, MANBA_NOMI, bosqichi, kunQosh, type LidKarta } from '@/lib/lidlar'
import type { LeadSource } from '@/lib/types'
import { lidQosh } from './actions'
import { Kanban } from './kanban'

export const metadata = { title: 'Lidlar' }
export const dynamic = 'force-dynamic'

const TEZ = {
  hammasi: 'Hammasi',
  bugun: 'Bugun aloqa',
  kechikkan: 'Kechikkan',
  rejalangan: 'Rejalangan',
} as const
type Tez = keyof typeof TEZ

type Qator = Omit<LidKarta, 'guruh'> & { groups: { nom: string } | null; updated_at: string }

export default async function Lidlar({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; manba?: string; tez?: string; ok?: string; xato?: string; yangi?: string }>
}) {
  await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Lidlar" />

  const s = await searchParams
  const bugun = bugunToshkent()
  const oyBoshi = `${bugun.slice(0, 7)}-01`
  const otizKunOldin = kunQosh(bugun, -30)
  const q = (s.q ?? '').trim().toLowerCase()
  const manba = MANBALAR.find((m) => m === s.manba) as LeadSource | undefined
  const tez: Tez = (Object.keys(TEZ) as Tez[]).find((t) => t === s.tez) ?? 'hammasi'

  const sorov = new URLSearchParams()
  if (q) sorov.set('q', q)
  if (manba) sorov.set('manba', manba)
  if (tez !== 'hammasi') sorov.set('tez', tez)
  const yol = `/crm/lidlar${sorov.size ? `?${sorov}` : ''}`

  const supabase = await createClient()
  const ustunlar =
    'id, ism, telefon, manba, holat, izoh, sabab, teglar, student_id, group_id, sinov_sana, keyingi_aloqa, aloqa_soni, oxirgi_aloqa, created_at, updated_at, groups(nom)'
  const [{ data: ochiq }, { data: yopiq }, { data: guruhlar }, { data: shuOy }] = await Promise.all([
    supabase.from('leads').select(ustunlar).is('student_id', null).in('holat', ['yangi', 'qongiroq', 'keldi']).order('created_at', { ascending: false }).limit(500),
    // Yopilganlar — faqat oxirgi 30 kun (kanban to'lib ketmasin)
    supabase.from('leads').select(ustunlar).or('student_id.not.is.null,holat.in.(yozildi,rad,kelmadi)').gte('updated_at', `${otizKunOldin}T00:00:00+05:00`).order('updated_at', { ascending: false }).limit(200),
    supabase.from('groups').select('id, nom').eq('holat', 'faol').order('nom'),
    supabase.from('leads').select('holat, student_id').gte('created_at', `${oyBoshi}T00:00:00+05:00`),
  ])

  const hammasi = [...((ochiq ?? []) as unknown as Qator[]), ...((yopiq ?? []) as unknown as Qator[])].map(
    ({ groups, ...l }) => ({ ...l, teglar: l.teglar ?? [], guruh: groups?.nom ?? null }) as LidKarta,
  )

  const ochiqlar = hammasi.filter((l) => ['yangi', 'boglanildi', 'sinov'].includes(bosqichi(l)))
  const tezSoni = {
    hammasi: ochiqlar.length,
    bugun: ochiqlar.filter((l) => l.keyingi_aloqa === bugun).length,
    kechikkan: ochiqlar.filter((l) => l.keyingi_aloqa !== null && l.keyingi_aloqa < bugun).length,
    rejalangan: ochiqlar.filter((l) => l.keyingi_aloqa !== null && l.keyingi_aloqa > bugun).length,
  }

  const korinadi = hammasi.filter((l) => {
    if (manba && l.manba !== manba) return false
    if (q && ![l.ism, l.telefon, l.izoh ?? '', l.teglar.join(' ')].join(' ').toLowerCase().includes(q)) return false
    if (tez === 'bugun') return l.keyingi_aloqa === bugun
    if (tez === 'kechikkan') return l.keyingi_aloqa !== null && l.keyingi_aloqa < bugun
    if (tez === 'rejalangan') return l.keyingi_aloqa !== null && l.keyingi_aloqa > bugun
    return true
  })

  const oyLidlar = (shuOy ?? []) as { holat: string; student_id: string | null }[]
  const oyYozildi = oyLidlar.filter((l) => l.student_id || l.holat === 'yozildi').length
  const konversiya = oyLidlar.length ? Math.round((oyYozildi / oyLidlar.length) * 100) : 0

  const tezHavola = (t: Tez) => {
    const u = new URLSearchParams(sorov)
    if (t === 'hammasi') u.delete('tez')
    else u.set('tez', t)
    return `/crm/lidlar${u.size ? `?${u}` : ''}`
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Lidlar"
        izoh="murojaatlarni o‘quvchiga aylantirish"
        amal={
          <Link href="/crm/probniylar" className="lbl underline-offset-4 hover:text-ink hover:underline">
            Probniylar ro‘yxati →
          </Link>
        }
      />
      <Xabar ok={s.ok} xato={s.xato} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ochiq lidlar" value={String(tezSoni.hammasi)} sub="yangi + bog‘lanildi + sinov" Icon={IconLeads} />
        <Stat label="Bugun aloqa" value={String(tezSoni.bugun)} sub="bugun bog‘lanish kerak" ton="accent" border={tezSoni.bugun ? 'accent' : undefined} Icon={IconPhone} />
        <Stat label="Kechikkan" value={String(tezSoni.kechikkan)} sub="aloqa sanasi o‘tib ketgan" ton="brand" border={tezSoni.kechikkan ? 'brand' : undefined} Icon={IconAlert} />
        <Stat label="Shu oy konversiya" value={`${konversiya}%`} sub={`${oyLidlar.length} lid → ${oyYozildi} o‘quvchi`} ton="ok" Icon={IconStudents} />
      </div>

      <Card className="flex flex-col">
        <details open={hammasi.length === 0 || s.yangi === '1'}>
          <summary className="flex min-h-12 cursor-pointer items-center px-5 font-[family-name:var(--font-display)] text-[15px] font-bold">
            + Yangi lid
          </summary>
          <form action={lidQosh} className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="qaytish" value={yol} />
            <Maydon nom="Ism familya">
              <input name="ism" required maxLength={100} className={kirishKlass} />
            </Maydon>
            <Maydon nom="Telefon">
              <input name="telefon" type="tel" required placeholder="90 123 45 67" className={kirishKlass} />
            </Maydon>
            <Maydon nom="Qayerdan bildi">
              <select name="manba" defaultValue="instagram" className={kirishKlass}>
                {MANBALAR.map((m) => (
                  <option key={m} value={m}>{MANBA_NOMI[m]}</option>
                ))}
              </select>
            </Maydon>
            <Maydon nom="Qachon bog‘lanish kerak" izoh="Shu kuni 09:00 da Vazifalarga eslatma tushadi">
              <input name="keyingi_aloqa" type="date" min={bugun} defaultValue={kunQosh(bugun, 1)} className={kirishKlass} />
            </Maydon>
            <Maydon nom="Teglar" izoh="Vergul bilan: issiq, ielts, chegirma">
              <input name="teglar" maxLength={200} className={kirishKlass} />
            </Maydon>
            <Maydon nom="Izoh">
              <input name="izoh" maxLength={500} placeholder="Ixtiyoriy" className={kirishKlass} />
            </Maydon>
            <Yuborish className="sm:col-span-2 lg:col-span-3">Lid qo‘shish</Yuborish>
          </form>
        </details>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <JonliForma className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
          {tez !== 'hammasi' && <input type="hidden" name="tez" value={tez} />}
          <label className="relative">
            <span className="sr-only">Qidirish</span>
            <IconSearch size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-4" />
            <input name="q" defaultValue={q} placeholder="Ism, telefon, izoh yoki teg" className={`${kirishKlass} pl-9`} />
          </label>
          <select name="manba" defaultValue={manba ?? ''} className={kirishKlass} aria-label="Manba">
            <option value="">Barcha manbalar</option>
            {MANBALAR.map((m) => (
              <option key={m} value={m}>{MANBA_NOMI[m]}</option>
            ))}
          </select>
          {(q || manba || tez !== 'hammasi') && (
            <Link href="/crm/lidlar" className="flex min-h-11 items-center px-2 text-[13px] text-ink-3 hover:text-ink">
              Tozalash
            </Link>
          )}
        </JonliForma>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TEZ) as Tez[]).map((t) => (
            <Link
              key={t}
              href={tezHavola(t)}
              className={`flex min-h-10 items-center gap-2 rounded-[9px] border px-3.5 text-[13px] transition ${
                tez === t ? 'border-brand bg-brand-soft text-ink' : 'border-line text-ink-3 hover:text-ink'
              }`}
            >
              {TEZ[t]}
              <span className="tnum font-[family-name:var(--font-mono)] text-[11px] text-ink-3">{tezSoni[t]}</span>
            </Link>
          ))}
        </div>
      </Card>

      <Kanban
        lidlar={korinadi}
        bosqichlar={BOSQICHLAR}
        guruhlar={(guruhlar ?? []) as { id: string; nom: string }[]}
        bugun={bugun}
        yol={yol}
      />
    </div>
  )
}

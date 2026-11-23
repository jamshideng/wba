import Link from 'next/link'
import { redirect } from 'next/navigation'
import { talabProfil, getUstoz, adminmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Empty, Badge, Button, Stat } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar, kirishKlass } from '@/components/forma'
import { JonliForma } from '@/components/jonli-forma'
import { bugunToshkent, guruhUstozsiz, sana } from '@/lib/format'
import {
  kirimBekor, kirimQosh, kirimTahrir, kitobBekor, kitobBerildi, kitobBuyurtmaBer, kitobBuyurtmaOzgartir,
  kitobHolati, kitobOchir, kitobQaytar, kitobQosh, kitobTahrir,
} from './actions'
import { KodQR } from './qr'

export const metadata = { title: 'Kitoblar' }
export const dynamic = 'force-dynamic'

/*
 * 0142/0143 — kitoblar hisobi. Kitob kurs narxiga kiradi: to'lov/qarzga bog'lanmaydi.
 * Rahbariyat (direktor, admin, manager): qoldiq, buyurtmalar (kod/QR bilan berish,
 * qaytarish), kirim (tahrir, bekor), katalog (tahrir, arxiv, o'chirish), hisobot.
 * Ustoz: doimiy guruhidan faol o'quvchilarni belgilab buyurtma, o'z buyurtmalari.
 */

type Qoldiq = {
  kitob_id: string; nom: string; subject_id: string | null; holat: 'faol' | 'arxiv'; izoh: string | null
  kelgan: number; berilgan: number; qaytarilgan: number; band: number; omborda: number; bosh: number
}
type BuyurtmaHolati = 'kutilmoqda' | 'berildi' | 'bekor' | 'qaytarildi'
type Buyurtma = {
  id: string; kod: string; kitob_id: string; kitob_nomi: string; teacher_id: string | null; group_id: string | null
  soni: number; holat: BuyurtmaHolati; created_at: string; berildi_vaqt: string | null; bekor_sabab: string | null
}
type Qator = { buyurtma_id: string; student_id: string; holat: 'faol' | 'olib_tashlandi' | 'qaytarildi'; sabab: string | null; fish: string }
type Tafsilot = { qatorlar: Map<string, Qator[]>; ustoz: Map<string, string>; guruh: Map<string, string> }
type Oquvchi = { id: string; fish: string }

const HOLAT: Record<BuyurtmaHolati, { nom: string; ton: 'ok' | 'accent' | 'jim' | 'brand' }> = {
  kutilmoqda: { nom: 'Kutilmoqda', ton: 'accent' },
  berildi: { nom: 'Berildi', ton: 'ok' },
  bekor: { nom: 'Bekor', ton: 'jim' },
  qaytarildi: { nom: 'Qaytarildi', ton: 'brand' },
}

const YOL = '/crm/kitoblar'

function vaqtMatni(iso: string) {
  return new Date(iso).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function kodNormal(v?: string): string | null {
  const k = (v ?? '').trim().toUpperCase().replace(/\s+/g, '')
  if (!k) return null
  const t = k.startsWith('KT-') ? k : `KT-${k.replace(/^KT/, '')}`
  return /^KT-[2-9A-HJ-NP-Z]{6}$/.test(t) ? t : null
}
const sanami = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

export default async function KitoblarSahifa({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; guruh?: string; kitob?: string; kod?: string; dan?: string; gacha?: string; ok?: string; xato?: string }>
}) {
  const profil = await talabProfil()
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Kitoblar" />
  const admin = adminmi(profil.asl_rol ?? profil.rol)
  const ustoz = await getUstoz()
  if (!admin && !ustoz) redirect('/crm')

  const s = await searchParams
  const tablar = [
    ...(admin
      ? [
          { id: 'qoldiq', nom: 'Qoldiq' },
          { id: 'buyurtmalar', nom: 'Buyurtmalar' },
          { id: 'kirim', nom: 'Kirim' },
          { id: 'katalog', nom: 'Katalog' },
          { id: 'hisobot', nom: 'Hisobot' },
        ]
      : []),
    ...(ustoz ? [{ id: 'buyurtma', nom: 'Buyurtma berish' }, { id: 'mening', nom: 'Buyurtmalarim' }] : []),
  ]
  const kod = kodNormal(s.kod)
  const standartTab = kod ? (admin ? 'buyurtmalar' : 'mening') : tablar[0].id
  const tab = tablar.find((t) => t.id === s.tab)?.id ?? standartTab

  const supabase = await createClient()
  const [{ data: qoldiqXom }, { data: fanlar }] = await Promise.all([
    supabase.rpc('kitob_qoldiq'),
    supabase.from('subjects').select('id, nom').order('tartib'),
  ])
  const qoldiq = (qoldiqXom ?? []) as Qoldiq[]
  const fanNomi = new Map((fanlar ?? []).map((f) => [f.id as string, f.nom as string]))

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Kitoblar" izoh="kelgan, berilgan va qolgan kitoblar · kurs narxiga kiradi" />
      <nav className="flex flex-wrap gap-1.5">
        {tablar.map((t) => (
          <Link
            key={t.id}
            href={`${YOL}?tab=${t.id}`}
            className={`inline-flex min-h-11 items-center rounded-[10px] px-4 text-[13.5px] font-semibold transition ${
              t.id === tab ? 'bg-brand text-white' : 'bg-surface-2 text-ink-2 hover:text-ink'
            }`}
          >
            {t.nom}
          </Link>
        ))}
      </nav>
      <Xabar ok={s.ok} xato={s.xato} />

      {s.kod && <KodKarta kod={kod} xom={s.kod} admin={admin} ustozId={ustoz?.id ?? null} />}

      {tab === 'qoldiq' && <QoldiqTab qoldiq={qoldiq} fanNomi={fanNomi} />}
      {tab === 'katalog' && <KatalogTab qoldiq={qoldiq} fanlar={(fanlar ?? []) as { id: string; nom: string }[]} fanNomi={fanNomi} />}
      {tab === 'kirim' && <KirimTab qoldiq={qoldiq} />}
      {tab === 'buyurtmalar' && <BuyurtmalarTab />}
      {tab === 'hisobot' && <HisobotTab qoldiq={qoldiq} dan={sanami(s.dan)} gacha={sanami(s.gacha)} />}
      {tab === 'buyurtma' && ustoz && <BuyurtmaBerishTab ustozId={ustoz.id} guruhId={s.guruh} kitobId={s.kitob} qoldiq={qoldiq} />}
      {tab === 'mening' && ustoz && <MeningTab ustozId={ustoz.id} />}
    </div>
  )
}

/* ------------------------------------------------------------ */
/* Umumiy bo'laklar                                              */
/* ------------------------------------------------------------ */

function Bosh({ children }: { children: React.ReactNode }) {
  return <Card className="p-6"><Empty>{children}</Empty></Card>
}

/** Guruhlardagi faol o'quvchilar (RLS: ustozga o'z guruhlari, rahbariyatga hammasi) */
async function guruhOquvchilari(guruhlar: string[]): Promise<Map<string, Oquvchi[]>> {
  const natija = new Map<string, Oquvchi[]>()
  if (!guruhlar.length) return natija
  const supabase = await createClient()
  const { data } = await supabase
    .from('enrollments')
    .select('student_id, group_id, students(fish, holat)')
    .in('group_id', guruhlar)
    .eq('holat', 'faol')
  for (const e of (data ?? []) as unknown as { student_id: string; group_id: string; students: { fish: string; holat: string } | null }[]) {
    if (e.students?.holat !== 'faol') continue
    const l = natija.get(e.group_id) ?? []
    l.push({ id: e.student_id, fish: e.students.fish })
    natija.set(e.group_id, l)
  }
  for (const l of natija.values()) l.sort((a, b) => a.fish.localeCompare(b.fish, 'uz'))
  return natija
}

async function tafsilot(ro: Buyurtma[]): Promise<Tafsilot> {
  const supabase = await createClient()
  const ids = ro.map((b) => b.id)
  const [{ data: bo }, { data: ustozlar }, { data: guruhlar }] = await Promise.all([
    ids.length
      ? supabase.from('kitob_buyurtma_oquvchilar').select('buyurtma_id, student_id, holat, sabab, students(fish)').in('buyurtma_id', ids)
      : Promise.resolve({ data: [] }),
    supabase.from('teachers').select('id, ism'),
    supabase.from('groups').select('id, nom'),
  ])
  const qatorlar = new Map<string, Qator[]>()
  for (const r of (bo ?? []) as unknown as (Omit<Qator, 'fish'> & { students: { fish: string } | null })[]) {
    const l = qatorlar.get(r.buyurtma_id) ?? []
    l.push({ buyurtma_id: r.buyurtma_id, student_id: r.student_id, holat: r.holat, sabab: r.sabab, fish: r.students?.fish ?? r.student_id })
    qatorlar.set(r.buyurtma_id, l)
  }
  for (const l of qatorlar.values()) l.sort((a, b) => a.fish.localeCompare(b.fish, 'uz'))
  return {
    qatorlar,
    ustoz: new Map((ustozlar ?? []).map((u) => [u.id as string, u.ism as string])),
    guruh: new Map((guruhlar ?? []).map((g) => [g.id as string, g.nom as string])),
  }
}

/** O'quvchilarni belgilash ro'yxati (checkbox) */
function Belgilash({ oquvchilar, tanlangan, izohlar }: { oquvchilar: Oquvchi[]; tanlangan?: Set<string>; izohlar?: Map<string, string> }) {
  return (
    <ul className="grid gap-1 sm:grid-cols-2">
      {oquvchilar.map((o) => (
        <li key={o.id}>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[9px] border border-line px-3 py-1.5 text-[13.5px] hover:bg-surface-2">
            <input type="checkbox" name="oquvchi" value={o.id} defaultChecked={tanlangan?.has(o.id)} className="size-4.5 shrink-0" />
            <span className="flex min-w-0 flex-col">
              <span>{o.fish}</span>
              {izohlar?.get(o.id) && <span className="text-[11.5px] font-semibold text-warn">{izohlar.get(o.id)}</span>}
            </span>
          </label>
        </li>
      ))}
    </ul>
  )
}

/** Bitta buyurtma: ma'lumot + amallar (rahbariyat: berish/qaytarish; egasi: o'zgartirish/bekor) */
function BuyurtmaQatori({
  b, t, admin, egasi, qaytish, guruhdagilar, qr,
}: {
  b: Buyurtma
  t: Tafsilot
  admin: boolean
  egasi: boolean
  qaytish: string
  guruhdagilar?: Oquvchi[]
  qr?: React.ReactNode
}) {
  const qatorlar = t.qatorlar.get(b.id) ?? []
  const faollar = qatorlar.filter((q) => q.holat === 'faol')
  const qaytganlar = qatorlar.filter((q) => q.holat === 'qaytarildi')
  const ozgartirsa = b.holat === 'kutilmoqda' && (admin || egasi) && guruhdagilar
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13.5px] font-semibold">{b.kitob_nomi} × {faollar.length || b.soni}</span>
          <span className="tnum text-[11.5px] text-ink-3">
            <Link href={`${YOL}?kod=${b.kod}`} className="font-semibold text-ink-2 hover:text-brand">{b.kod}</Link>
            {' · '}{vaqtMatni(b.created_at)}
            {b.teacher_id ? ` · ${t.ustoz.get(b.teacher_id) ?? b.teacher_id}` : ''}
            {b.group_id ? ` · ${guruhUstozsiz(t.guruh.get(b.group_id) ?? b.group_id)}` : ''}
            {b.berildi_vaqt ? ` · berildi ${vaqtMatni(b.berildi_vaqt)}` : ''}
          </span>
        </span>
        <Badge ton={HOLAT[b.holat].ton}>{HOLAT[b.holat].nom}</Badge>
        {admin && b.holat === 'kutilmoqda' && (
          <form action={kitobBerildi}>
            <input type="hidden" name="kod" value={b.kod} />
            <input type="hidden" name="qaytish" value={qaytish} />
            <Button type="submit">Berildi</Button>
          </form>
        )}
      </div>
      {qr}
      {faollar.length > 0 && <p className="text-[12.5px] text-ink-2">{faollar.map((q) => q.fish).join(', ')}</p>}
      {qaytganlar.length > 0 && (
        <p className="text-[12px] text-ink-3">Qaytarildi: {qaytganlar.map((q) => `${q.fish}${q.sabab ? ` (${q.sabab})` : ''}`).join(', ')}</p>
      )}
      {(b.holat === 'bekor' || b.holat === 'qaytarildi') && b.bekor_sabab && <p className="text-[12px] text-ink-3">Sabab: {b.bekor_sabab}</p>}

      {ozgartirsa && (
        <details className="text-[12.5px]">
          <summary className="min-h-11 cursor-pointer content-center text-ink-3">O‘quvchilarni o‘zgartirish</summary>
          <form action={kitobBuyurtmaOzgartir} className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="kod" value={b.kod} />
            <input type="hidden" name="qaytish" value={qaytish} />
            <Belgilash oquvchilar={guruhdagilar!} tanlangan={new Set(faollar.map((q) => q.student_id))} />
            <div><Button type="submit" variant="ikkilamchi">Ro‘yxatni saqlash</Button></div>
          </form>
        </details>
      )}
      {b.holat === 'kutilmoqda' && (admin || egasi) && (
        <details className="text-[12.5px]">
          <summary className="min-h-11 cursor-pointer content-center text-ink-3">Bekor qilish</summary>
          <form action={kitobBekor} className="mt-2 flex flex-wrap gap-2">
            <input type="hidden" name="kod" value={b.kod} />
            <input type="hidden" name="qaytish" value={qaytish} />
            <input name="sabab" required minLength={3} maxLength={300} placeholder="Sabab (majburiy)" className={`${kirishKlass} max-w-sm flex-1`} />
            <Button type="submit" variant="ogohlantirish">Bekor qilish</Button>
          </form>
        </details>
      )}
      {admin && b.holat === 'berildi' && faollar.length > 0 && (
        <details className="text-[12.5px]">
          <summary className="min-h-11 cursor-pointer content-center text-ink-3">Qaytarish (omborga)</summary>
          <form action={kitobQaytar} className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="kod" value={b.kod} />
            <input type="hidden" name="qaytish" value={qaytish} />
            <Belgilash oquvchilar={faollar.map((q) => ({ id: q.student_id, fish: q.fish }))} />
            <div className="flex flex-wrap gap-2">
              <input name="sabab" required minLength={3} maxLength={300} placeholder="Sabab (majburiy)" className={`${kirishKlass} max-w-sm flex-1`} />
              <Button type="submit" variant="ogohlantirish">Qaytarish</Button>
            </div>
          </form>
        </details>
      )}
    </li>
  )
}

/** ?kod=KT-… — QR yoki qo'lda kiritilgan kod bo'yicha buyurtma */
async function KodKarta({ kod, xom, admin, ustozId }: { kod: string | null; xom: string; admin: boolean; ustozId: string | null }) {
  if (!kod) return <Card className="p-4 text-[13px] text-crit">Kod noto‘g‘ri: “{xom.slice(0, 20)}”. Masalan: KT-7K4P2X</Card>
  const supabase = await createClient()
  // RLS: rahbariyatga hammasi, ustozga faqat o'z buyurtmasi
  const { data } = await supabase.from('kitob_buyurtmalar').select('*').eq('kod', kod).maybeSingle()
  if (!data) return <Card className="p-4 text-[13px] text-crit">{kod} — buyurtma topilmadi yoki sizga ochiq emas.</Card>
  const b = data as Buyurtma
  const t = await tafsilot([b])
  const egasi = !!ustozId && b.teacher_id === ustozId
  const guruhdagilar = b.holat === 'kutilmoqda' && b.group_id ? (await guruhOquvchilari([b.group_id])).get(b.group_id) ?? [] : undefined
  return (
    <section className="flex flex-col gap-2">
      <h2 className="lbl">Buyurtma {kod}</h2>
      <Card className="overflow-hidden border-accent-line!">
        <ul>
          <BuyurtmaQatori
            b={b} t={t} admin={admin} egasi={egasi} qaytish={`${YOL}?kod=${kod}`} guruhdagilar={guruhdagilar}
            qr={b.holat === 'kutilmoqda' ? <div className="py-1"><KodQR kod={b.kod} /></div> : undefined}
          />
        </ul>
      </Card>
    </section>
  )
}

/* ------------------------------------------------------------ */
/* Qoldiq                                                        */
/* ------------------------------------------------------------ */

function QoldiqJadval({ qoldiq, fanNomi }: { qoldiq: Qoldiq[]; fanNomi?: Map<string, string> }) {
  if (qoldiq.length === 0) return <Bosh>Katalog bo‘sh. Avval “Katalog”da kitob qo‘shing.</Bosh>
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-ink-3">
            <th className="px-4 py-2.5 font-semibold">Kitob</th>
            <th className="px-3 py-2.5 text-right font-semibold">Kelgan</th>
            <th className="px-3 py-2.5 text-right font-semibold">Berilgan</th>
            <th className="px-3 py-2.5 text-right font-semibold">Omborda</th>
            <th className="px-3 py-2.5 text-right font-semibold">Band</th>
            <th className="px-4 py-2.5 text-right font-semibold">Bo‘sh</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {qoldiq.map((q) => (
            <tr key={q.kitob_id} className={q.holat === 'arxiv' ? 'opacity-60' : ''}>
              <td className="px-4 py-2.5">
                <span className="font-semibold">{q.nom}</span>
                <span className="block text-[11.5px] text-ink-3">
                  {(q.subject_id && fanNomi?.get(q.subject_id)) || 'Fan ko‘rsatilmagan'}
                  {q.holat === 'arxiv' ? ' · arxiv' : ''}
                  {q.qaytarilgan ? ` · qaytgan ${q.qaytarilgan}` : ''}
                </span>
              </td>
              <td className="tnum px-3 py-2.5 text-right">{q.kelgan}</td>
              <td className="tnum px-3 py-2.5 text-right">{q.berilgan}</td>
              <td className="tnum px-3 py-2.5 text-right font-semibold">{q.omborda}</td>
              <td className="tnum px-3 py-2.5 text-right text-ink-3">{q.band}</td>
              <td className={`tnum px-4 py-2.5 text-right font-semibold ${q.bosh <= 0 ? 'text-crit' : ''}`}>{q.bosh}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function QoldiqTab({ qoldiq, fanNomi }: { qoldiq: Qoldiq[]; fanNomi: Map<string, string> }) {
  const jami = qoldiq.reduce(
    (a, q) => ({ kelgan: a.kelgan + q.kelgan, berilgan: a.berilgan + q.berilgan, omborda: a.omborda + q.omborda, band: a.band + q.band }),
    { kelgan: 0, berilgan: 0, omborda: 0, band: 0 },
  )
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Kelgan" value={jami.kelgan} />
        <Stat label="Berilgan" value={jami.berilgan} />
        <Stat label="Omborda" value={jami.omborda} />
        <Stat label="Band (kutilmoqda)" value={jami.band} />
      </div>
      <QoldiqJadval qoldiq={qoldiq} fanNomi={fanNomi} />
      <p className="text-[12px] text-ink-3">
        Omborda = kelgan − berilgan (faqat “Berildi”dan keyin kamayadi, qaytarilgani omborga qaytadi). Band — kod olgan,
        hali berilmagan buyurtmalar. Yangi buyurtma bo‘sh qoldiqdan (omborda − band) oshmaydi.
      </p>
    </>
  )
}

/* ------------------------------------------------------------ */
/* Katalog                                                       */
/* ------------------------------------------------------------ */

function FanTanlash({ fanlar, qiymat }: { fanlar: { id: string; nom: string }[]; qiymat?: string | null }) {
  return (
    <select name="fan" className={kirishKlass} defaultValue={qiymat ?? ''}>
      <option value="">— tanlanmagan —</option>
      {fanlar.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
    </select>
  )
}

function KatalogTab({ qoldiq, fanlar, fanNomi }: { qoldiq: Qoldiq[]; fanlar: { id: string; nom: string }[]; fanNomi: Map<string, string> }) {
  return (
    <>
      <Card className="p-4">
        <form action={kitobQosh} className="flex flex-wrap items-end gap-2.5">
          <label className="flex min-w-56 flex-1 flex-col gap-1">
            <span className="lbl">Kitob nomi</span>
            <input name="nom" required maxLength={200} className={kirishKlass} placeholder="Masalan: Round Up 2" />
          </label>
          <label className="flex min-w-44 flex-col gap-1">
            <span className="lbl">Fan</span>
            <FanTanlash fanlar={fanlar} />
          </label>
          <label className="flex min-w-52 flex-1 flex-col gap-1">
            <span className="lbl">Izoh</span>
            <input name="izoh" maxLength={300} className={kirishKlass} placeholder="ixtiyoriy" />
          </label>
          <Button type="submit">Qo‘shish</Button>
        </form>
      </Card>
      {qoldiq.length === 0 ? (
        <Bosh>Hali kitob yo‘q.</Bosh>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {qoldiq.map((q) => {
              const harakatsiz = q.kelgan === 0 && q.berilgan === 0 && q.band === 0 && q.qaytarilgan === 0
              return (
                <li key={q.kitob_id} className="flex flex-col gap-2 px-4 py-2.5">
                  <div className="flex min-h-11 flex-wrap items-center gap-3">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[13.5px] font-semibold">{q.nom}</span>
                      <span className="text-[11.5px] text-ink-3">
                        {(q.subject_id && fanNomi.get(q.subject_id)) || 'Fan ko‘rsatilmagan'} · omborda {q.omborda}
                        {q.izoh ? ` · ${q.izoh}` : ''}
                      </span>
                    </span>
                    <Badge ton={q.holat === 'faol' ? 'ok' : 'jim'}>{q.holat === 'faol' ? 'Faol' : 'Arxiv'}</Badge>
                    <form action={kitobHolati}>
                      <input type="hidden" name="id" value={q.kitob_id} />
                      <input type="hidden" name="holat" value={q.holat === 'faol' ? 'arxiv' : 'faol'} />
                      <Button type="submit" variant="ikkilamchi">{q.holat === 'faol' ? 'Arxivga' : 'Faollashtirish'}</Button>
                    </form>
                  </div>
                  <details className="text-[12.5px]">
                    <summary className="min-h-11 cursor-pointer content-center text-ink-3">Tahrirlash{harakatsiz ? ' / o‘chirish' : ''}</summary>
                    <form action={kitobTahrir} className="mt-2 flex flex-wrap items-end gap-2.5">
                      <input type="hidden" name="id" value={q.kitob_id} />
                      <label className="flex min-w-56 flex-1 flex-col gap-1">
                        <span className="lbl">Nomi</span>
                        <input name="nom" required maxLength={200} defaultValue={q.nom} className={kirishKlass} />
                      </label>
                      <label className="flex min-w-44 flex-col gap-1">
                        <span className="lbl">Fan</span>
                        <FanTanlash fanlar={fanlar} qiymat={q.subject_id} />
                      </label>
                      <label className="flex min-w-52 flex-1 flex-col gap-1">
                        <span className="lbl">Izoh</span>
                        <input name="izoh" maxLength={300} defaultValue={q.izoh ?? ''} className={kirishKlass} />
                      </label>
                      <Button type="submit" variant="ikkilamchi">Saqlash</Button>
                    </form>
                    {harakatsiz ? (
                      <form action={kitobOchir} className="mt-2">
                        <input type="hidden" name="id" value={q.kitob_id} />
                        <Button type="submit" variant="ogohlantirish">Katalogdan o‘chirish</Button>
                      </form>
                    ) : (
                      <p className="mt-2 text-[12px] text-ink-3">Kirimi yoki buyurtmasi bor kitob o‘chirilmaydi — kerak bo‘lmasa arxivga o‘tkazing.</p>
                    )}
                  </details>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </>
  )
}

/* ------------------------------------------------------------ */
/* Kirim                                                         */
/* ------------------------------------------------------------ */

async function KirimTab({ qoldiq }: { qoldiq: Qoldiq[] }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('kitob_kirim')
    .select('id, sana, soni, izoh, kitob_id, bekor, bekor_sabab, tahrir_vaqt, profiles:kiritdi(ism)')
    .order('sana', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)
  const nom = new Map(qoldiq.map((q) => [q.kitob_id, q.nom]))
  const faol = qoldiq.filter((q) => q.holat === 'faol')
  const ro = (data ?? []) as unknown as {
    id: string; sana: string; soni: number; izoh: string | null; kitob_id: string
    bekor: boolean; bekor_sabab: string | null; tahrir_vaqt: string | null; profiles: { ism: string | null } | null
  }[]
  return (
    <>
      <Card className="p-4">
        {faol.length === 0 ? (
          <Empty>Avval “Katalog”da kitob qo‘shing.</Empty>
        ) : (
          <form action={kirimQosh} className="flex flex-wrap items-end gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="lbl">Sana</span>
              <input type="date" name="sana" defaultValue={bugunToshkent()} className={kirishKlass} />
            </label>
            <label className="flex min-w-52 flex-1 flex-col gap-1">
              <span className="lbl">Kitob</span>
              <select name="kitob" required className={kirishKlass} defaultValue="">
                <option value="" disabled>— tanlang —</option>
                {faol.map((q) => <option key={q.kitob_id} value={q.kitob_id}>{q.nom}</option>)}
              </select>
            </label>
            <label className="flex w-28 flex-col gap-1">
              <span className="lbl">Soni</span>
              <input type="number" name="soni" min={1} max={10000} required className={`${kirishKlass} tnum`} />
            </label>
            <label className="flex min-w-52 flex-1 flex-col gap-1">
              <span className="lbl">Izoh</span>
              <input name="izoh" maxLength={300} className={kirishKlass} placeholder="ixtiyoriy" />
            </label>
            <Button type="submit">Kirim qilish</Button>
          </form>
        )}
      </Card>
      {ro.length === 0 ? (
        <Bosh>Hali kirim yo‘q.</Bosh>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {ro.map((k) => (
              <li key={k.id} className={`flex flex-col gap-1.5 px-4 py-2.5 text-[13px] ${k.bekor ? 'opacity-60' : ''}`}>
                <div className="flex min-h-11 items-center gap-3">
                  <span className="tnum w-24 shrink-0 text-ink-3">{sana(k.sana)}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`font-semibold ${k.bekor ? 'line-through' : ''}`}>{nom.get(k.kitob_id) ?? 'Kitob'}</span>
                    <span className="text-[11.5px] text-ink-3">
                      {[k.profiles?.ism, k.izoh, k.tahrir_vaqt ? `tuzatilgan ${vaqtMatni(k.tahrir_vaqt)}` : null].filter(Boolean).join(' · ')}
                    </span>
                    {k.bekor && <span className="text-[11.5px] text-crit">Bekor qilingan: {k.bekor_sabab}</span>}
                  </span>
                  <span className={`tnum font-semibold ${k.bekor ? 'line-through' : ''}`}>+{k.soni}</span>
                </div>
                {!k.bekor && (
                  <details className="text-[12.5px]">
                    <summary className="min-h-11 cursor-pointer content-center text-ink-3">Tuzatish / bekor qilish</summary>
                    <form action={kirimTahrir} className="mt-2 flex flex-wrap items-end gap-2.5">
                      <input type="hidden" name="id" value={k.id} />
                      <label className="flex flex-col gap-1">
                        <span className="lbl">Sana</span>
                        <input type="date" name="sana" defaultValue={k.sana} className={kirishKlass} />
                      </label>
                      <label className="flex w-28 flex-col gap-1">
                        <span className="lbl">Soni</span>
                        <input type="number" name="soni" min={1} max={10000} required defaultValue={k.soni} className={`${kirishKlass} tnum`} />
                      </label>
                      <label className="flex min-w-52 flex-1 flex-col gap-1">
                        <span className="lbl">Izoh</span>
                        <input name="izoh" maxLength={300} defaultValue={k.izoh ?? ''} className={kirishKlass} />
                      </label>
                      <Button type="submit" variant="ikkilamchi">Saqlash</Button>
                    </form>
                    <form action={kirimBekor} className="mt-2 flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={k.id} />
                      <input name="sabab" required minLength={3} maxLength={300} placeholder="Bekor qilish sababi (majburiy)" className={`${kirishKlass} max-w-sm flex-1`} />
                      <Button type="submit" variant="ogohlantirish">Kirimni bekor qilish</Button>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

/* ------------------------------------------------------------ */
/* Buyurtmalar (rahbariyat)                                      */
/* ------------------------------------------------------------ */

async function BuyurtmalarTab() {
  const supabase = await createClient()
  const { data } = await supabase.from('kitob_buyurtmalar').select('*').order('created_at', { ascending: false }).limit(150)
  const ro = (data ?? []) as Buyurtma[]
  const t = await tafsilot(ro)
  const kutilmoqda = ro.filter((b) => b.holat === 'kutilmoqda')
  const tarix = ro.filter((b) => b.holat !== 'kutilmoqda')
  const qaytish = `${YOL}?tab=buyurtmalar`
  return (
    <>
      <Card className="flex flex-col gap-2 border-accent-line! bg-accent-soft! p-4">
        <span className="lbl">QR’ni telefon kamerasi bilan skanerlang yoki kodni kiriting</span>
        <form method="get" action={YOL} className="flex flex-wrap gap-2">
          <input type="hidden" name="tab" value="buyurtmalar" />
          <input
            name="kod"
            required
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="KT-7K4P2X"
            className={`${kirishKlass} tnum max-w-xs flex-1 uppercase tracking-[0.06em]`}
          />
          <Button type="submit">Ochish</Button>
        </form>
      </Card>
      <section className="flex flex-col gap-2">
        <h2 className="lbl">Kutilmoqda ({kutilmoqda.length})</h2>
        <Card className="overflow-hidden">
          {kutilmoqda.length === 0 ? <div className="p-5"><Empty>Kutilayotgan buyurtma yo‘q.</Empty></div> : (
            <ul className="divide-y divide-line">
              {kutilmoqda.map((b) => <BuyurtmaQatori key={b.id} b={b} t={t} admin egasi={false} qaytish={qaytish} />)}
            </ul>
          )}
        </Card>
      </section>
      {tarix.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="lbl">Tarix</h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {tarix.map((b) => <BuyurtmaQatori key={b.id} b={b} t={t} admin egasi={false} qaytish={qaytish} />)}
            </ul>
          </Card>
        </section>
      )}
    </>
  )
}

/* ------------------------------------------------------------ */
/* Hisobot                                                       */
/* ------------------------------------------------------------ */

async function HisobotTab({ qoldiq, dan, gacha }: { qoldiq: Qoldiq[]; dan: string | null; gacha: string | null }) {
  const bugun = bugunToshkent()
  const d = dan ?? `${bugun.slice(0, 7)}-01`
  const g = gacha ?? bugun
  const supabase = await createClient()
  const [{ data: davr }, { data: berilganlar }] = await Promise.all([
    supabase.rpc('kitob_hisobot', { p_dan: d, p_gacha: g }),
    supabase.rpc('kitob_berilganlar', { p_dan: d, p_gacha: g }),
  ])
  const dr = (davr ?? []).filter((r) => r.kelgan || r.berilgan || r.qaytarilgan)
  const br = berilganlar ?? []

  const ustozBoyicha = new Map<string, { berilgan: number; qaytgan: number }>()
  for (const r of br) {
    const k = r.ustoz ?? '—'
    const u = ustozBoyicha.get(k) ?? { berilgan: 0, qaytgan: 0 }
    u.berilgan += 1
    if (r.holat === 'qaytarildi') u.qaytgan += 1
    ustozBoyicha.set(k, u)
  }

  return (
    <>
      <Card className="p-4">
        <JonliForma className="flex flex-wrap items-end gap-2.5">
          <input type="hidden" name="tab" value="hisobot" />
          <label className="flex flex-col gap-1">
            <span className="lbl">Dan</span>
            <input type="date" name="dan" defaultValue={d} className={kirishKlass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="lbl">Gacha</span>
            <input type="date" name="gacha" defaultValue={g} className={kirishKlass} />
          </label>
          <Button href={`${YOL}/eksport?dan=${d}&gacha=${g}`} yuklab variant="ikkilamchi">Excel</Button>
        </JonliForma>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="lbl">Davr bo‘yicha ({sana(d)} – {sana(g)})</h2>
        {dr.length === 0 ? <Bosh>Bu davrda kirim ham, berish ham yo‘q.</Bosh> : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  <th className="px-4 py-2.5 font-semibold">Kitob</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Kelgan</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Berilgan</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Qaytgan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {dr.map((r) => (
                  <tr key={r.kitob_id}>
                    <td className="px-4 py-2.5 font-semibold">{r.nom}{r.holat === 'arxiv' ? <span className="font-normal text-ink-3"> · arxiv</span> : null}</td>
                    <td className="tnum px-3 py-2.5 text-right">{r.kelgan}</td>
                    <td className="tnum px-3 py-2.5 text-right">{r.berilgan}</td>
                    <td className="tnum px-4 py-2.5 text-right">{r.qaytarilgan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="lbl">Hozirgi qoldiq</h2>
        <QoldiqJadval qoldiq={qoldiq} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="lbl">Ustozlar bo‘yicha (davrda berilgan)</h2>
        <Card className="overflow-hidden">
          {ustozBoyicha.size === 0 ? <div className="p-5"><Empty>Bu davrda berilgan kitob yo‘q.</Empty></div> : (
            <ul className="divide-y divide-line">
              {[...ustozBoyicha.entries()].sort((a, b) => b[1].berilgan - a[1].berilgan).map(([ism, u]) => (
                <li key={ism} className="flex min-h-11 items-center justify-between px-4 py-2 text-[13px]">
                  <span>{ism}</span>
                  <span className="tnum font-semibold">{u.berilgan} ta{u.qaytgan ? <span className="font-normal text-ink-3"> · {u.qaytgan} qaytgan</span> : null}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="lbl">O‘quvchilar: kim nima olgan ({br.length})</h2>
        {br.length === 0 ? <Bosh>Bu davrda berilgan kitob yo‘q.</Bosh> : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  <th className="px-4 py-2.5 font-semibold">O‘quvchi</th>
                  <th className="px-3 py-2.5 font-semibold">Kitob</th>
                  <th className="px-3 py-2.5 font-semibold">Ustoz · guruh</th>
                  <th className="px-3 py-2.5 font-semibold">Berildi</th>
                  <th className="px-4 py-2.5 font-semibold">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {br.map((r) => (
                  <tr key={`${r.kod}-${r.student_id}`}>
                    <td className="px-4 py-2.5">{r.fish ?? r.student_id}</td>
                    <td className="px-3 py-2.5">{r.kitob}<span className="tnum block text-[11.5px] text-ink-3">{r.kod}</span></td>
                    <td className="px-3 py-2.5 text-ink-2">{[r.ustoz, r.guruh ? guruhUstozsiz(r.guruh) : null].filter(Boolean).join(' · ')}</td>
                    <td className="tnum px-3 py-2.5 text-ink-2">{vaqtMatni(r.berildi_vaqt)}</td>
                    <td className="px-4 py-2.5">
                      {r.holat === 'qaytarildi' ? <span className="text-ink-3">Qaytarildi{r.sabab ? `: ${r.sabab}` : ''}</span> : 'Olgan'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </>
  )
}

/* ------------------------------------------------------------ */
/* Ustoz: buyurtma berish va o'z buyurtmalari                    */
/* ------------------------------------------------------------ */

async function BuyurtmaBerishTab({ ustozId, guruhId, kitobId, qoldiq }: { ustozId: string; guruhId?: string; kitobId?: string; qoldiq: Qoldiq[] }) {
  const supabase = await createClient()
  // 0143 — QAT'IY: faqat doimiy guruhlar (zamena emas)
  const { data: guruhlar } = await supabase.from('groups').select('id, nom').eq('teacher_id', ustozId).eq('holat', 'faol').order('nom')
  const gl = (guruhlar ?? []) as { id: string; nom: string }[]
  if (gl.length === 0) return <Bosh>Sizda faol guruh yo‘q.</Bosh>
  const tanlangan = gl.find((g) => g.id === guruhId)?.id ?? (gl.length === 1 ? gl[0].id : null)
  const faol = qoldiq.filter((q) => q.holat === 'faol')
  const kitob = faol.find((q) => q.kitob_id === kitobId) ?? null

  const oquvchilar = tanlangan ? (await guruhOquvchilari([tanlangan])).get(tanlangan) ?? [] : []
  const izohlar = new Map<string, string>()
  if (kitob && oquvchilar.length) {
    const { data: takror } = await supabase.rpc('kitob_takroriy', { p_kitob: kitob.kitob_id, p_oquvchilar: oquvchilar.map((o) => o.id) })
    for (const r of takror ?? []) {
      if (izohlar.has(r.student_id)) continue
      izohlar.set(r.student_id, `Diqqat: ${r.holat === 'berildi' ? 'avval olgan' : 'kutmoqda'} — ${r.kod}, ${sana(r.sana)}`)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {gl.map((g) => (
          <Link
            key={g.id}
            href={`${YOL}?tab=buyurtma&guruh=${encodeURIComponent(g.id)}${kitob ? `&kitob=${kitob.kitob_id}` : ''}`}
            className={`inline-flex min-h-11 items-center rounded-[10px] border px-4 text-[13px] font-semibold ${
              g.id === tanlangan ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-2'
            }`}
          >
            {guruhUstozsiz(g.nom)}
          </Link>
        ))}
      </div>
      {!tanlangan ? (
        <Bosh>Guruhni tanlang.</Bosh>
      ) : faol.length === 0 ? (
        <Bosh>Katalogda faol kitob yo‘q — adminga ayting.</Bosh>
      ) : (
        <Card className="flex flex-col gap-3 p-4">
          <JonliForma className="flex max-w-md flex-col gap-1">
            <input type="hidden" name="tab" value="buyurtma" />
            <input type="hidden" name="guruh" value={tanlangan} />
            <label className="flex flex-col gap-1">
              <span className="lbl">1. Kitobni tanlang</span>
              <select name="kitob" className={kirishKlass} defaultValue={kitob?.kitob_id ?? ''}>
                <option value="">— tanlang —</option>
                {faol.map((q) => (
                  <option key={q.kitob_id} value={q.kitob_id} disabled={q.bosh <= 0}>
                    {q.nom} — bo‘sh {Math.max(q.bosh, 0)} ta
                  </option>
                ))}
              </select>
            </label>
          </JonliForma>
          {!kitob ? null : oquvchilar.length === 0 ? (
            <Empty>Bu guruhda faol o‘quvchi yo‘q.</Empty>
          ) : (
            <form action={kitobBuyurtmaBer} className="flex flex-col gap-3">
              <input type="hidden" name="guruh" value={tanlangan} />
              <input type="hidden" name="kitob" value={kitob.kitob_id} />
              <fieldset className="flex flex-col gap-1">
                <legend className="lbl mb-1">2. Kitob oladigan o‘quvchilar (soni = belgilanganlar, bo‘sh {Math.max(kitob.bosh, 0)} ta)</legend>
                <Belgilash oquvchilar={oquvchilar} izohlar={izohlar} />
              </fieldset>
              {izohlar.size > 0 && (
                <p className="text-[12px] text-warn">{izohlar.size} ta o‘quvchi bu kitobni avval olgan yoki kutmoqda — buyurtma baribir qabul qilinadi.</p>
              )}
              <div><Button type="submit">Buyurtma berish</Button></div>
              <p className="text-[12px] text-ink-3">Omborda yetarli bo‘lmasa buyurtma qabul qilinmaydi. Tanaffusdagi va arxivdagi o‘quvchilar ro‘yxatda yo‘q.</p>
            </form>
          )}
        </Card>
      )}
    </>
  )
}

async function MeningTab({ ustozId }: { ustozId: string }) {
  const supabase = await createClient()
  const { data } = await supabase.from('kitob_buyurtmalar').select('*').eq('teacher_id', ustozId).order('created_at', { ascending: false }).limit(100)
  const ro = (data ?? []) as Buyurtma[]
  if (ro.length === 0) return <Bosh>Hali buyurtma yo‘q.</Bosh>
  const t = await tafsilot(ro)
  const kutilmoqda = ro.filter((b) => b.holat === 'kutilmoqda')
  const guruhdagilar = await guruhOquvchilari([...new Set(kutilmoqda.map((b) => b.group_id).filter((g): g is string => !!g))])
  const qaytish = `${YOL}?tab=mening`
  const qrlar = new Map(await Promise.all(kutilmoqda.map(async (b) => [b.id, await KodQR({ kod: b.kod, olcham: 132 })] as const)))
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-line">
        {ro.map((b) => (
          <BuyurtmaQatori
            key={b.id} b={b} t={t} admin={false} egasi qaytish={qaytish}
            guruhdagilar={b.group_id ? guruhdagilar.get(b.group_id) ?? [] : undefined}
            qr={qrlar.get(b.id)}
          />
        ))}
      </ul>
    </Card>
  )
}

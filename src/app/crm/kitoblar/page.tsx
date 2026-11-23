import Link from 'next/link'
import { redirect } from 'next/navigation'
import { talabProfil, getUstoz, adminmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Empty, Badge, Button, Stat } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar, kirishKlass } from '@/components/forma'
import { bugunToshkent, guruhUstozsiz, sana } from '@/lib/format'
import { kirimQosh, kitobBekor, kitobBerildi, kitobBuyurtmaBer, kitobHolati, kitobQosh } from './actions'

export const metadata = { title: 'Kitoblar' }
export const dynamic = 'force-dynamic'

/*
 * 0142 — kitoblar hisobi. Kitob kurs narxiga kiradi: to'lov/qarzga bog'lanmaydi.
 * Rahbariyat (direktor, admin, manager): qoldiq, katalog, kirim, buyurtmalar, hisobot.
 * Ustoz: o'z guruhidan o'quvchilarni belgilab buyurtma, o'z buyurtmalari.
 */

type Qoldiq = {
  kitob_id: string; nom: string; subject_id: string | null; holat: 'faol' | 'arxiv'
  kelgan: number; berilgan: number; band: number; omborda: number; bosh: number
}
type Buyurtma = {
  id: string; kod: string; kitob_id: string; kitob_nomi: string; teacher_id: string | null; group_id: string | null
  soni: number; holat: 'kutilmoqda' | 'berildi' | 'bekor'; created_at: string; berildi_vaqt: string | null; bekor_sabab: string | null
}

const HOLAT: Record<Buyurtma['holat'], { nom: string; ton: 'ok' | 'accent' | 'jim' }> = {
  kutilmoqda: { nom: 'Kutilmoqda', ton: 'accent' },
  berildi: { nom: 'Berildi', ton: 'ok' },
  bekor: { nom: 'Bekor', ton: 'jim' },
}

function vaqtMatni(iso: string) {
  return new Date(iso).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default async function KitoblarSahifa({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; guruh?: string; ok?: string; xato?: string }>
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
  const tab = tablar.find((t) => t.id === s.tab)?.id ?? tablar[0].id

  const supabase = await createClient()
  const { data: qoldiqXom } = await supabase.rpc('kitob_qoldiq')
  const qoldiq = (qoldiqXom ?? []) as Qoldiq[]
  const { data: fanlar } = await supabase.from('subjects').select('id, nom').order('tartib')
  const fanNomi = new Map((fanlar ?? []).map((f) => [f.id as string, f.nom as string]))

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Kitoblar" izoh="kelgan, berilgan va qolgan kitoblar · kurs narxiga kiradi" />
      <nav className="flex flex-wrap gap-1.5">
        {tablar.map((t) => (
          <Link
            key={t.id}
            href={`/crm/kitoblar?tab=${t.id}`}
            className={`inline-flex min-h-11 items-center rounded-[10px] px-4 text-[13.5px] font-semibold transition ${
              t.id === tab ? 'bg-brand text-white' : 'bg-surface-2 text-ink-2 hover:text-ink'
            }`}
          >
            {t.nom}
          </Link>
        ))}
      </nav>
      <Xabar ok={s.ok} xato={s.xato} />

      {tab === 'qoldiq' && <QoldiqTab qoldiq={qoldiq} fanNomi={fanNomi} />}
      {tab === 'katalog' && <KatalogTab qoldiq={qoldiq} fanlar={(fanlar ?? []) as { id: string; nom: string }[]} fanNomi={fanNomi} />}
      {tab === 'kirim' && <KirimTab qoldiq={qoldiq} />}
      {tab === 'buyurtmalar' && <BuyurtmalarTab />}
      {tab === 'hisobot' && <HisobotTab qoldiq={qoldiq} />}
      {tab === 'buyurtma' && ustoz && <BuyurtmaBerishTab ustozId={ustoz.id} guruhId={s.guruh} qoldiq={qoldiq} />}
      {tab === 'mening' && ustoz && <MeningTab ustozId={ustoz.id} />}
    </div>
  )
}

/* ------------------------------------------------------------ */

function QoldiqJadval({ qoldiq, fanNomi }: { qoldiq: Qoldiq[]; fanNomi?: Map<string, string> }) {
  if (qoldiq.length === 0) return <Card className="p-6"><Empty>Katalog bo‘sh. Avval “Katalog”da kitob qo‘shing.</Empty></Card>
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
        Omborda = kelgan − berilgan (faqat “Berildi”dan keyin kamayadi). Band — kod olgan, hali berilmagan buyurtmalar.
        Yangi buyurtma bo‘sh qoldiqdan (omborda − band) oshmaydi.
      </p>
    </>
  )
}

function KatalogTab({ qoldiq, fanlar, fanNomi }: { qoldiq: Qoldiq[]; fanlar: { id: string; nom: string }[]; fanNomi: Map<string, string> }) {
  return (
    <>
      <Card className="p-4">
        <form action={kitobQosh} className="flex flex-wrap items-end gap-2.5">
          <label className="flex min-w-56 flex-1 flex-col gap-1">
            <span className="lbl">Kitob nomi</span>
            <input name="nom" required maxLength={200} className={kirishKlass} placeholder="Masalan: Kid’s Box 1" />
          </label>
          <label className="flex min-w-44 flex-col gap-1">
            <span className="lbl">Fan</span>
            <select name="fan" className={kirishKlass} defaultValue="">
              <option value="">— tanlanmagan —</option>
              {fanlar.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </label>
          <Button type="submit">Qo‘shish</Button>
        </form>
      </Card>
      {qoldiq.length === 0 ? (
        <Card className="p-6"><Empty>Hali kitob yo‘q.</Empty></Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {qoldiq.map((q) => (
              <li key={q.kitob_id} className="flex min-h-14 flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[13.5px] font-semibold">{q.nom}</span>
                  <span className="text-[11.5px] text-ink-3">{(q.subject_id && fanNomi.get(q.subject_id)) || 'Fan ko‘rsatilmagan'} · omborda {q.omborda}</span>
                </span>
                <Badge ton={q.holat === 'faol' ? 'ok' : 'jim'}>{q.holat === 'faol' ? 'Faol' : 'Arxiv'}</Badge>
                <form action={kitobHolati}>
                  <input type="hidden" name="id" value={q.kitob_id} />
                  <input type="hidden" name="holat" value={q.holat === 'faol' ? 'arxiv' : 'faol'} />
                  <Button type="submit" variant="ikkilamchi">{q.holat === 'faol' ? 'Arxivga' : 'Faollashtirish'}</Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

async function KirimTab({ qoldiq }: { qoldiq: Qoldiq[] }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('kitob_kirim')
    .select('id, sana, soni, izoh, kitob_id, created_at, profiles:kiritdi(ism)')
    .order('sana', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)
  const nom = new Map(qoldiq.map((q) => [q.kitob_id, q.nom]))
  const faol = qoldiq.filter((q) => q.holat === 'faol')
  const ro = (data ?? []) as unknown as { id: string; sana: string; soni: number; izoh: string | null; kitob_id: string; profiles: { ism: string | null } | null }[]
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
        <Card className="p-6"><Empty>Hali kirim yo‘q.</Empty></Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {ro.map((k) => (
              <li key={k.id} className="flex min-h-12 items-center gap-3 px-4 py-2.5 text-[13px]">
                <span className="tnum w-24 shrink-0 text-ink-3">{sana(k.sana)}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{nom.get(k.kitob_id) ?? 'Kitob'}</span>
                  <span className="text-[11.5px] text-ink-3">{[k.profiles?.ism, k.izoh].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="tnum font-semibold">+{k.soni}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

async function buyurtmaTafsiloti(ro: Buyurtma[]) {
  const supabase = await createClient()
  const ids = ro.map((b) => b.id)
  const [{ data: bo }, { data: ustozlar }, { data: guruhlar }] = await Promise.all([
    ids.length
      ? supabase.from('kitob_buyurtma_oquvchilar').select('buyurtma_id, student_id, students(fish)').in('buyurtma_id', ids)
      : Promise.resolve({ data: [] }),
    supabase.from('teachers').select('id, ism'),
    supabase.from('groups').select('id, nom'),
  ])
  const oquvchilar = new Map<string, string[]>()
  for (const r of (bo ?? []) as unknown as { buyurtma_id: string; student_id: string; students: { fish: string } | null }[]) {
    const l = oquvchilar.get(r.buyurtma_id) ?? []
    l.push(r.students?.fish ?? r.student_id)
    oquvchilar.set(r.buyurtma_id, l)
  }
  return {
    oquvchilar,
    ustoz: new Map((ustozlar ?? []).map((u) => [u.id as string, u.ism as string])),
    guruh: new Map((guruhlar ?? []).map((g) => [g.id as string, g.nom as string])),
  }
}

function BuyurtmaQatori({
  b, t, admin, qaytish,
}: {
  b: Buyurtma
  t: Awaited<ReturnType<typeof buyurtmaTafsiloti>>
  admin: boolean
  qaytish: 'buyurtmalar' | 'mening'
}) {
  const ism = t.oquvchilar.get(b.id) ?? []
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13.5px] font-semibold">{b.kitob_nomi} × {b.soni}</span>
          <span className="tnum text-[11.5px] text-ink-3">
            {b.kod} · {vaqtMatni(b.created_at)}
            {b.teacher_id ? ` · ${t.ustoz.get(b.teacher_id) ?? b.teacher_id}` : ''}
            {b.group_id ? ` · ${guruhUstozsiz(t.guruh.get(b.group_id) ?? b.group_id)}` : ''}
          </span>
        </span>
        <Badge ton={HOLAT[b.holat].ton}>{HOLAT[b.holat].nom}</Badge>
        {admin && b.holat === 'kutilmoqda' && (
          <form action={kitobBerildi}>
            <input type="hidden" name="kod" value={b.kod} />
            <Button type="submit">Berildi</Button>
          </form>
        )}
      </div>
      {ism.length > 0 && <p className="text-[12px] text-ink-2">{ism.sort((a, c) => a.localeCompare(c, 'uz')).join(', ')}</p>}
      {b.holat === 'bekor' && b.bekor_sabab && <p className="text-[12px] text-ink-3">Sabab: {b.bekor_sabab}</p>}
      {b.holat === 'kutilmoqda' && (
        <details className="text-[12.5px]">
          <summary className="cursor-pointer text-ink-3">Bekor qilish</summary>
          <form action={kitobBekor} className="mt-2 flex flex-wrap gap-2">
            <input type="hidden" name="kod" value={b.kod} />
            <input type="hidden" name="qaytish" value={qaytish} />
            <input name="sabab" required minLength={3} maxLength={300} placeholder="Sabab (majburiy)" className={`${kirishKlass} max-w-sm flex-1`} />
            <Button type="submit" variant="ogohlantirish">Bekor qilish</Button>
          </form>
        </details>
      )}
    </li>
  )
}

async function BuyurtmalarTab() {
  const supabase = await createClient()
  const { data } = await supabase.from('kitob_buyurtmalar').select('*').order('created_at', { ascending: false }).limit(150)
  const ro = (data ?? []) as Buyurtma[]
  const t = await buyurtmaTafsiloti(ro)
  const kutilmoqda = ro.filter((b) => b.holat === 'kutilmoqda')
  const tarix = ro.filter((b) => b.holat !== 'kutilmoqda')
  return (
    <>
      <Card className="flex flex-col gap-2 border-accent-line! bg-accent-soft! p-4">
        <span className="lbl">Ustoz aytgan kodni kiriting — kitob beriladi va ombordan ayiriladi</span>
        <form action={kitobBerildi} className="flex flex-wrap gap-2">
          <input
            name="kod"
            required
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="KT-7K4P2X"
            className={`${kirishKlass} tnum max-w-xs flex-1 uppercase tracking-[0.06em]`}
          />
          <Button type="submit">Berildi</Button>
        </form>
      </Card>
      <section className="flex flex-col gap-2">
        <h2 className="lbl">Kutilmoqda ({kutilmoqda.length})</h2>
        <Card className="overflow-hidden">
          {kutilmoqda.length === 0 ? <div className="p-5"><Empty>Kutilayotgan buyurtma yo‘q.</Empty></div> : (
            <ul className="divide-y divide-line">{kutilmoqda.map((b) => <BuyurtmaQatori key={b.id} b={b} t={t} admin qaytish="buyurtmalar" />)}</ul>
          )}
        </Card>
      </section>
      {tarix.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="lbl">Tarix</h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">{tarix.map((b) => <BuyurtmaQatori key={b.id} b={b} t={t} admin qaytish="buyurtmalar" />)}</ul>
          </Card>
        </section>
      )}
    </>
  )
}

async function HisobotTab({ qoldiq }: { qoldiq: Qoldiq[] }) {
  const supabase = await createClient()
  const { data } = await supabase.from('kitob_buyurtmalar').select('id, kitob_id, kitob_nomi, teacher_id, soni, holat').eq('holat', 'berildi')
  const berilgan = (data ?? []) as Pick<Buyurtma, 'id' | 'kitob_id' | 'kitob_nomi' | 'teacher_id' | 'soni' | 'holat'>[]
  const ids = berilgan.map((b) => b.id)
  const [{ data: bo }, { data: ustozlar }] = await Promise.all([
    ids.length
      ? supabase.from('kitob_buyurtma_oquvchilar').select('buyurtma_id, student_id, students(fish)').in('buyurtma_id', ids)
      : Promise.resolve({ data: [] }),
    supabase.from('teachers').select('id, ism'),
  ])
  const ustozIsm = new Map((ustozlar ?? []).map((u) => [u.id as string, u.ism as string]))
  const kitobi = new Map(berilgan.map((b) => [b.id, b.kitob_nomi]))

  const ustozBoyicha = new Map<string, number>()
  for (const b of berilgan) {
    const k = b.teacher_id ?? '—'
    ustozBoyicha.set(k, (ustozBoyicha.get(k) ?? 0) + b.soni)
  }
  const oquvchiBoyicha = new Map<string, { fish: string; kitoblar: string[] }>()
  for (const r of (bo ?? []) as unknown as { buyurtma_id: string; student_id: string; students: { fish: string } | null }[]) {
    const o = oquvchiBoyicha.get(r.student_id) ?? { fish: r.students?.fish ?? r.student_id, kitoblar: [] }
    o.kitoblar.push(kitobi.get(r.buyurtma_id) ?? 'Kitob')
    oquvchiBoyicha.set(r.student_id, o)
  }
  const ustozRo = [...ustozBoyicha.entries()].sort((a, b) => b[1] - a[1])
  const oquvchiRo = [...oquvchiBoyicha.values()].sort((a, b) => a.fish.localeCompare(b.fish, 'uz'))

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="lbl">Har kitob bo‘yicha</h2>
        <QoldiqJadval qoldiq={qoldiq} />
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="lbl">Ustozlar bo‘yicha (berilgan)</h2>
          <Card className="overflow-hidden">
            {ustozRo.length === 0 ? <div className="p-5"><Empty>Hali berilgan kitob yo‘q.</Empty></div> : (
              <ul className="divide-y divide-line">
                {ustozRo.map(([id, n]) => (
                  <li key={id} className="flex min-h-11 items-center justify-between px-4 py-2 text-[13px]">
                    <span>{ustozIsm.get(id) ?? id}</span>
                    <span className="tnum font-semibold">{n} ta</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="lbl">O‘quvchilar bo‘yicha (berilgan)</h2>
          <Card className="overflow-hidden">
            {oquvchiRo.length === 0 ? <div className="p-5"><Empty>Hali berilgan kitob yo‘q.</Empty></div> : (
              <ul className="divide-y divide-line">
                {oquvchiRo.map((o) => (
                  <li key={o.fish} className="flex min-h-11 items-center gap-3 px-4 py-2 text-[13px]">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span>{o.fish}</span>
                      <span className="text-[11.5px] text-ink-3">{o.kitoblar.join(', ')}</span>
                    </span>
                    <span className="tnum font-semibold">{o.kitoblar.length} ta</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </>
  )
}

async function BuyurtmaBerishTab({ ustozId, guruhId, qoldiq }: { ustozId: string; guruhId?: string; qoldiq: Qoldiq[] }) {
  const supabase = await createClient()
  const { data: guruhlar } = await supabase.from('groups').select('id, nom').eq('teacher_id', ustozId).eq('holat', 'faol').order('nom')
  const gl = (guruhlar ?? []) as { id: string; nom: string }[]
  if (gl.length === 0) return <Card className="p-6"><Empty>Sizda faol guruh yo‘q.</Empty></Card>
  const tanlangan = gl.find((g) => g.id === guruhId)?.id ?? (gl.length === 1 ? gl[0].id : null)

  const { data: qatnashuv } = tanlangan
    ? await supabase.from('enrollments').select('student_id, students(fish, holat)').eq('group_id', tanlangan).neq('holat', 'tugagan')
    : { data: [] }
  const oquvchilar = ((qatnashuv ?? []) as unknown as { student_id: string; students: { fish: string; holat: string } | null }[])
    .filter((e) => !e.students?.holat || e.students.holat === 'faol')
    .map((e) => ({ id: e.student_id, fish: e.students?.fish ?? e.student_id }))
    .sort((a, b) => a.fish.localeCompare(b.fish, 'uz'))
  const faol = qoldiq.filter((q) => q.holat === 'faol')

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {gl.map((g) => (
          <Link
            key={g.id}
            href={`/crm/kitoblar?tab=buyurtma&guruh=${encodeURIComponent(g.id)}`}
            className={`inline-flex min-h-11 items-center rounded-[10px] border px-4 text-[13px] font-semibold ${
              g.id === tanlangan ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-2'
            }`}
          >
            {guruhUstozsiz(g.nom)}
          </Link>
        ))}
      </div>
      {!tanlangan ? (
        <Card className="p-6"><Empty>Guruhni tanlang.</Empty></Card>
      ) : faol.length === 0 ? (
        <Card className="p-6"><Empty>Katalogda faol kitob yo‘q — adminga ayting.</Empty></Card>
      ) : oquvchilar.length === 0 ? (
        <Card className="p-6"><Empty>Bu guruhda faol o‘quvchi yo‘q.</Empty></Card>
      ) : (
        <Card className="p-4">
          <form action={kitobBuyurtmaBer} className="flex flex-col gap-3">
            <input type="hidden" name="guruh" value={tanlangan} />
            <label className="flex max-w-md flex-col gap-1">
              <span className="lbl">Kitob</span>
              <select name="kitob" required className={kirishKlass} defaultValue="">
                <option value="" disabled>— tanlang —</option>
                {faol.map((q) => (
                  <option key={q.kitob_id} value={q.kitob_id} disabled={q.bosh <= 0}>
                    {q.nom} — bo‘sh {Math.max(q.bosh, 0)} ta
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="flex flex-col gap-1">
              <legend className="lbl mb-1">Kitob oladigan o‘quvchilar (soni = belgilanganlar)</legend>
              <ul className="grid gap-1 sm:grid-cols-2">
                {oquvchilar.map((o) => (
                  <li key={o.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[9px] border border-line px-3 text-[13.5px] hover:bg-surface-2">
                      <input type="checkbox" name="oquvchi" value={o.id} className="size-4.5" />
                      {o.fish}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            <div><Button type="submit">Buyurtma berish</Button></div>
            <p className="text-[12px] text-ink-3">Omborda yetarli bo‘lmasa buyurtma qabul qilinmaydi. Kodni adminga ayting — u kitobni beradi.</p>
          </form>
        </Card>
      )}
    </>
  )
}

async function MeningTab({ ustozId }: { ustozId: string }) {
  const supabase = await createClient()
  const { data } = await supabase.from('kitob_buyurtmalar').select('*').eq('teacher_id', ustozId).order('created_at', { ascending: false }).limit(100)
  const ro = (data ?? []) as Buyurtma[]
  const t = await buyurtmaTafsiloti(ro)
  if (ro.length === 0) return <Card className="p-6"><Empty>Hali buyurtma yo‘q.</Empty></Card>
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-line">{ro.map((b) => <BuyurtmaQatori key={b.id} b={b} t={t} admin={false} qaytish="mening" />)}</ul>
    </Card>
  )
}

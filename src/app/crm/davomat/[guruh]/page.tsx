import Link from 'next/link'
import { notFound } from 'next/navigation'
import { talabRol, getUstoz, adminmi, ustozRejimi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Empty, Badge } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { IconArrowLeft } from '@/components/icons'
import { sana as sanaFmt, vaqt, bugunToshkent, kunlarNomi, haftaKuni, davrQisqa, HAFTA_KUNLARI, guruhQisqa } from '@/lib/format'
import { Jurnal, type JurnalQatori, type DarsKuni, type Huquq } from './jurnal'
import type { AttendanceStatus } from '@/lib/types'
import type { WoblarLimiti } from '@/lib/woblar-chegara'
import { WoblarLimitKartasi } from '@/components/woblar-limit'
import { zamenaSaqla, darsKochir } from './actions'

export const metadata = { title: 'Davomat jurnali' }
export const dynamic = 'force-dynamic'

/** "2026-09" → [yil, oy] */
function oyAjrat(davr: string): [number, number] {
  const [y, m] = davr.split('-').map(Number)
  return [y, m]
}

function oyQosh(davr: string, n: number): string {
  const [y, m] = oyAjrat(davr)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Oyning hamma kunlari "YYYY-MM-DD" */
function oyKunlari(davr: string): string[] {
  const [y, m] = oyAjrat(davr)
  const soni = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: soni }, (_, i) => `${davr}-${String(i + 1).padStart(2, '0')}`)
}

/**
 * Guruhning oylik davomat jurnali.
 *
 * Ustunlar — shu oyda guruhning DARS KUNLARI (groups.kunlar, 0028) va
 * shu oyda ochilgan har qanday dars (kunlar keyin o'zgargan bo'lsa ham
 * eski belgilar yo'qolmaydi). Oylar tasmasidan o'tgan oylar ochiladi.
 * Ustozga RLS faqat o'z guruhini beradi — boshqa guruh 404.
 */
export default async function DavomatJurnali({
  params,
  searchParams,
}: {
  params: Promise<{ guruh: string }>
  searchParams: Promise<{ oy?: string; ok?: string; xato?: string }>
}) {
  const [{ guruh }, s] = await Promise.all([params, searchParams])
  const profil = await talabRol('admin', 'direktor', 'qabulxona', 'ustoz')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Davomat" />

  const supabase = await createClient()
  const bugun = bugunToshkent()
  const joriy = bugun.slice(0, 7)
  const davr = /^\d{4}-(0[1-9]|1[0-2])$/.test(s.oy ?? '') ? s.oy! : joriy

  const [{ data: g }, ustoz] = await Promise.all([
    supabase
      .from('groups')
      .select('id, nom, boshlanish, tugash, kunlar, created_at, teacher_id, teachers(ism), subjects(nom)')
      .eq('id', guruh)
      .maybeSingle(),
    getUstoz(),
  ])
  if (!g) notFound()

  const guruhi = g as unknown as {
    id: string
    nom: string
    boshlanish: string
    tugash: string
    kunlar: number[]
    created_at: string
    teacher_id: string | null
    teachers: { ism: string } | null
    subjects: { nom: string } | null
  }

  const oyBoshi = `${davr}-01`
  const oyOxiri = oyKunlari(davr).at(-1)!

  const [{ data: yozilishlar }, { data: darslar }, { data: birinchiDars }] = await Promise.all([
    supabase
      .from('enrollments')
      .select('student_id, boshlandi, tugadi, holat, students(fish)')
      .eq('group_id', guruh)
      .lte('boshlandi', oyOxiri),
    supabase.from('lessons').select('id, sana, otkazildi, zamena_teacher_id, zamena_sabab, kochirildi_ga, kochirilgan_dan, kochirish_sabab').eq('group_id', guruh).gte('sana', oyBoshi).lte('sana', oyOxiri),
    supabase.from('lessons').select('sana').eq('group_id', guruh).order('sana').limit(1).maybeSingle(),
  ])

  type Yozilish = {
    student_id: string
    boshlandi: string
    tugadi: string | null
    holat: string
    students: { fish: string } | null
  }
  // Shu oyda guruhda bo'lganlar: oy tugashidan oldin kelgan, oy boshlanishidan oldin ketmagan
  const yList = ((yozilishlar ?? []) as unknown as Yozilish[]).filter((y) => !y.tugadi || y.tugadi >= oyBoshi)
  const dList = (darslar ?? []) as {
    id: string
    sana: string
    otkazildi: boolean
    zamena_teacher_id: string | null
    zamena_sabab: string | null
    kochirildi_ga: string | null
    kochirilgan_dan: string | null
    kochirish_sabab: string | null
  }[]

  /* Kanikul / bayram (0036) — ustun qoladi, lekin "dam": davomat so'ralmaydi */
  const { data: damlar } = await supabase.from('dam_kunlar').select('sana, sabab').gte('sana', oyBoshi).lte('sana', oyOxiri)
  const dam = new Map(((damlar ?? []) as { sana: string; sabab: string }[]).map((d) => [d.sana, d.sabab]))
  // 0079 — boshqa kunga ko'chirilgan dars: ustun qoladi, lekin davomat so'ralmaydi
  for (const d of dList) if (d.kochirildi_ga) dam.set(d.sana, `Ko‘chirildi → ${d.kochirildi_ga.slice(8, 10)}.${d.kochirildi_ga.slice(5, 7)}`)

  /* Ustunlar: guruh kunlariga tushgan sanalar + shu oyda ochilgan darslar */
  const darsSanalari = new Set(dList.map((d) => d.sana))
  const kunlar: DarsKuni[] = oyKunlari(davr)
    .filter((sana) => guruhi.kunlar.includes(haftaKuni(sana)) || darsSanalari.has(sana))
    .map((sana) => ({ sana, kun: haftaKuni(sana), hafta: HAFTA_KUNLARI[haftaKuni(sana) - 1].qisqa, dam: dam.get(sana) ?? null }))

  const darsIdlar = dList.map((d) => d.id)
  const sanaById = new Map(dList.map((d) => [d.id, d.sana]))
  const bugungiDars = dList.find((d) => d.sana === bugun)
  const talabalar = yList.map((y) => y.student_id)

  const [{ data: belgilar }, { data: bugungiWoblar }, { data: balanslar }, { data: probniylar }, { data: probniyWoblar }] = await Promise.all([
    darsIdlar.length
      ? supabase.from('attendance').select('lesson_id, student_id, holat').in('lesson_id', darsIdlar)
      : Promise.resolve({ data: [] }),
    bugungiDars
      ? supabase.from('woblr').select('student_id, ball').eq('lesson_id', bugungiDars.id)
      : Promise.resolve({ data: [] }),
    talabalar.length
      ? supabase.from('v_woblr_balance').select('student_id, balans').in('student_id', talabalar)
      : Promise.resolve({ data: [] }),
    // Probniylar (0030) — ustozga ham faqat ism va belgilar, telefon yo'q
    supabase.rpc('jurnal_probniylar', { p_group: guruh, p_dan: oyBoshi, p_gacha: oyOxiri }),
    // Probniy woblari (0073) — doimiy bo'lganda o'quvchiga ko'chadi
    supabase.rpc('jurnal_probniy_woblar', { p_group: guruh, p_sana: bugun }),
  ])
  const pWoblar = new Map(
    ((probniyWoblar ?? []) as { lead_id: string; bugun: number; jami: number }[]).map((w) => [w.lead_id, w]),
  )

  const belgiXaritasi = new Map<string, Record<string, AttendanceStatus>>()
  for (const b of (belgilar ?? []) as { lesson_id: string; student_id: string; holat: AttendanceStatus }[]) {
    const sana = sanaById.get(b.lesson_id)
    if (!sana) continue
    belgiXaritasi.set(b.student_id, { ...(belgiXaritasi.get(b.student_id) ?? {}), [sana]: b.holat })
  }
  const bugunBall = new Map<string, number>()
  for (const w of (bugungiWoblar ?? []) as { student_id: string; ball: number }[]) {
    bugunBall.set(w.student_id, (bugunBall.get(w.student_id) ?? 0) + Number(w.ball))
  }
  const balans = new Map(
    ((balanslar ?? []) as { student_id: string; balans: number }[]).map((b) => [b.student_id, Number(b.balans) || 0]),
  )

  const probniyQatorlar: JurnalQatori[] = ((probniylar ?? []) as { lead_id: string; ism: string; dan: string; belgilar: Record<string, AttendanceStatus> }[]).map((p) => ({
    student_id: p.lead_id,
    probniy: true,
    fish: p.ism,
    boshlandi: p.dan,
    tugadi: null,
    ketgan: false,
    belgilar: p.belgilar ?? {},
    bugun: Number(pWoblar.get(p.lead_id)?.bugun) || 0,
    umumiy: Number(pWoblar.get(p.lead_id)?.jami) || 0,
  }))

  const qatorlar: JurnalQatori[] = yList
    .map((y) => ({
      student_id: y.student_id,
      fish: y.students?.fish ?? y.student_id,
      boshlandi: y.boshlandi,
      tugadi: y.tugadi,
      ketgan: y.holat === 'tugagan',
      belgilar: belgiXaritasi.get(y.student_id) ?? {},
      bugun: bugunBall.get(y.student_id) ?? 0,
      umumiy: balans.get(y.student_id) ?? 0,
    }))
    .sort((a, b) => Number(a.ketgan) - Number(b.ketgan) || a.fish.localeCompare(b.fish, 'uz'))
    .concat(probniyQatorlar)

  /* Huquq: admin/direktor — o'tgan kunlar ham; guruh ustozi — faqat bugun;
     qabulxona — faqat ko'radi. Bazada ham xuddi shunday (davomat_belgila). */
  /* 0075 — zamena: o'rinbosar ustoz bugungi darsni guruh ustozidek belgilaydi */
  const zamenaBugun = Boolean(ustoz && bugungiDars?.zamena_teacher_id === ustoz.id)
  const guruhUstozi = Boolean(ustoz && ustoz.id === guruhi.teacher_id)
  if (ustozRejimi(profil) && !guruhUstozi && !zamenaBugun) notFound()
  const huquq: Huquq = adminmi(profil.rol)
    ? 'hammasi'
    : guruhUstozi || zamenaBugun
      ? 'bugun'
      : 'yoq'

  /* Oylar tasmasi: guruh ochilgan (yoki birinchi dars) oydan — joriy oy + 3 gacha.
     Kelajak oylari ko'rinadi, lekin ochilmaydi. */
  const boshOy = [guruhi.created_at.slice(0, 7), birinchiDars?.sana?.slice(0, 7), ...yList.map((y) => y.boshlandi.slice(0, 7))]
    .filter((x): x is string => Boolean(x))
    .sort()[0] ?? joriy
  const oylar: string[] = []
  for (let o = boshOy < oyQosh(joriy, -12) ? oyQosh(joriy, -12) : boshOy; o <= oyQosh(joriy, 3); o = oyQosh(o, 1)) oylar.push(o)

  const bugunDarsKunimi = davr === joriy && kunlar.some((k) => k.sana === bugun && !k.dam)

  /* 0064 — guruh ustozining oylik woblar limiti (ustozning o'ziga va adminga ko'rinadi) */
  const limitUstozi = zamenaBugun ? ustoz!.id : guruhi.teacher_id
  const { data: limitXom } = huquq !== 'yoq' && limitUstozi
    ? await supabase.rpc('ustoz_woblar_limiti', { p_ustoz: limitUstozi, p_davr: joriy })
    : { data: null }
  const limit = limitXom as WoblarLimiti | null
  const guruhLimit = limit?.guruhlar.find((x) => x.group_id === guruh) ?? null

  /* Zamena (0075): guruh ustozi — bugungi va keyingi darslarga, admin — istalgan kunga */
  const admin = adminmi(profil.rol)
  const zamenaQoyadi = admin || guruhUstozi
  const { data: ustozXom } = zamenaQoyadi
    ? await supabase.from('teachers').select('id, ism').eq('holat', 'faol').order('ism')
    : { data: null }
  const barchaUstoz = (ustozXom ?? []) as { id: string; ism: string }[]
  const ustozIsmi = new Map(barchaUstoz.map((u) => [u.id, u.ism]))
  const zamenalar = dList.filter((d) => d.zamena_teacher_id).sort((a, b) => a.sana.localeCompare(b.sana))
  const zamenaKunlari = kunlar.filter((k) => !k.dam && (admin || k.sana >= bugun))
  const qaytish = davr === joriy ? `/crm/davomat/${guruh}` : `/crm/davomat/${guruh}?oy=${davr}`

  /* 0079 — darsni ko'chirish: guruh ustozi (bugun va keyin) yoki admin */
  const kochiradi = admin || guruhUstozi
  const qisqaSana = (x: string) => `${x.slice(8, 10)}.${x.slice(5, 7)}`
  const kochirishlar = new Map<string, { eski: string; yangi: string; sabab: string | null }>()
  for (const d of dList) {
    if (d.kochirildi_ga) kochirishlar.set(d.sana, { eski: d.sana, yangi: d.kochirildi_ga, sabab: d.kochirish_sabab })
    if (d.kochirilgan_dan) kochirishlar.set(d.kochirilgan_dan, { eski: d.kochirilgan_dan, yangi: d.sana, sabab: d.kochirish_sabab })
  }
  const kochirishRoyxati = [...kochirishlar.values()].sort((a, b) => a.eski.localeCompare(b.eski))
  const darsBy = new Map(dList.map((d) => [d.sana, d]))
  const kochiriladiganKunlar = oyKunlari(davr).filter((x) => {
    const d = darsBy.get(x)
    return guruhi.kunlar.includes(haftaKuni(x)) && !d?.otkazildi && !d?.kochirildi_ga && !d?.kochirilgan_dan && (admin || x >= bugun)
  })

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href="/crm/davomat" className="flex items-center gap-2 text-[13px] text-ink-3 transition hover:text-ink">
        <IconArrowLeft size={15} />
        Davomat
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <Sarlavha nom={guruhQisqa(guruhi.nom)} izoh={`${guruhi.teachers?.ism ?? '[ANIQLANMAGAN]'} · ${guruhi.id}`} />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-4">
          <div>
            <dt className="lbl">Yo‘nalish</dt>
            <dd className="font-semibold">{guruhi.subjects?.nom ?? '—'}</dd>
          </div>
          <div>
            <dt className="lbl">Dars vaqti</dt>
            <dd className="font-semibold font-[family-name:var(--font-mono)]">{vaqt(guruhi.boshlanish)}–{vaqt(guruhi.tugash)}</dd>
          </div>
          <div>
            <dt className="lbl">Dars kunlari</dt>
            <dd className="font-semibold">{kunlarNomi(guruhi.kunlar)}</dd>
          </div>
          <div>
            <dt className="lbl">Shu oy darslari</dt>
            <dd className="font-semibold">{kunlar.filter((k) => !k.dam).length}</dd>
          </div>
        </dl>
      </div>

      <Xabar ok={s.ok} xato={s.xato} />

      {zamenaBugun && (
        <Card className="flex flex-wrap items-center gap-2 border-accent px-5 py-3.5 text-[13px]">
          <Badge ton="accent">zamena</Badge>
          Bugun bu darsni {guruhi.teachers?.ism ?? 'guruh ustozi'} o‘rniga siz o‘tasiz — davomat, woblar va maosh sizga yoziladi.
        </Card>
      )}

      <nav aria-label="Oylar" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {oylar.map((o) => {
          const tanlangan = o === davr
          const kelajak = o > joriy
          const yorliq = (
            <>
              {davrQisqa(o)} <span className="text-[10.5px] opacity-70">{o.slice(2, 4)}</span>
            </>
          )
          return kelajak ? (
            <span key={o} className="flex min-h-11 shrink-0 items-center rounded-[9px] border border-line-soft px-3 text-[12.5px] text-ink-4">
              {yorliq}
            </span>
          ) : (
            <Link
              key={o}
              href={o === joriy ? `/crm/davomat/${guruh}` : `/crm/davomat/${guruh}?oy=${o}`}
              aria-current={tanlangan ? 'page' : undefined}
              className={`flex min-h-11 shrink-0 items-center rounded-[9px] border px-3 text-[12.5px] font-semibold transition ${
                tanlangan ? 'border-brand bg-brand text-white' : 'border-line text-ink-2 hover:border-ink-3 hover:text-ink'
              }`}
            >
              {yorliq}
            </Link>
          )
        })}
      </nav>

      {limit && guruhLimit && (
        <WoblarLimitKartasi
          limit={limit}
          guruh={guruhLimit}
          kim={huquq === 'hammasi' ? `${guruhi.teachers?.ism ?? 'Ustoz'} limiti` : 'Sizning woblar limitingiz'}
        />
      )}

      {qatorlar.length === 0 ? (
        <Card className="p-5">
          <Empty>Bu oyda guruhda o‘quvchi yo‘q — davomat qo‘yishga hech kim yo‘q.</Empty>
        </Card>
      ) : kunlar.length === 0 ? (
        <Card className="p-5">
          <Empty>Bu oyda guruhning dars kuni yo‘q.</Empty>
        </Card>
      ) : (
        <Jurnal
          key={davr}
          guruhId={guruh}
          kunlar={kunlar}
          bugun={bugun}
          boshlangich={qatorlar}
          huquq={huquq}
          woblarOchiq={bugunDarsKunimi}
        />
      )}

      {(zamenaQoyadi || zamenalar.length > 0) && (
        <Card className="flex flex-col">
          <CardHeader title="Zamena" meta={`${zamenalar.length} ta dars`} />
          {zamenalar.length > 0 && (
            <ul className="flex flex-col">
              {zamenalar.map((z) => (
                <li key={z.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-3">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13px] font-semibold">
                      {sanaFmt(z.sana)} · {ustozIsmi.get(z.zamena_teacher_id!) ?? z.zamena_teacher_id}
                    </span>
                    {z.zamena_sabab && <span className="text-[11.5px] text-ink-3">{z.zamena_sabab}</span>}
                  </span>
                  {zamenaQoyadi && (admin || z.sana >= bugun) && (
                    <form action={zamenaSaqla}>
                      <input type="hidden" name="group_id" value={guruh} />
                      <input type="hidden" name="sana" value={z.sana} />
                      <input type="hidden" name="qaytish" value={qaytish} />
                      <Yuborish tur="xavfli" kutish="…">
                        Olib tashlash
                      </Yuborish>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {zamenaQoyadi && zamenaKunlari.length > 0 && (
            <form action={zamenaSaqla} className="flex flex-wrap items-end gap-3 border-t border-line-soft px-5 py-4">
              <input type="hidden" name="group_id" value={guruh} />
              <input type="hidden" name="qaytish" value={qaytish} />
              <Maydon nom="Dars kuni">
                <select name="sana" required defaultValue="" className={kirishKlass}>
                  <option value="" disabled>
                    Tanlang…
                  </option>
                  {zamenaKunlari.map((k) => (
                    <option key={k.sana} value={k.sana}>
                      {sanaFmt(k.sana)} · {k.hafta}
                    </option>
                  ))}
                </select>
              </Maydon>
              <Maydon nom="O‘rniga dars o‘tadi">
                <select name="ustoz" required defaultValue="" className={kirishKlass}>
                  <option value="" disabled>
                    Ustozni tanlang…
                  </option>
                  {barchaUstoz
                    .filter((u) => u.id !== guruhi.teacher_id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.ism}
                      </option>
                    ))}
                </select>
              </Maydon>
              <Maydon nom="Sabab">
                <input name="sabab" placeholder="Masalan: kasal" className={kirishKlass} />
              </Maydon>
              <Yuborish kutish="Saqlanmoqda…">Zamena qilish</Yuborish>
            </form>
          )}
          <p className="border-t border-line-soft px-5 py-3 text-[11.5px] text-ink-3">
            Zamena darsining maoshi, davomati, woblari va woblar limiti o‘rinbosar ustozga o‘tadi.
          </p>
        </Card>
      )}

      {(kochiradi || kochirishRoyxati.length > 0) && (
        <Card className="flex flex-col">
          <CardHeader title="Darsni ko‘chirish" meta={`${kochirishRoyxati.length} ta`} />
          {kochirishRoyxati.length > 0 && (
            <ul className="flex flex-col">
              {kochirishRoyxati.map((k) => (
                <li key={k.eski} className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-3">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="tnum text-[13px] font-semibold">
                      {sanaFmt(k.eski)} → {sanaFmt(k.yangi)}
                    </span>
                    {k.sabab && <span className="text-[11.5px] text-ink-3">{k.sabab}</span>}
                  </span>
                  {kochiradi && (admin || k.yangi >= bugun) && !darsBy.get(k.yangi)?.otkazildi && (
                    <form action={darsKochir}>
                      <input type="hidden" name="group_id" value={guruh} />
                      <input type="hidden" name="eski" value={k.eski} />
                      <input type="hidden" name="qaytish" value={qaytish} />
                      <Yuborish tur="xavfli" kutish="…">
                        Bekor qilish
                      </Yuborish>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {kochiradi && kochiriladiganKunlar.length > 0 && (
            <form action={darsKochir} className="flex flex-wrap items-end gap-3 border-t border-line-soft px-5 py-4">
              <input type="hidden" name="group_id" value={guruh} />
              <input type="hidden" name="qaytish" value={qaytish} />
              <Maydon nom="Qaysi dars">
                <select name="eski" required defaultValue="" className={kirishKlass}>
                  <option value="" disabled>
                    Tanlang…
                  </option>
                  {kochiriladiganKunlar.map((x) => (
                    <option key={x} value={x}>
                      {sanaFmt(x)} · {HAFTA_KUNLARI[haftaKuni(x) - 1].qisqa}
                      {dam.get(x) ? ` · ${dam.get(x)}` : ''}
                    </option>
                  ))}
                </select>
              </Maydon>
              <Maydon nom="Qaysi kunga">
                <input type="date" name="yangi" required min={admin ? undefined : bugun} className={kirishKlass} />
              </Maydon>
              <Maydon nom="Sabab">
                <input name="sabab" placeholder="Masalan: bayram kuni" className={kirishKlass} />
              </Maydon>
              <Yuborish kutish="Ko‘chirilmoqda…">Ko‘chirish</Yuborish>
            </form>
          )}
          <p className="border-t border-line-soft px-5 py-3 text-[11.5px] text-ink-3">
            Oyda kamida 12 dars bo‘lishi kerak. Ko‘chirilgan kuni davomat yopiladi, dars yangi kunda o‘tiladi — maosh va woblar o‘sha kunga yoziladi. {qisqaSana(bugun)} dan oldingi kunlarni faqat admin o‘zgartiradi.
          </p>
        </Card>
      )}

      <p className="text-[12.5px] leading-relaxed text-ink-3">
        {huquq === 'bugun'
          ? 'Siz faqat bugungi darsni belgilaysiz. O‘tgan kunni tuzatish kerak bo‘lsa — admin tuzatadi.'
          : huquq === 'hammasi'
            ? 'Admin o‘tgan kunlarni ham tuzata oladi. Kelajak kunlar yopiq.'
            : 'Faqat ko‘rish.'}{' '}
        Woblar faqat dars kuni beriladi; boshqa kuni —{' '}
        <Link href={`/crm/woblr?guruh=${guruh}`} className="text-accent underline underline-offset-2 hover:text-brand">Woblar bo‘limi</Link>.
      </p>
    </div>
  )
}

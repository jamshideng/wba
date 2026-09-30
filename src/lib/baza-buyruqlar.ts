import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { html } from '@/lib/telegram'
import { pul, sana, davrNomi, bugunToshkent, HAFTA_KUNLARI, haftaKuni } from '@/lib/format'
import { kunlikHisobotMatn } from '@/lib/kunlik-hisobot'
import type { Hisobot } from '@/lib/types'

/**
 * "WBA Hisobot" guruhidagi /baza_* buyruqlari — SAYT BAZASIDAN.
 *
 * Sayt to'liq ishga tushguncha haqiqiy ish Sheets'da (Apps Script
 * buyruqlari: /tushum, /hisobot_bugun …). Bular esa bazadan — ikkalasi
 * parallel keladi, adashmaslik uchun har xabar "[BAZA · sayt]" bilan
 * boshlanadi. Buyruq nomlari ham boshqa (baza_ oldi qo'shimchasi), ya'ni
 * Sheets buyruqlari o'zgarmaydi va Apps Script'ga uzatilaveradi.
 *
 * service_role — Telegram so'rovida sessiya yo'q; guruhning o'zi ruxsat
 * (faqat markaz xodimlari), faqat umumiy raqamlar va ismlar chiqadi.
 */

export const BAZA_BUYRUQLAR: [string, string][] = [
  ['baza_bugun', 'Bugungi hisobot (baza)'],
  ['baza_kecha', 'Kechagi hisobot (baza)'],
  ['baza_haftalik', 'Shu hafta hisoboti (baza)'],
  ['baza_oylik', 'Shu oy hisoboti + oy rejasi (baza)'],
  ['baza_tushum', 'Tushum: bugun, kecha, hafta, oy (baza)'],
  ['baza_qarzdorlar', 'Qarzdorlar ro‘yxati (baza)'],
  ['baza_buyruqlar', 'Shu ro‘yxat'],
]

const BELGI = '<b>[BAZA · sayt]</b> — saytdagi baza, Sheets emas'

const USUL_NOMI: Record<string, string> = {
  naqd: 'Naqd',
  karta: 'Karta',
  click: 'Click',
  payme: 'Payme',
  aniqlanmagan: 'Usuli yozilmagan',
}

/** "2026-10-01" + n kun */
function kunQosh(kun: string, n: number): string {
  const d = new Date(`${kun}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function haftaBoshi(kun: string): string {
  return kunQosh(kun, -(haftaKuni(kun) - 1))
}

function kunQisqa(kun: string): string {
  return `${kun.slice(8, 10)}.${kun.slice(5, 7)}`
}

async function hisobot(dan: string, gacha: string): Promise<Hisobot | null> {
  const { data } = await createAdminClient().rpc('tushum_hisobot', { p_dan: dan, p_gacha: gacha })
  return (data as Hisobot | null) ?? null
}

/** Oy rejasi: shu oy hisob-fakturalari (to'lanishi kerak) va shu oy uchun to'langan. */
async function oyRejasi(davr: string) {
  const db = createAdminClient()
  const [{ data: inv }, { data: tol }] = await Promise.all([
    db.from('invoices').select('enrollment_id, summa').eq('davr', davr).neq('holat', 'bekor'),
    db.from('payments').select('enrollment_id, summa').eq('davr', davr).eq('bekor', false),
  ])
  const kerakMap = new Map<string, number>()
  for (const i of inv ?? []) kerakMap.set(i.enrollment_id, (kerakMap.get(i.enrollment_id) ?? 0) + Number(i.summa))
  const tushdiMap = new Map<string, number>()
  for (const p of tol ?? []) {
    if (!p.enrollment_id) continue
    tushdiMap.set(p.enrollment_id, (tushdiMap.get(p.enrollment_id) ?? 0) + Number(p.summa))
  }
  const kerak = [...kerakMap.values()].reduce((a, x) => a + x, 0)
  const tushdi = (tol ?? []).reduce((a, p) => a + Number(p.summa), 0)
  const royxat = [...kerakMap].filter(([, k]) => k > 0)
  const toliq = royxat.filter(([e, k]) => (tushdiMap.get(e) ?? 0) >= k).length
  return { kerak, tushdi, toliq, soni: royxat.length }
}

async function oquvchiSoni() {
  const db = createAdminClient()
  const { data } = await db
    .from('enrollments')
    .select('student_id, students!inner(holat)')
    .eq('holat', 'faol')
    .eq('students.holat', 'faol')
  const r = (data ?? []) as { student_id: string }[]
  return { fan: r.length, bola: new Set(r.map((x) => x.student_id)).size }
}

async function yangiQoshilgan(dan: string, gacha: string) {
  const { count } = await createAdminClient()
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .gte('boshlandi', dan)
    .lte('boshlandi', gacha)
  return count ?? 0
}

/** Haftalik / oylik hisobot */
async function oraliqMatn(dan: string, gacha: string, nom: 'HAFTALIK' | 'OYLIK'): Promise<string> {
  const [h, oq, yangi] = await Promise.all([hisobot(dan, gacha), oquvchiSoni(), yangiQoshilgan(dan, gacha)])
  const t: string[] = [BELGI, '', `<b>${nom} HISOBOT</b>`, `${sana(dan)} — ${sana(gacha)}`, '']

  t.push('<b>TUSHUM</b>')
  for (const u of h?.usul ?? []) t.push(`${USUL_NOMI[u.nom] ?? html(u.nom)} — <b>${pul(u.summa)}</b> so‘m`)
  t.push(`<b>JAMI — ${pul(h?.tushum ?? 0)} so‘m</b> (${h?.soni ?? 0} ta to‘lov)`)
  if (h?.tasdiqlanmagan) t.push(`Direktor tasdiqlamagan — ${pul(h.tasdiqlanmagan)} so‘m`)
  t.push('')

  if (nom === 'HAFTALIK') {
    const kunlar = new Map((h?.kunlar ?? []).map((k) => [k.sana, Number(k.summa)]))
    t.push('<b>KUNLAR BO‘YICHA</b>')
    for (let k = dan; k <= gacha; k = kunQosh(k, 1)) {
      t.push(`${kunQisqa(k)} ${HAFTA_KUNLARI[haftaKuni(k) - 1].qisqa} — ${pul(kunlar.get(k) ?? 0)}`)
    }
    t.push('')
  }

  if (nom === 'OYLIK') {
    const rj = await oyRejasi(gacha.slice(0, 7))
    const foiz = rj.kerak ? Math.round((rj.tushdi * 100) / rj.kerak) : 0
    t.push('<b>OY REJASI</b>')
    t.push(`To‘lanishi kerak — <b>${pul(rj.kerak)}</b> so‘m (${rj.soni} ta)`)
    t.push(`Tushdi — <b>${pul(rj.tushdi)}</b> so‘m (${foiz}%)`)
    t.push(`Qoldi — <b>${pul(Math.max(0, rj.kerak - rj.tushdi))}</b> so‘m`)
    t.push(`To‘liq to‘laganlar — <b>${rj.toliq}</b> / ${rj.soni}`)
    t.push('')
  }

  t.push('<b>DAVOMAT</b>')
  const d = h?.davomat
  t.push(`Keldi: <b>${d?.kelgan ?? 0}</b> · kelmadi: <b>${(d?.kelmadi ?? 0) + (d?.sababli ?? 0)}</b> · belgilanmagan dars: <b>${h?.darslar.qilinmagan ?? 0}</b>`)
  t.push('')
  t.push('<b>O‘QUVCHILAR</b>')
  t.push(`Probniyga yozilgan — <b>${h?.probniy.jami ?? 0}</b> ta · doimiyga o‘tgan — <b>${h?.probniy.yozildi ?? 0}</b> ta`)
  t.push(`Yangi qo‘shilgan (fan bo‘yicha) — <b>${yangi}</b> ta`)
  t.push(`Hozir faol — <b>${oq.fan}</b> ta (fan) · <b>${oq.bola}</b> ta bola`)
  return t.join('\n')
}

async function tushumMatn(bugun: string): Promise<string> {
  const oyBosh = `${bugun.slice(0, 7)}-01`
  const hafta = haftaBoshi(bugun)
  const kecha = kunQosh(bugun, -1)
  const bosh = [oyBosh, hafta, kecha].sort()[0]
  const [h, rj] = await Promise.all([hisobot(bosh, bugun), oyRejasi(bugun.slice(0, 7))])
  const kunlar = h?.kunlar ?? []
  const yig = (a: string, b: string) => kunlar.filter((k) => k.sana >= a && k.sana <= b).reduce((s, k) => s + Number(k.summa), 0)
  const foiz = rj.kerak ? Math.round((rj.tushdi * 100) / rj.kerak) : 0
  const oy = davrNomi(bugun.slice(0, 7))
  return [
    BELGI,
    '',
    `<b>TUSHUM</b> — ${sana(bugun)}`,
    '',
    `Bugun — <b>${pul(yig(bugun, bugun))}</b> so‘m`,
    `Kecha — <b>${pul(yig(kecha, kecha))}</b> so‘m`,
    `Shu hafta — <b>${pul(yig(hafta, bugun))}</b> so‘m`,
    `Shu oy (${oy}) — <b>${pul(yig(oyBosh, bugun))}</b> so‘m`,
    '',
    `<b>${oy.toUpperCase()} REJASI</b>: ${pul(rj.tushdi)} / ${pul(rj.kerak)} so‘m (${foiz}%)`,
    `Qoldi — <b>${pul(Math.max(0, rj.kerak - rj.tushdi))}</b> so‘m · to‘liq to‘lagan ${rj.toliq} / ${rj.soni}`,
  ].join('\n')
}

async function qarzdorlarMatn(bugun: string): Promise<string> {
  const { data } = await createAdminClient().from('v_qarzdorlar').select('fish, qarz, guruhlar')
  const gur = new Map<string, { ism: string; q: number }[]>()
  let jami = 0
  for (const r of (data ?? []) as { fish: string; qarz: number; guruhlar: string | null }[]) {
    const q = Number(r.qarz)
    if (q <= 0) continue
    const g = r.guruhlar || 'Guruhsiz'
    gur.set(g, [...(gur.get(g) ?? []), { ism: r.fish, q }])
    jami += q
  }
  const soni = [...gur.values()].reduce((a, x) => a + x.length, 0)
  const t = [BELGI, '', `<b>QARZDORLAR</b> — ${sana(bugun)}`, '']
  const tartib = [...gur].sort((a, b) => b[1].reduce((s, o) => s + o.q, 0) - a[1].reduce((s, o) => s + o.q, 0))
  if (!tartib.length) t.push('— faol qarzdor yo‘q')
  for (const [g, r] of tartib) {
    t.push(`<b>${html(g)}</b> — ${pul(r.reduce((s, o) => s + o.q, 0))}`)
    t.push(`     ${r.sort((a, b) => b.q - a.q).map((o) => `${html(o.ism)} ${pul(o.q)}`).join(' · ')}`)
  }
  t.push('')
  t.push(`Jami faol qarz — <b>${pul(jami)}</b> so‘m (${soni} ta)`)
  return t.join('\n')
}

function yordam(): string {
  return [
    BELGI,
    '',
    '<b>BAZA BUYRUQLARI</b> (sayt bazasidan)',
    ...BAZA_BUYRUQLAR.map(([b, n]) => `/${b} — ${n}`),
    '',
    'Sheets buyruqlari (/tushum, /hisobot_bugun …) avvalgidek ishlaydi — /buyruqlar',
  ].join('\n')
}

/** Buyruq bazaga tegishlimi (aks holda Apps Script'ga uzatiladi) */
export function bazaBuyrugimi(matn: string): boolean {
  return /^\/baza_[a-z_]+/i.test(matn.trim())
}

/** /baza_* buyrug'iga javob matni. Noma'lum buyruq — ro'yxat. */
export async function bazaBuyrugiMatn(matn: string): Promise<string> {
  const cmd = matn.trim().split(/[\s@]+/)[0].toLowerCase().slice(1)
  const bugun = bugunToshkent()
  switch (cmd) {
    case 'baza_bugun':
      return `${BELGI}\n\n${await kunlikHisobotMatn(bugun)}`
    case 'baza_kecha':
      return `${BELGI}\n\n${await kunlikHisobotMatn(kunQosh(bugun, -1))}`
    case 'baza_haftalik':
      return oraliqMatn(haftaBoshi(bugun), bugun, 'HAFTALIK')
    case 'baza_oylik':
      return oraliqMatn(`${bugun.slice(0, 7)}-01`, bugun, 'OYLIK')
    case 'baza_tushum':
      return tushumMatn(bugun)
    case 'baza_qarzdorlar':
      return qarzdorlarMatn(bugun)
    default:
      return yordam()
  }
}

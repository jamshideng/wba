/**
 * Sheets ↔ sayt IKKI TOMONLAMA sinxron (14.10, Jamshid qarori).
 *
 *   npx tsx scripts/sinxron.ts            reja: nima, qayerga yozilishini ko'rsatadi, yozmaydi
 *   npx tsx scripts/sinxron.ts --tasdiq   yozadi va holatni saqlaydi
 *
 * Eski ko'chirish (migrate-from-sheets.ts) saytni Sheets'ga TENGLASHTIRARDI —
 * saytda qo'shilgan narsa o'chib ketardi. Endi har yozuv uch ko'rinishda
 * solishtiriladi (lib/sinxron.ts): oxirgi kelishilgan holat, Sheets, sayt.
 * Kim o'zgartirgan bo'lsa — o'sha tomonniki boshqasiga yoziladi; ikkalasi
 * turlicha o'zgartirsa — hech qayerga yozilmaydi, Jamshidga xabar.
 *
 * Hech narsa O'CHIRILMAYDI: bir tomonda yo'qolgan yozuv faqat xabar bo'ladi.
 *
 * Sheets'ga avtomatik yoziladi: yangi o'quvchi/yozilish qatori, yangi to'lov,
 * o'quvchining shaxsiy ma'lumoti, chegirma, to'lov tasdig'i, ustoz telefoni/Telegram ID.
 * Qolgani (guruhni almashtirish, fandan chiqish, arxiv, guruh/narx/probniy
 * o'zgarishi) — Sheets'da bot va formulalar bilan bog'liq, shuning uchun
 * "qo'lda" ro'yxatiga tushadi: nima qilish kerakligi aytiladi.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { kitobniOqi, varaq, varaqBormi, matn, qiymat, type Varaq } from './lib/sheets'
import {
  malumotniQur, solishtir, ogohlantirishlar, toxtatuvchilar, ismKalit,
  type Tayyor,
} from './migrate-from-sheets'
import {
  uchTomon, juftla, toplamdan, toplamga, teng,
  type Toplam, type Yozuv, type Amal, type Sozlama, type Reja,
} from './lib/sinxron'
import {
  yozuvchi, ustun, kataklarniYoz, bosh, sanaSeriya, vaqtSeriya, telefonSheets, usulSheets,
  type Katak,
} from './lib/sheets-yoz'

const TASDIQ = process.argv.includes('--tasdiq')
/** Ko'p yangi yozuv bo'lsa ham yozishga ruxsat (birinchi yurish uchun) */
const KOP = process.argv.includes('--kop')
const HOLAT_FAYL = process.env.SINXRON_HOLAT ?? 'holat/sinxron.json'
const SHEETS_ID = process.env.SHEETS_ID
const CHEGARA = 40
/** Formulalar shu qatorgacha oldindan qo'yilgan (B_Yangi.js QATOR_SONI, Tolovlar 1500) */
const OQ_OXIRGI = 300
const TL_OXIRGI = 1497

type Holat = { versiya: 1; vaqt: string; toplamlar: Record<string, Record<string, Yozuv>> }

/* ------------------------------------------------------------------ */
/*  Sozlamalar — har bir ma'lumot turi                                  */
/* ------------------------------------------------------------------ */

const HAMMASI = (m: readonly string[]) => m
const OQ_M = ['fish', 'tugilgan_sana', 'ota_tel', 'ona_tel', 'shaxsiy_tel', 'holat', 'izoh'] as const
const YOZ_M = ['student_id', 'group_id', 'boshlandi', 'tugadi', 'chegirma_summa', 'chegirma_oy', 'chegirma2_summa', 'chegirma2_oy', 'vip'] as const
const TOL_M = ['student_id', 'yozilish', 'sana', 'davr', 'summa', 'usul', 'izoh', 'tasdiqlangan', 'bekor'] as const
const UST_M = ['ism', 'telefon', 'telegram_id', 'holat'] as const
const GUR_M = ['nom', 'teacher_id', 'boshlanish', 'tugash', 'kun_turi', 'oylik_narx', 'holat'] as const
const PROB_M = ['ism', 'telefon', 'tugilgan_sana', 'group_id', 'holat', 'student_id', 'izoh'] as const
const TUZ_M = ['summa'] as const

const SOZ: Record<string, Sozlama> = {
  ustoz: { maydonlar: UST_M, sheetsgaYozilmaydi: ['ism', 'holat'], sheetsgaQoshiladi: false },
  guruh: { maydonlar: GUR_M, sheetsgaYozilmaydi: HAMMASI(GUR_M), sheetsgaQoshiladi: false },
  oquvchi: { maydonlar: OQ_M, sheetsgaYozilmaydi: ['holat'] },
  yozilish: {
    maydonlar: YOZ_M,
    sheetsgaYozilmaydi: ['student_id', 'group_id', 'boshlandi', 'tugadi', 'vip'],
    faqatSheetsdan: (k) => k.includes('~'),          // guruh tarixi bo'yicha bo'lingan eski davr
  },
  tuzatish: { maydonlar: TUZ_M, sheetsgaYozilmaydi: HAMMASI(TUZ_M), sheetsgaQoshiladi: false },
  tolov: {
    maydonlar: TOL_M,
    // Tasdiq ustuni Sheets'da himoyalangan — faqat direktor belgilaydi
    sheetsgaYozilmaydi: ['student_id', 'yozilish', 'bekor', 'tasdiqlangan'],
    faqatSheetsdan: (k) => k.startsWith('AT'),        // _Arxiv_tolovlar
  },
  probniy: { maydonlar: PROB_M, sheetsgaYozilmaydi: HAMMASI(PROB_M), sheetsgaQoshiladi: false },
}
const TARTIB = ['ustoz', 'guruh', 'oquvchi', 'yozilish', 'tuzatish', 'tolov', 'probniy'] as const
type Tur = (typeof TARTIB)[number]

const NOMI: Record<Tur, string> = {
  ustoz: 'Ustoz', guruh: 'Guruh', oquvchi: 'O‘quvchi', yozilish: 'Yozilish (fan)',
  tuzatish: 'Tuzatish', tolov: 'To‘lov', probniy: 'Probniy',
}

/* ------------------------------------------------------------------ */
/*  Yordamchilar                                                       */
/* ------------------------------------------------------------------ */

const pul = (n: number) => n.toLocaleString('uz-UZ')
const vaqt5 = (v: unknown) => (v ? String(v).slice(0, 5) : null)
/** Chegirma yo'q bo'lsa "necha oy" ahamiyatsiz — bo'sh va 0 bir xil */
const chegOy = (summa: unknown, oy: number | null) => (Number(summa) > 0 ? oy : 0)
const tel = (o: Yozuv) => new Set([o.ota_tel, o.ona_tel, o.shaxsiy_tel].filter(Boolean).map(String))
/** Saytda birlashtirilgan o'quvchi: arxiv_sabab "Birlashtirildi → S014" */
const birlashganga = (sabab: string | null) => sabab?.match(/^Birlashtirildi\D*(S\d+)/)?.[1] ?? null

function holatniOqi(): Holat | null {
  if (!existsSync(HOLAT_FAYL)) return null
  return JSON.parse(readFileSync(HOLAT_FAYL, 'utf8')) as Holat
}

function holatniSaqla(h: Holat) {
  mkdirSync(dirname(HOLAT_FAYL) || '.', { recursive: true })
  if (existsSync(HOLAT_FAYL)) {
    const zaxira = join(dirname(HOLAT_FAYL), `sinxron-${h.vaqt.replace(/[: ]/g, '-')}.json`)
    writeFileSync(zaxira, readFileSync(HOLAT_FAYL))
    // oxirgi 30 ta zaxira qoladi
    const eski = readdirSync(dirname(HOLAT_FAYL)).filter((f) => /^sinxron-.+\.json$/.test(f)).sort()
    for (const f of eski.slice(0, Math.max(0, eski.length - 30))) unlinkSync(join(dirname(HOLAT_FAYL), f))
  }
  writeFileSync(HOLAT_FAYL, JSON.stringify(h, null, 1))
}

/** Toplamdagi kalitni almashtiradi (juftlashda) */
function kalitAlmashtir(t: Toplam | null, eski: string, yangi: string) {
  if (!t || !t.has(eski)) return
  t.set(yangi, t.get(eski)!)
  t.delete(eski)
}

/* ------------------------------------------------------------------ */
/*  1. Sheets ko'rinishi (sayt sxemasida)                               */
/* ------------------------------------------------------------------ */

function sheetsKorinishi(d: Tayyor) {
  const yozSid = new Map(d.yozilishlar.map((y) => [y.kalit, y.sheets_id ?? y.kalit]))
  const t: Record<Tur, Toplam> = {
    ustoz: new Map(d.ustozlar.map((u) => [u.id, { ism: u.ism, telefon: u.telefon, telegram_id: u.telegram_id, holat: u.holat }])),
    guruh: new Map(d.guruhlar.map((g) => [g.id, {
      nom: g.nom, teacher_id: g.teacher_id, boshlanish: g.boshlanish, tugash: g.tugash,
      kun_turi: g.kun_turi, oylik_narx: g.oylik_narx, holat: g.holat,
    }])),
    oquvchi: new Map(d.oquvchilar.map((o) => [o.id, {
      fish: o.fish, tugilgan_sana: o.tugilgan_sana, ota_tel: o.ota_tel, ona_tel: o.ona_tel,
      shaxsiy_tel: o.shaxsiy_tel, holat: o.holat, izoh: o.izoh,
    }])),
    yozilish: new Map(d.yozilishlar.filter((y) => y.sheets_id).map((y) => [y.sheets_id!, {
      student_id: y.student_id, group_id: y.group_id, boshlandi: y.boshlandi, tugadi: y.tugadi,
      chegirma_summa: y.chegirma_summa, chegirma_oy: chegOy(y.chegirma_summa, y.chegirma_oy),
      chegirma2_summa: y.chegirma2_summa, chegirma2_oy: chegOy(y.chegirma2_summa, y.chegirma2_oy), vip: y.vip,
    }])),
    tuzatish: new Map(),
    tolov: new Map(d.tolovlar.filter((p) => p.sheets_id).map((p) => [p.sheets_id!, {
      student_id: p.student_id, yozilish: p.kalit ? (yozSid.get(p.kalit) ?? null) : null,
      sana: p.sana, davr: p.davr, summa: p.summa, usul: p.usul, izoh: p.izoh,
      tasdiqlangan: p.tasdiqlangan, bekor: false,
    }])),
    probniy: new Map(d.probniylar.map((p) => [p.sheets_id, {
      ism: p.ism, telefon: p.telefon, tugilgan_sana: p.tugilgan_sana, group_id: p.group_id,
      holat: p.holat, student_id: p.student_id, izoh: p.izoh,
    }])),
  }
  for (const x of d.tuzatishRoyxat) {
    const sid = x.kalit ? yozSid.get(x.kalit) : null
    if (!sid) continue
    const k = `${sid}|${davrdanOy(x.oy)}`
    const eski = t.tuzatish.get(k)
    t.tuzatish.set(k, { summa: Number(eski?.summa ?? 0) + x.summa })
  }
  return t
}

/** parse.ts dagi oy raqami (yil*12+oy) → "YYYY-MM" */
function davrdanOy(oy: number): string {
  const y = Math.floor((oy - 1) / 12), m = oy - y * 12
  return `${y}-${String(m).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/*  2. Sayt ko'rinishi                                                  */
/* ------------------------------------------------------------------ */

const dbOch = (url: string, key: string) =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
type Db = ReturnType<typeof dbOch>
type SaytXom = Awaited<ReturnType<typeof saytniOqi>>

async function saytniOqi(db: Db) {
  async function hammasi<T>(jadval: string, ustunlar: string): Promise<T[]> {
    const natija: T[] = []
    for (let dan = 0; ; dan += 1000) {
      const { data, error } = await db.from(jadval).select(ustunlar).range(dan, dan + 999)
      if (error) throw new Error(`${jadval}: ${error.message}`)
      natija.push(...((data ?? []) as T[]))
      if (!data || data.length < 1000) return natija
    }
  }
  type St = { id: string; fish: string; tugilgan_sana: string | null; ota_tel: string | null; ona_tel: string | null; shaxsiy_tel: string | null; holat: string; izoh: string | null; arxiv_sabab: string | null; profile_id: string | null }
  type En = { id: string; sheets_id: string | null; student_id: string; group_id: string; boshlandi: string; tugadi: string | null; chegirma_summa: number; chegirma_oy: number | null; chegirma2_summa: number; chegirma2_oy: number | null; holat: string; vip: boolean }
  type Pa = { id: number; sheets_id: string | null; student_id: string; enrollment_id: string | null; sana: string; davr: string; summa: number; usul: string | null; izoh: string | null; tasdiqlangan: boolean; tasdiqlangan_vaqt: string | null; bekor: boolean; manba: string }
  type Te = { id: string; ism: string; telefon: string | null; telegram_id: number | null; holat: string; profile_id: string | null }
  type Gr = { id: string; nom: string; teacher_id: string | null; boshlanish: string; tugash: string; kun_turi: string; oylik_narx: number; holat: string }
  type Le = { id: string; sheets_id: string | null; ism: string; telefon: string; tugilgan_sana: string | null; group_id: string | null; holat: string; student_id: string | null; izoh: string | null }
  type Tz = { id: number; enrollment_id: string; davr: string; summa: number; bekor: boolean }
  const [students, enrollments, payments, teachers, groups, leads, tuzatishlar] = await Promise.all([
    hammasi<St>('students', 'id, fish, tugilgan_sana, ota_tel, ona_tel, shaxsiy_tel, holat, izoh, arxiv_sabab, profile_id'),
    hammasi<En>('enrollments', 'id, sheets_id, student_id, group_id, boshlandi, tugadi, chegirma_summa, chegirma_oy, chegirma2_summa, chegirma2_oy, holat, vip'),
    hammasi<Pa>('payments', 'id, sheets_id, student_id, enrollment_id, sana, davr, summa, usul, izoh, tasdiqlangan, tasdiqlangan_vaqt, bekor, manba'),
    hammasi<Te>('teachers', 'id, ism, telefon, telegram_id, holat, profile_id'),
    hammasi<Gr>('groups', 'id, nom, teacher_id, boshlanish, tugash, kun_turi, oylik_narx, holat'),
    hammasi<Le>('leads', 'id, sheets_id, ism, telefon, tugilgan_sana, group_id, holat, student_id, izoh'),
    hammasi<Tz>('tuzatishlar', 'id, enrollment_id, davr, summa, bekor'),
  ])
  return { students, enrollments, payments, teachers, groups, leads, tuzatishlar }
}

/** Sayt kaliti: Sheets ID bo'lsa — o'sha, bo'lmasa "sayt:<id>" */
const sk = (sheetsId: string | null, id: string | number) => sheetsId ?? `sayt:${id}`

function saytKorinishi(x: SaytXom, alias: Map<string, string>) {
  const a = (id: string) => alias.get(id) ?? id
  const enKalit = new Map(x.enrollments.map((e) => [e.id, sk(e.sheets_id, e.id)]))
  const t: Record<Tur, Toplam> = {
    ustoz: new Map(x.teachers.map((u) => [u.id, { ism: u.ism, telefon: u.telefon, telegram_id: u.telegram_id === null ? null : Number(u.telegram_id), holat: u.holat }])),
    guruh: new Map(x.groups.map((g) => [g.id, {
      nom: g.nom, teacher_id: g.teacher_id, boshlanish: vaqt5(g.boshlanish), tugash: vaqt5(g.tugash),
      kun_turi: g.kun_turi, oylik_narx: Number(g.oylik_narx), holat: g.holat,
    }])),
    oquvchi: new Map(x.students
      // saytda birlashtirilgan (ikkinchi) yozuv — asosiysi bilan bitta bola
      .filter((s) => !birlashganga(s.arxiv_sabab) && !alias.has(s.id))
      .map((s) => [s.id, {
        fish: s.fish, tugilgan_sana: s.tugilgan_sana, ota_tel: s.ota_tel, ona_tel: s.ona_tel,
        shaxsiy_tel: s.shaxsiy_tel, holat: s.holat, izoh: s.izoh,
      }])),
    yozilish: new Map(x.enrollments.map((e) => [sk(e.sheets_id, e.id), {
      student_id: a(e.student_id), group_id: e.group_id, boshlandi: e.boshlandi, tugadi: e.tugadi,
      chegirma_summa: Number(e.chegirma_summa), chegirma_oy: chegOy(e.chegirma_summa, e.chegirma_oy),
      chegirma2_summa: Number(e.chegirma2_summa), chegirma2_oy: chegOy(e.chegirma2_summa, e.chegirma2_oy), vip: e.vip,
    }])),
    tuzatish: new Map(),
    tolov: new Map(x.payments.map((p) => [sk(p.sheets_id, p.id), {
      student_id: a(p.student_id), yozilish: p.enrollment_id ? (enKalit.get(p.enrollment_id) ?? null) : null,
      sana: p.sana, davr: p.davr, summa: Number(p.summa), usul: p.usul, izoh: p.izoh,
      tasdiqlangan: p.tasdiqlangan, bekor: p.bekor,
    }])),
    probniy: new Map(x.leads.filter((l) => l.sheets_id).map((l) => [l.sheets_id!, {
      ism: l.ism, telefon: l.telefon, tugilgan_sana: l.tugilgan_sana, group_id: l.group_id,
      holat: l.holat, student_id: l.student_id ? a(l.student_id) : null, izoh: l.izoh,
    }])),
  }
  for (const z of x.tuzatishlar) {
    if (z.bekor) continue
    const ek = enKalit.get(z.enrollment_id)
    if (!ek || ek.startsWith('sayt:')) continue
    const k = `${ek}|${z.davr}`
    t.tuzatish.set(k, { summa: Number(t.tuzatish.get(k)?.summa ?? 0) + Number(z.summa) })
  }
  return t
}

/* ------------------------------------------------------------------ */
/*  3. Reja                                                             */
/* ------------------------------------------------------------------ */

type Juftlik = { tur: Tur; saytKalit: string; sheetsKalit: string }

function rejaTuz(S: Record<Tur, Toplam>, x: SaytXom, baza: Holat | null) {
  const B = Object.fromEntries(TARTIB.map((t) => [t, toplamga(baza?.toplamlar[t])])) as Record<Tur, Toplam | null>
  const yangi = (t: Tur, k: string) => !B[t]?.has(k)

  /* 3a. Bir bola ikki tomonda ikki xil ID bilan kiritilgan: ism bir xil va
     telefon yoki tug'ilgan sana mos — saytdagisi Sheets'dagisiga birlashtiriladi. */
  const alias = new Map<string, string>()
  const D0 = saytKorinishi(x, alias)
  const oqS = [...S.oquvchi].filter(([k]) => !D0.oquvchi.has(k) && yangi('oquvchi', k))
  const oqD = [...D0.oquvchi].filter(([k]) => !S.oquvchi.has(k) && yangi('oquvchi', k))
  const oqJuft = juftla(oqS, oqD, (s, d) =>
    ismKalit(String(s.fish)) === ismKalit(String(d.fish)) &&
    ([...tel(s)].some((t) => tel(d).has(t)) || (!!s.tugilgan_sana && s.tugilgan_sana === d.tugilgan_sana)))
  for (const [dk, skl] of oqJuft) alias.set(dk, skl)

  const D = saytKorinishi(x, alias)
  const juftliklar: Juftlik[] = [...oqJuft].map(([d, s]) => ({ tur: 'oquvchi' as Tur, saytKalit: d, sheetsKalit: s }))

  /* 3b. Yozilish: Sheets'da yangi qator, saytda shu bola+guruh bilan
     ID'siz (yoki eski ID'li) yozilish — bitta yozilish. */
  const yozS = [...S.yozilish].filter(([k]) => !D.yozilish.has(k))
  const yozD = [...D.yozilish].filter(([k]) => !S.yozilish.has(k))
  for (const [dk, skl] of juftla(yozS, yozD, (s, d) => s.student_id === d.student_id && s.group_id === d.group_id)) {
    juftliklar.push({ tur: 'yozilish', saytKalit: dk, sheetsKalit: skl })
    kalitAlmashtir(D.yozilish, dk, skl)
    kalitAlmashtir(B.yozilish, dk, skl)
    for (const p of D.tolov.values()) if (p.yozilish === dk) p.yozilish = skl
  }

  /* 3c. To'lov ikkala tomonda kiritilgan: bola, oy va summa bir xil */
  const tolS = [...S.tolov].filter(([k]) => !D.tolov.has(k) && yangi('tolov', k))
  const tolD = [...D.tolov].filter(([k, v]) => k.startsWith('sayt:') && !v.bekor && yangi('tolov', k))
  for (const [dk, skl] of juftla(tolS, tolD, (s, d) => s.student_id === d.student_id && s.davr === d.davr && teng(s.summa, d.summa))) {
    juftliklar.push({ tur: 'tolov', saytKalit: dk, sheetsKalit: skl })
    kalitAlmashtir(D.tolov, dk, skl)
  }

  /* Eski axlat: bazada ham, Sheets'da ham yo'q bekor to'lov; Sheets ID'siz yopiq
     yozilish (0029 himoyasi) — sinxronga kirmaydi. Saytda arxivlangan
     "Sheets'da yo'q" o'quvchi ham (eski tenglashtirish izi). */
  for (const [k, v] of [...D.tolov]) if (v.bekor && !S.tolov.has(k) && yangi('tolov', k)) D.tolov.delete(k)
  for (const [k, v] of [...D.yozilish]) if (k.startsWith('sayt:') && v.tugadi && yangi('yozilish', k)) D.yozilish.delete(k)
  const eskiArxiv = new Set(x.students.filter((s) => /^Sheets.{1,3}da yo/.test(s.arxiv_sabab ?? '')).map((s) => s.id))
  for (const k of [...D.oquvchi.keys()]) if (eskiArxiv.has(k) && !S.oquvchi.has(k) && yangi('oquvchi', k)) D.oquvchi.delete(k)

  const rejalar = Object.fromEntries(TARTIB.map((t) => [t, uchTomon(B[t], S[t], D[t], SOZ[t])])) as Record<Tur, Reja>
  return { rejalar, juftliklar, alias, D }
}

/** "Qo'lda" bo'lganda nima qilish kerak — aniq ko'rsatma */
const QOLDA: Record<string, string> = {
  'tolov.tasdiqlangan': "saytda tasdiqlangan — direktor Sheets'da ham Tasdiq belgilasin",
  'tolov.bekor': "saytda bekor qilingan — Sheets'dagi qatorni bot orqali o'chiring",
  'yozilish.tugadi': "saytda fandan chiqarilgan — Sheets'da \"Tugadi\" sanasini qo'ying",
  'yozilish.group_id': "saytda guruhi almashgan — Sheets'da ham guruhni almashtiring",
  'oquvchi.holat': "saytda holati o'zgargan (arxiv/tanaffus) — Sheets'da ham o'zgartiring",
}

/* ------------------------------------------------------------------ */
/*  4. Hisobot                                                          */
/* ------------------------------------------------------------------ */

function amalMatni(t: Tur, a: Amal): string {
  const q = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
  switch (a.tur) {
    case 'saytga-yangi': return `+ saytga: ${NOMI[t]} ${a.kalit} ${q(a.yozuv.fish ?? a.yozuv.ism ?? a.yozuv.nom ?? (a.yozuv.summa !== undefined ? pul(Number(a.yozuv.summa)) : ''))}`
    case 'sheetsga-yangi': return `+ Sheets'ga: ${NOMI[t]} ${a.kalit} ${q(a.yozuv.fish ?? a.yozuv.ism ?? (a.yozuv.summa !== undefined ? `${a.yozuv.student_id} ${pul(Number(a.yozuv.summa))} ${a.yozuv.davr}` : `${a.yozuv.student_id} ${a.yozuv.group_id}`))}`
    case 'saytga': return `→ saytga: ${NOMI[t]} ${a.kalit}: ${Object.keys(a.ozgarish).map((m) => `${m} ${q(a.eski[m])} → ${q(a.ozgarish[m])}`).join('; ')}`
    case 'sheetsga': return `← Sheets'ga: ${NOMI[t]} ${a.kalit}: ${Object.keys(a.ozgarish).map((m) => `${m} ${q(a.eski[m])} → ${q(a.ozgarish[m])}`).join('; ')}`
    case 'ziddiyat': return `✗ ZIDDIYAT ${NOMI[t]} ${a.kalit}.${a.maydon}: Sheets "${q(a.sheets)}" · sayt "${q(a.sayt)}"${a.baza === undefined ? ' (oldingi holat noma’lum)' : ` · oldin "${q(a.baza)}"`}`
    case 'qolda': return `✋ QO‘LDA ${NOMI[t]} ${a.kalit}${a.maydon ? `.${a.maydon}: Sheets "${q(a.sheets)}" · sayt "${q(a.sayt)}"` : ''} — ${QOLDA[`${t}.${a.maydon}`] ?? a.sabab}`
    case 'yoqoldi': return `? ${NOMI[t]} ${a.kalit} ${a.qayerda === 'sheets' ? "Sheets'dan" : 'saytdan'} yo‘qolgan — o‘chirilmadi`
  }
}

/* ------------------------------------------------------------------ */
/*  5. Saytga yozish                                                    */
/* ------------------------------------------------------------------ */

async function saytgaYoz(
  db: Db, d: Tayyor, x: SaytXom,
  rejalar: Record<Tur, Reja>, juftliklar: Juftlik[], alias: Map<string, string>,
  bloklangan: Set<string>,
) {
  const xato = (nom: string, e: { message: string } | null) => { if (e) throw new Error(`${nom}: ${e.message}`) }
  const hisob: string[] = []
  const amallar = (t: Tur) => rejalar[t].amallar

  /* Ustozlar */
  for (const a of amallar('ustoz')) {
    if (a.tur === 'saytga-yangi') {
      const u = d.ustozlar.find((z) => z.id === a.kalit)!
      xato('teachers', (await db.from('teachers').insert(u)).error)
    } else if (a.tur === 'saytga') {
      xato('teachers', (await db.from('teachers').update(a.ozgarish).eq('id', a.kalit)).error)
      const p = x.teachers.find((u) => u.id === a.kalit)?.profile_id
      if (p && ('ism' in a.ozgarish || 'holat' in a.ozgarish)) {
        const o: Record<string, unknown> = {}
        if ('ism' in a.ozgarish) o.ism = a.ozgarish.ism
        if (a.ozgarish.holat === 'bloklangan') o.holat = 'bloklangan'
        if (Object.keys(o).length) xato('profiles (ustoz)', (await db.from('profiles').update(o).eq('id', p).eq('rol', 'ustoz')).error)
      }
    }
  }

  /* Guruhlar */
  const { data: bosqichlar } = await db.from('levels').select('id, subject_id, nom')
  const bosqichId = new Map((bosqichlar ?? []).map((b) => [`${b.subject_id}|${String(b.nom).toLowerCase()}`, b.id as number]))
  for (const a of amallar('guruh')) {
    if (a.tur === 'saytga-yangi') {
      const { bosqich, ...g } = d.guruhlar.find((z) => z.id === a.kalit)!
      xato('groups', (await db.from('groups').insert({
        ...g, level_id: bosqich && g.subject_id ? (bosqichId.get(`${g.subject_id}|${bosqich.toLowerCase()}`) ?? null) : null,
      })).error)
    } else if (a.tur === 'saytga') {
      xato('groups', (await db.from('groups').update(a.ozgarish).eq('id', a.kalit)).error)
    }
  }

  /* O'quvchilar: yangisi, keyin ikki tomonda kiritilgan bolani birlashtirish */
  for (const a of amallar('oquvchi')) {
    if (a.tur === 'saytga-yangi') {
      const { vip: _v, ...o } = d.oquvchilar.find((z) => z.id === a.kalit)!
      xato('students', (await db.from('students').insert(o)).error)
    } else if (a.tur === 'saytga') {
      xato('students', (await db.from('students').update(a.ozgarish).eq('id', a.kalit)).error)
      const p = x.students.find((s) => s.id === a.kalit)?.profile_id
      if (p && 'fish' in a.ozgarish) xato('profiles (ism)', (await db.from('profiles').update({ ism: a.ozgarish.fish }).eq('id', p).eq('rol', 'oquvchi')).error)
    }
  }
  for (const [ikkinchi, asosiy] of alias) {
    const { error } = await db.rpc('oquvchi_birlashtir', { p_asosiy: asosiy, p_ikkinchi: ikkinchi })
    xato(`birlashtirish ${ikkinchi} → ${asosiy}`, error)
    hisob.push(`birlashtirildi: saytdagi ${ikkinchi} → Sheets'dagi ${asosiy}`)
  }

  /* Yozilishlar */
  const enId = new Map(x.enrollments.map((e) => [sk(e.sheets_id, e.id), e.id]))
  for (const j of juftliklar.filter((z) => z.tur === 'yozilish')) {
    const id = enId.get(j.saytKalit)!
    xato('enrollments (ID)', (await db.from('enrollments').update({ sheets_id: j.sheetsKalit }).eq('id', id)).error)
    enId.set(j.sheetsKalit, id)
  }
  for (const a of amallar('yozilish')) {
    if (a.tur === 'saytga-yangi') {
      const y = d.yozilishlar.find((z) => z.sheets_id === a.kalit)!
      const { data, error } = await db.from('enrollments').insert({
        sheets_id: y.sheets_id, student_id: y.student_id, group_id: y.group_id, boshlandi: y.boshlandi, tugadi: y.tugadi,
        chegirma_summa: y.chegirma_summa, chegirma_oy: y.chegirma_oy, chegirma2_summa: y.chegirma2_summa,
        chegirma2_oy: y.chegirma2_oy, chegirma_sabab: y.chegirma_sabab, holat: y.holat, vip: y.vip,
      }).select('id').single()
      xato('enrollments', error)
      enId.set(a.kalit, data!.id as string)
    } else if (a.tur === 'saytga') {
      const o: Record<string, unknown> = { ...a.ozgarish }
      if ('tugadi' in o) o.holat = o.tugadi ? 'tugagan' : 'faol'
      xato('enrollments', (await db.from('enrollments').update(o).eq('id', enId.get(a.kalit)!)).error)
    }
  }

  /* Tuzatishlar: saytdagisi bekor, Sheets'dagisi yoziladi */
  for (const a of amallar('tuzatish')) {
    if (a.tur !== 'saytga' && a.tur !== 'saytga-yangi') continue
    const [sid, davr] = a.kalit.split('|')
    const eid = enId.get(sid)
    if (!eid) { hisob.push(`tuzatish ${a.kalit}: yozilish topilmadi`); continue }
    xato('tuzatishlar (bekor)', (await db.from('tuzatishlar').update({ bekor: true, bekor_sabab: 'Sheets bilan sinxron' })
      .eq('enrollment_id', eid).eq('davr', davr).eq('bekor', false)).error)
    const yangilar = d.tuzatishRoyxat.filter((t) => t.kalit && d.yozilishlar.find((y) => y.kalit === t.kalit)?.sheets_id === sid && davrdanOy(t.oy) === davr)
    if (yangilar.length) {
      xato('tuzatishlar', (await db.from('tuzatishlar').insert(yangilar.map((t) => ({ enrollment_id: eid, davr, summa: t.summa, sabab: t.sabab })))).error)
    }
  }

  /* To'lovlar */
  const tolId = new Map(x.payments.map((p) => [sk(p.sheets_id, p.id), p.id]))
  for (const j of juftliklar.filter((z) => z.tur === 'tolov')) {
    const id = tolId.get(j.saytKalit)!
    xato('payments (ID)', (await db.from('payments').update({ sheets_id: j.sheetsKalit }).eq('id', id)).error)
    tolId.set(j.sheetsKalit, id)
  }
  const yozSid = new Map(d.yozilishlar.map((y) => [y.kalit, y.sheets_id]))
  for (const a of amallar('tolov')) {
    if (a.tur === 'saytga-yangi') {
      const p = d.tolovlar.find((z) => z.sheets_id === a.kalit)!
      const ysid = p.kalit ? yozSid.get(p.kalit) : null
      xato('payments', (await db.from('payments').insert({
        sheets_id: p.sheets_id, student_id: p.student_id, enrollment_id: ysid ? (enId.get(ysid) ?? null) : null,
        sana: p.sana, davr: p.davr, summa: p.summa, usul: p.usul, izoh: p.izoh,
        tasdiqlangan: p.tasdiqlangan, tasdiqlangan_vaqt: p.tasdiqlangan_vaqt, manba: 'sheets', bekor: false,
      })).error)
    } else if (a.tur === 'saytga') {
      const o: Record<string, unknown> = { ...a.ozgarish }
      if ('yozilish' in o) { o.enrollment_id = o.yozilish ? (enId.get(String(o.yozilish)) ?? null) : null; delete o.yozilish }
      if (o.tasdiqlangan === true) o.tasdiqlangan_vaqt = d.tolovlar.find((z) => z.sheets_id === a.kalit)?.tasdiqlangan_vaqt ?? new Date().toISOString()
      xato('payments', (await db.from('payments').update(o).eq('id', tolId.get(a.kalit)!)).error)
    }
  }

  /* Probniylar */
  for (const a of amallar('probniy')) {
    const p = d.probniylar.find((z) => z.sheets_id === a.kalit)
    if (!p) continue
    if (a.tur === 'saytga-yangi') {
      const { created_at, ...q } = p
      xato('leads', (await db.from('leads').insert({ ...q, manba: 'boshqa', ...(created_at ? { created_at } : {}) })).error)
    } else if (a.tur === 'saytga') {
      xato('leads', (await db.from('leads').update(a.ozgarish).eq('sheets_id', a.kalit)).error)
    }
  }

  /* Hisob-faktura — Sheets formulasi bo'yicha, faqat "tinch" yozilishlarda:
     Sheets'da bor va shu yurishda Sheets'ga ketayotgan / ziddiyatli o'zgarishi yo'q. */
  const enHammasi = await db.from('enrollments').select('id, sheets_id')
  xato('enrollments', enHammasi.error)
  const sidDan = new Map((enHammasi.data ?? []).filter((e) => e.sheets_id).map((e) => [e.sheets_id as string, e.id as string]))
  const tinch = new Map<string, string>()   // yozilish kaliti (S|G) → enrollment id
  for (const y of d.yozilishlar) {
    if (!y.sheets_id || bloklangan.has(`yozilish:${y.sheets_id}`)) continue
    const id = sidDan.get(y.sheets_id)
    if (id) tinch.set(y.kalit, id)
  }
  const kerak = d.hisoblar
    .filter((h) => tinch.has(h.kalit))
    .map((h) => ({ enrollment_id: tinch.get(h.kalit)!, davr: h.davr, summa: h.xomSumma, chegirma: h.xomChegirma, tuzatish: 0 }))
  const ids = [...new Set(tinch.values())]
  const bor: { id: string; enrollment_id: string; davr: string; summa: number; chegirma: number }[] = []
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await db.from('invoices').select('id, enrollment_id, davr, summa, chegirma, tuzatish').in('enrollment_id', ids.slice(i, i + 150))
    xato('invoices', error)
    bor.push(...((data ?? []) as typeof bor))
  }
  const borK = new Map(bor.map((h) => [`${h.enrollment_id}|${h.davr}`, h]))
  /* Bazadagi summa — VIP/tuzatish triggerlaridan keyingi; xom summa (summa+chegirma+tuzatish
     ichidagi narx) bilan solishtirish uchun yakuniy qiymatni Sheets hisobidan olamiz */
  const yakuniy = new Map(d.hisoblar.filter((h) => tinch.has(h.kalit)).map((h) => [`${tinch.get(h.kalit)}|${h.davr}`, h.summa]))
  const ozgargan = kerak.filter((h) => {
    const b = borK.get(`${h.enrollment_id}|${h.davr}`)
    return !b || Number(b.summa) !== yakuniy.get(`${h.enrollment_id}|${h.davr}`)
  })
  for (let i = 0; i < ozgargan.length; i += 200) {
    xato('invoices', (await db.from('invoices').upsert(ozgargan.slice(i, i + 200), { onConflict: 'enrollment_id,davr' })).error)
  }
  const kerakK = new Set(kerak.map((h) => `${h.enrollment_id}|${h.davr}`))
  const ortiq = bor.filter((h) => !kerakK.has(`${h.enrollment_id}|${h.davr}`)).map((h) => h.id)
  for (let i = 0; i < ortiq.length; i += 200) {
    xato('invoices (ortiqcha)', (await db.from('invoices').delete().in('id', ortiq.slice(i, i + 200))).error)
  }
  hisob.push(`hisob-faktura: ${ozgargan.length} yangilandi, ${ortiq.length} ortiqcha olib tashlandi`)
  return { hisob, enId, tolId }
}

/* ------------------------------------------------------------------ */
/*  6. Sheets'ga yozish                                                 */
/* ------------------------------------------------------------------ */

async function sheetsgaYoz(
  kitob: Map<string, Varaq>, d: Tayyor, x: SaytXom, D: Record<Tur, Toplam>,
  rejalar: Record<Tur, Reja>, quruq: boolean,
) {
  const OQ = varaq(kitob, "O'quvchilar")
  const TL = varaq(kitob, 'Tolovlar')
  const US = varaq(kitob, 'Ustozlar')
  const GR = varaq(kitob, 'Guruhlar')
  const c = {
    id: ustun(OQ, 'ID'), fish: ustun(OQ, 'Ism familya'), tug: ustun(OQ, "Tug'ilgan sana"),
    ota: ustun(OQ, 'Ota telefoni'), ona: ustun(OQ, 'Ona telefoni'), shax: ustun(OQ, 'Shaxsiy telefon'),
    guruh: ustun(OQ, 'Guruh'), qosh: ustun(OQ, "Qo'shilgan sana"), holat: ustun(OQ, 'Holat'), izoh: ustun(OQ, 'Izoh'),
    tugadi: ustun(OQ, 'Tugadi'), c1: ustun(OQ, '1-chegirma'), o1: ustun(OQ, '1-necha oy'),
    c2: ustun(OQ, '2-chegirma'), o2: ustun(OQ, '2-necha oy'), narx: ustun(OQ, 'Oylik narx'),
  }
  const t = {
    sana: ustun(TL, 'Sana'), oq: ustun(TL, "O'quvchi"), davr: ustun(TL, 'Davr'), summa: ustun(TL, 'Summa'),
    usul: ustun(TL, 'Usul'), izoh: ustun(TL, 'Izoh'), narx: ustun(TL, 'Oylik narx'), kirit: ustun(TL, 'Kiritilgan'),
  }
  const u = { tel: ustun(US, 'Telefon'), tg: ustun(US, 'Telegram ID') }

  const kataklar: Katak[] = []
  const qolda: string[] = []
  const k = (v: Varaq, qator: number, ust: number, qiy: Katak['qiymat']) => kataklar.push({ varaq: v.nom, qator, ustun: ust, qiymat: qiy })

  const oqQator = new Map(OQ.qatorlar.map((q) => [matn(q, 'ID').toUpperCase(), q]))
  const asosiy = (id: string) => d.birlash.get(id) ?? id
  /** Bolaning O'quvchilar varag'idagi barcha qatorlari (2 fanli — 2 qator) */
  const bolaQatorlari = (sid: string) => OQ.qatorlar.filter((q) => asosiy(matn(q, 'ID').toUpperCase()) === sid)
  const guruhNomi = new Map(GR.qatorlar.map((q) => [matn(q, 'Guruh ID'), matn(q, 'Guruh nomi')]))
  const guruhNarx = new Map(GR.qatorlar.map((q) => [matn(q, 'Guruh ID'), Number(qiymat(q, 'Oylik narx')) || null]))
  const st = new Map(x.students.map((s) => [s.id, s]))

  /* Band ID'lar: Sheets (O'quvchilar + Arxiv) va sayt (o'quvchi + yozilish) */
  const band = new Set<number>()
  const qosh = (id: string | null | undefined) => { const m = id?.match(/^S(\d+)$/); if (m) band.add(Number(m[1])) }
  OQ.qatorlar.forEach((q) => qosh(matn(q, 'ID').toUpperCase()))
  varaqBormi(kitob, 'Arxiv')?.qatorlar.forEach((q) => qosh(matn(q, 'ID').toUpperCase()))
  x.students.forEach((s) => qosh(s.id))
  x.enrollments.forEach((e) => qosh(e.sheets_id))
  const yangiId = () => { const n = Math.max(0, ...band) + 1; band.add(n); return `S${String(n).padStart(3, '0')}` }
  const sheetsdaBor = (id: string) => oqQator.has(id) || !!varaqBormi(kitob, 'Arxiv')?.qatorlar.some((q) => matn(q, 'ID').toUpperCase() === id)

  /* ── O'quvchi ma'lumoti o'zgargan — bolaning hamma qatoriga ── */
  for (const a of rejalar.oquvchi.amallar) {
    if (a.tur !== 'sheetsga') continue
    const qatorlar = bolaQatorlari(a.kalit)
    if (!qatorlar.length) { qolda.push(`${a.kalit}: O'quvchilar varag'ida qatori yo'q (arxivdami?) — ${Object.keys(a.ozgarish).join(', ')} qo'lda`); continue }
    for (const q of qatorlar) {
      const o = a.ozgarish
      if ('fish' in o) k(OQ, q._qator, c.fish, o.fish)
      if ('tugilgan_sana' in o) k(OQ, q._qator, c.tug, sanaSeriya(o.tugilgan_sana as string | null))
      if ('ota_tel' in o) k(OQ, q._qator, c.ota, telefonSheets(o.ota_tel as string | null))
      if ('ona_tel' in o) k(OQ, q._qator, c.ona, telefonSheets(o.ona_tel as string | null))
      if ('shaxsiy_tel' in o) k(OQ, q._qator, c.shax, telefonSheets(o.shaxsiy_tel as string | null))
      if ('izoh' in o) k(OQ, q._qator, c.izoh, o.izoh)
    }
  }

  /* ── Yozilish (chegirma) o'zgargan ── */
  for (const a of rejalar.yozilish.amallar) {
    if (a.tur !== 'sheetsga') continue
    const q = oqQator.get(a.kalit)
    if (!q) { qolda.push(`${a.kalit}: qatori O'quvchilar varag'ida yo'q — chegirma qo'lda`); continue }
    const o = a.ozgarish
    if ('chegirma_summa' in o) k(OQ, q._qator, c.c1, Number(o.chegirma_summa) || null)
    if ('chegirma_oy' in o) k(OQ, q._qator, c.o1, o.chegirma_oy)
    if ('chegirma2_summa' in o) k(OQ, q._qator, c.c2, Number(o.chegirma2_summa) || null)
    if ('chegirma2_oy' in o) k(OQ, q._qator, c.o2, o.chegirma2_oy)
  }

  /* ── Yangi qatorlar: saytda qo'shilgan yozilish (va bola) ── */
  let oxir = Math.max(1, ...OQ.qatorlar.map((q) => q._qator))
  const yangiQatorlar: number[] = []
  const yozYangiId = new Map<string, string>()          // 'sayt:<uuid>' → yangi Sheets ID
  const yangiGuruh = new Map<string, string>()          // yangi Sheets ID → guruh nomi
  const yozilishli = new Set<string>()
  const oqYangi = new Set(rejalar.oquvchi.amallar.filter((a) => a.tur === 'sheetsga-yangi').map((a) => a.kalit))
  const oqZiddiyat = new Set(rejalar.oquvchi.amallar.filter((a) => a.tur === 'ziddiyat').map((a) => a.kalit))
  for (const a of rejalar.yozilish.amallar) {
    if (a.tur !== 'sheetsga-yangi') continue
    const y = a.yozuv
    const sid = String(y.student_id)
    const s = st.get(sid)
    if (!s) { qolda.push(`${a.kalit}: o'quvchisi ${sid} saytda topilmadi`); continue }
    const nom = guruhNomi.get(String(y.group_id))
    if (!nom) { qolda.push(`${a.kalit} (${s.fish}): guruh ${y.group_id} Sheets'da yo'q — avval guruhni Sheets'da oching`); continue }
    if (oqZiddiyat.has(sid)) { qolda.push(`${a.kalit} (${s.fish}): ${sid} bo'yicha ziddiyat bor — avval uni hal qiling`); continue }
    if (!oqYangi.has(sid) && !sheetsdaBor(sid)) { qolda.push(`${a.kalit} (${s.fish}): ${sid} Sheets'da yo'q`); continue }
    // Bolaning birinchi qatori o'z ID'si bilan; ikkinchi fan — yangi ID (bot ham shunday qiladi).
    // Ikkinchi qatorni Sheets ism+telefon bo'yicha shu bolaga bog'laydi — telefonsiz bog'lanmaydi.
    const birinchi = oqYangi.has(sid) && ![...yozYangiId.values()].includes(sid)
    if (!birinchi && !s.ota_tel && !s.ona_tel && !s.shaxsiy_tel) {
      qolda.push(`${a.kalit} (${s.fish}): ikkinchi fan, telefoni yo'q — Sheets'ga qo'lda qo'shing`)
      continue
    }
    if (oxir + 1 > OQ_OXIRGI) { qolda.push(`${a.kalit} (${s.fish}): O'quvchilar varag'ida formulali bo'sh qator qolmadi (${OQ_OXIRGI})`); continue }
    const id = birinchi ? sid : yangiId()
    yozYangiId.set(a.kalit, id)
    yangiGuruh.set(id, nom)
    yozilishli.add(sid)
    const r = ++oxir
    yangiQatorlar.push(r)
    k(OQ, r, c.id, id)
    k(OQ, r, c.fish, s.fish)
    k(OQ, r, c.tug, sanaSeriya(s.tugilgan_sana))
    k(OQ, r, c.ota, telefonSheets(s.ota_tel))
    k(OQ, r, c.ona, telefonSheets(s.ona_tel))
    k(OQ, r, c.shax, telefonSheets(s.shaxsiy_tel))
    k(OQ, r, c.guruh, nom)
    k(OQ, r, c.qosh, sanaSeriya(String(y.boshlandi)))
    k(OQ, r, c.holat, y.vip ? 'VIP' : s.holat === 'tanaffus' ? 'Tanaffus' : 'Faol')
    if (s.izoh) k(OQ, r, c.izoh, s.izoh)
    if (y.tugadi) k(OQ, r, c.tugadi, sanaSeriya(String(y.tugadi)))
    if (Number(y.chegirma_summa)) { k(OQ, r, c.c1, Number(y.chegirma_summa)); k(OQ, r, c.o1, y.chegirma_oy) }
    if (Number(y.chegirma2_summa)) { k(OQ, r, c.c2, Number(y.chegirma2_summa)); k(OQ, r, c.o2, y.chegirma2_oy) }
  }
  /* Guruhsiz yangi bola — guruhi bo'sh qator */
  for (const a of rejalar.oquvchi.amallar) {
    if (a.tur !== 'sheetsga-yangi' || yozilishli.has(a.kalit)) continue
    const s = st.get(a.kalit)!
    if (oxir + 1 > OQ_OXIRGI) { qolda.push(`${a.kalit} (${s.fish}): O'quvchilar varag'ida formulali bo'sh qator qolmadi`); continue }
    const r = ++oxir
    yangiQatorlar.push(r)
    k(OQ, r, c.id, a.kalit)
    k(OQ, r, c.fish, s.fish)
    k(OQ, r, c.tug, sanaSeriya(s.tugilgan_sana))
    k(OQ, r, c.ota, telefonSheets(s.ota_tel))
    k(OQ, r, c.ona, telefonSheets(s.ona_tel))
    k(OQ, r, c.shax, telefonSheets(s.shaxsiy_tel))
    k(OQ, r, c.holat, s.holat === 'tanaffus' ? 'Tanaffus' : 'Faol')
    if (s.izoh) k(OQ, r, c.izoh, s.izoh)
  }

  /* ── To'lovlar ── */
  const tlQator = new Map(TL.qatorlar.map((q) => [matn(q, 'ID').toUpperCase(), q]))
  const pay = new Map(x.payments.map((p) => [sk(p.sheets_id, p.id), p]))
  for (const a of rejalar.tolov.amallar) {
    if (a.tur !== 'sheetsga') continue
    const q = tlQator.get(a.kalit)
    if (!q) { qolda.push(`to'lov ${a.kalit}: Tolovlar varag'ida topilmadi`); continue }
    const o = a.ozgarish
    if ('sana' in o) k(TL, q._qator, t.sana, sanaSeriya(o.sana as string))
    if ('davr' in o) k(TL, q._qator, t.davr, o.davr)
    if ('summa' in o) k(TL, q._qator, t.summa, Number(o.summa))
    if ('usul' in o) k(TL, q._qator, t.usul, usulSheets(o.usul as string | null))
    if ('izoh' in o) k(TL, q._qator, t.izoh, o.izoh)
  }
  let tOxir = Math.max(1, ...TL.qatorlar.map((q) => q._qator))
  const yangiTolov = new Map<string, number>()        // 'sayt:<id>' → Sheets qatori (ID = T + qator-1)
  for (const a of rejalar.tolov.amallar) {
    if (a.tur !== 'sheetsga-yangi') continue
    const p = pay.get(a.kalit)!
    const s = st.get(String(a.yozuv.student_id))
    // To'lov qaysi qatorga (fan) tegishli: yozilishi bo'yicha, bo'lmasa bolaning yagona faol qatori
    let qatorId = a.yozuv.yozilish ? String(a.yozuv.yozilish) : null
    if (qatorId?.startsWith('sayt:')) qatorId = yozYangiId.get(qatorId) ?? null
    if (!qatorId) {
      const faol = [...D.yozilish].filter(([kk, v]) => v.student_id === a.yozuv.student_id && !v.tugadi && !kk.startsWith('sayt:'))
      if (faol.length === 1) qatorId = faol[0][0]
    }
    const qq = qatorId ? oqQator.get(qatorId) : undefined
    const gNom = qq ? matn(qq, 'Guruh') : qatorId ? yangiGuruh.get(qatorId) : undefined
    if (!s || !qatorId || !gNom) {
      qolda.push(`to'lov ${a.kalit} (${s?.fish ?? a.yozuv.student_id}, ${pul(Number(a.yozuv.summa))}): qaysi fanga ekanini aniqlab bo'lmadi — Sheets'ga qo'lda kiriting`)
      continue
    }
    if (tOxir + 1 > TL_OXIRGI) { qolda.push(`to'lov ${a.kalit}: Tolovlar varag'ida formulali bo'sh qator qolmadi`); continue }
    const r = ++tOxir
    yangiTolov.set(a.kalit, r)
    const gId = [...guruhNomi].find(([, n]) => n === gNom)?.[0]
    k(TL, r, t.sana, sanaSeriya(p.sana))
    k(TL, r, t.oq, `${s.fish} (${qatorId}) · ${gNom}`)
    k(TL, r, t.davr, p.davr)
    k(TL, r, t.summa, Number(p.summa))
    k(TL, r, t.usul, usulSheets(p.usul))
    if (p.izoh) k(TL, r, t.izoh, p.izoh)
    k(TL, r, t.narx, (qq ? Number(qiymat(qq, 'Oylik narx')) || null : null) ?? (gId ? guruhNarx.get(gId) ?? null : null))
    k(TL, r, t.kirit, vaqtSeriya(new Date().toISOString()))
    // Tasdiq — himoyalangan ustun; saytda tasdiqlangan bo'lsa keyingi yurish "qo'lda" deb eslatadi
  }

  /* ── Ustoz telefoni / Telegram ID ── */
  const usQator = new Map(US.qatorlar.map((q) => [matn(q, 'ID'), q]))
  for (const a of rejalar.ustoz.amallar) {
    if (a.tur !== 'sheetsga') continue
    const q = usQator.get(a.kalit)
    if (!q) { qolda.push(`ustoz ${a.kalit}: Ustozlar varag'ida topilmadi`); continue }
    if ('telefon' in a.ozgarish) k(US, q._qator, u.tel, telefonSheets(a.ozgarish.telefon as string | null))
    if ('telegram_id' in a.ozgarish) k(US, q._qator, u.tg, a.ozgarish.telegram_id)
  }

  if (!quruq && kataklar.length) {
    const sh = await yozuvchi()
    // Bot ayni paytda shu qatorlarga yozmaganini tekshiramiz
    if (!(await bosh(sh, SHEETS_ID!, OQ.nom, c.fish, yangiQatorlar)) || !(await bosh(sh, SHEETS_ID!, TL.nom, t.oq, [...yangiTolov.values()]))) {
      throw new Error("Sheets'dagi bo'sh qatorlar band bo'lib qoldi (bot ayni paytda yozdimi?) — keyingi yurishda qayta urinadi")
    }
    await kataklarniYoz(sh, SHEETS_ID!, kataklar)
  }
  return { kataklar, qolda, yozYangiId, yangiTolov, yozilganOquvchi: new Set([...yozilishli].filter((sid) => [...yozYangiId.values()].includes(sid)).concat([...oqYangi].filter((sid) => !yozilishli.has(sid)))) }
}

/* ------------------------------------------------------------------ */
/*  7. Asosiy                                                           */
/* ------------------------------------------------------------------ */

async function ishga() {
  if (!SHEETS_ID) throw new Error('SHEETS_ID topilmadi (.env.local)')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase kalitlari topilmadi')
  const db = dbOch(url, key)

  const vaqt = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tashkent' })
  console.log(`— SINXRON ${TASDIQ ? '(YOZADI)' : '(reja, yozmaydi)'} · ${vaqt} —\n`)

  const kitob = await kitobniOqi(SHEETS_ID)
  // Sarlavha tekshiruvi (10.10: A1 "ID" o'rniga "xa" — hamma o'quvchi "yo'qolgan" bo'lib ko'rindi)
  for (const [v, nomlar] of Object.entries({
    "O'quvchilar": ['ID', 'Ism familya', 'Guruh', "Qo'shilgan sana", 'Holat'],
    Tolovlar: ['ID', 'Sana', "O'quvchi", 'Davr', 'Summa', 'Tasdiq'],
    Guruhlar: ['Guruh ID', 'Guruh nomi'],
    Ustozlar: ['ID', "O'qituvchi"],
  })) for (const n of nomlar) ustun(varaq(kitob, v), n)

  const d = malumotniQur(kitob)
  const s = solishtir(d)
  const baza = holatniOqi()
  const S = sheetsKorinishi(d)
  const x = await saytniOqi(db)
  const { rejalar, juftliklar, alias, D } = rejaTuz(S, x, baza)

  /* ── To'xtatuvchilar ── */
  const toxta: string[] = [...toxtatuvchilar]
  if (s.farqlar.length) toxta.push(`Sheets hisobida ${s.farqlar.length} ta tushuntirilmagan farq`)
  if (baza) {
    for (const t of ['oquvchi', 'tolov'] as const) {
      const oldin = Object.keys(baza.toplamlar[t] ?? {}).length
      if (oldin > 20 && S[t].size < oldin * 0.7) toxta.push(`Sheets'da ${NOMI[t]} soni keskin kamaydi: ${oldin} → ${S[t].size} (varaq buzilganmi?)`)
    }
  }
  if (!KOP) {
    for (const t of TARTIB) {
      const n = rejalar[t].amallar.filter((a) => a.tur === 'saytga-yangi' || a.tur === 'sheetsga-yangi').length
      if (n > CHEGARA) toxta.push(`${NOMI[t]}: ${n} ta yangi yozuv (chegara ${CHEGARA}) — tekshirib, --kop bilan yurgizing`)
    }
  }

  console.log('Solishtirildi (Sheets / sayt / oldingi holat):')
  for (const t of TARTIB) console.log(`  ${NOMI[t].padEnd(16)} ${S[t].size} / ${D[t].size} / ${baza ? Object.keys(baza.toplamlar[t] ?? {}).length : '—'}`)

  /* ── Hisobot ── */
  const sanoq = { saytga: 0, sheetsga: 0, ziddiyat: 0, qolda: 0, yoqoldi: 0 }
  const bloklangan = new Set<string>()
  for (const t of TARTIB) {
    const am = rejalar[t].amallar
    if (!am.length) continue
    console.log(`\n${NOMI[t]} (${am.length}):`)
    for (const a of am) {
      console.log('  ' + amalMatni(t, a))
      if (a.tur === 'saytga' || a.tur === 'saytga-yangi') sanoq.saytga++
      else if (a.tur === 'sheetsga' || a.tur === 'sheetsga-yangi') sanoq.sheetsga++
      else sanoq[a.tur === 'ziddiyat' ? 'ziddiyat' : a.tur === 'qolda' ? 'qolda' : 'yoqoldi']++
      if (a.tur === 'ziddiyat' || a.tur === 'qolda' || a.tur === 'sheetsga' || a.tur === 'sheetsga-yangi') bloklangan.add(`${t}:${a.kalit}`)
    }
  }
  for (const j of juftliklar) console.log(`  = juftlandi: ${NOMI[j.tur]} saytdagi ${j.saytKalit} ↔ Sheets ${j.sheetsKalit}`)
  // Tuzatishi o'zgarayotgan yozilishning hisobi ham kutadi
  for (const a of rejalar.tuzatish.amallar) if (a.tur === 'ziddiyat' || a.tur === 'qolda') bloklangan.add(`yozilish:${a.kalit.split('|')[0]}`)

  console.log(`\nJAMI: saytga ${sanoq.saytga} · Sheets'ga ${sanoq.sheetsga} · ziddiyat ${sanoq.ziddiyat} · qo‘lda ${sanoq.qolda} · yo‘qolgan ${sanoq.yoqoldi} · juftlandi ${juftliklar.length}`)
  console.log(`Sheets hisobi: to‘lashi kerak ${pul(s.jamiKerak)} / Sheets ${pul(s.jamiKerakSheets)} · to‘langan ${pul(s.jamiTolangan)} / Sheets ${pul(s.jamiTolanganSheets)}`)

  if (toxta.length) {
    console.log(`\nYOZILMAYDI — to‘xtatuvchi muammo (${toxta.length}):`)
    toxta.forEach((m) => console.log('  ✗', m))
  }
  if (ogohlantirishlar.length) console.log(`\nOgohlantirishlar: ${ogohlantirishlar.length} (migrate:dry da batafsil)`)

  // Sheets'ga yozish rejasi (quruq) — qo'lda qoladiganlarni ham ko'rsatadi
  const sq = await sheetsgaYoz(kitob, d, x, D, rejalar, true)
  if (sq.qolda.length) { console.log(`\nSheets'ga yozib bo'lmaydi — qo‘lda (${sq.qolda.length}):`); sq.qolda.forEach((m) => console.log('  ✋', m)) }
  console.log(`Sheets'ga yoziladigan kataklar: ${sq.kataklar.length}`)

  if (!TASDIQ) {
    console.log('\nReja tugadi — hech narsa yozilmadi. Yozish: --tasdiq')
    console.log(`NATIJA ${JSON.stringify({ ...sanoq, juft: juftliklar.length, toxta: toxta.length, qolda2: sq.qolda.length })}`)
    return
  }
  if (toxta.length) {
    console.log(`NATIJA ${JSON.stringify({ ...sanoq, toxta: toxta.length, yozildi: false })}`)
    process.exit(2)
  }

  /* ── Yozish: avval sayt, keyin Sheets, oxirida holat ── */
  const sy = await saytgaYoz(db, d, x, rejalar, juftliklar, alias, bloklangan)
  sy.hisob.forEach((m) => console.log('  ·', m))
  const shy = await sheetsgaYoz(kitob, d, x, D, rejalar, false)
  console.log(`  · Sheets'ga ${shy.kataklar.length} katak yozildi`)

  // Sheets'ga qo'shilgan yozuvlar endi Sheets ID oldi — saytga ham, holatga ham
  const yangiBaza = Object.fromEntries(TARTIB.map((t) => [t, rejalar[t].yangiBaza])) as Record<Tur, Toplam>
  for (const [saytK, id] of shy.yozYangiId) {
    const eid = saytK.slice(5)
    const { error } = await db.from('enrollments').update({ sheets_id: id }).eq('id', eid)
    if (error) throw new Error(`enrollments (yangi ID): ${error.message}`)
    kalitAlmashtir(yangiBaza.yozilish, saytK, id)
    for (const p of yangiBaza.tolov.values()) if (p.yozilish === saytK) p.yozilish = id
  }
  for (const [saytK, qator] of shy.yangiTolov) {
    const tid = `T${String(qator - 1).padStart(4, '0')}`
    const { error } = await db.from('payments').update({ sheets_id: tid }).eq('id', Number(saytK.slice(5)))
    if (error) throw new Error(`payments (yangi ID): ${error.message}`)
    kalitAlmashtir(yangiBaza.tolov, saytK, tid)
    const b = yangiBaza.tolov.get(tid)
    if (b) b.tasdiqlangan = false
  }
  // Sheets'ga yozilmay qolgan yangi yozuvlar holatga kirmaydi — keyingi safar yana urinadi
  for (const t of ['yozilish', 'tolov', 'oquvchi'] as const) {
    for (const kk of [...yangiBaza[t].keys()]) if (kk.startsWith('sayt:')) yangiBaza[t].delete(kk)
  }
  for (const a of rejalar.oquvchi.amallar) {
    if (a.tur === 'sheetsga-yangi' && !shy.yozilganOquvchi.has(a.kalit)) yangiBaza.oquvchi.delete(a.kalit)
  }

  holatniSaqla({ versiya: 1, vaqt, toplamlar: Object.fromEntries(TARTIB.map((t) => [t, toplamdan(yangiBaza[t])])) })
  console.log(`\nHolat saqlandi: ${HOLAT_FAYL}`)
  console.log(`NATIJA ${JSON.stringify({ ...sanoq, juft: juftliklar.length, qolda2: shy.qolda.length, yozildi: true })}`)
}

ishga().catch((e) => {
  console.error('\nXATO:', e instanceof Error ? e.message : e)
  process.exit(1)
})


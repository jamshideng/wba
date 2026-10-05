/**
 * Faza 0 — Students_wba (Google Sheets) → Postgres.
 *
 *   npm run migrate:dry      faqat ko'rsatadi va solishtiradi, yozmaydi
 *   npm run migrate -- --tasdiq   bazaga yozadi (20.09 dan tasdiq shart:
 *                                  sayt asosiy manba, Sheets — ko'zgu)
 *   npm run migrate -- --davomat    davomat jurnallarini ham ko'chiradi
 *
 * Jadval allaqachon normalizatsiya qilingan, shuning uchun bu skript
 * taxmin qilmaydi: varaq nomi bo'yicha olinadi, ustun sarlavhasi
 * bo'yicha o'qiladi. Ikkita joyda hisob bor va ikkalasi ham Sheets
 * formulasini AYNAN takrorlaydi:
 *
 *   · hisob-faktura  — Qatnashuvda `invoices` ga mos varaq yo'q. Har oy
 *     uchun summa = o'sha oydagi narx (Narxlar tarixi) − o'sha oyda
 *     amal qiladigan chegirma bosqichi (U_Qatnashuv.js:100-133).
 *   · qarz           — Σ hisob-faktura − Σ to'lov.
 *
 * Shuning uchun --dry-run oxirida SOLISHTIRUV chiqadi: hisoblangan
 * summa Qatnashuvning "To'lashi kerak" / "To'langan" / "Qarz"
 * ustunlariga mos kelmasa, ko'chirish boshlanmaydi. Istisno — sababi
 * aniq Sheets xatosi bo'lgan farq (bir guruhga ikki marta yozilish,
 * matn bo'lib kiritilgan sana): u alohida ro'yxatda chiqadi, bazada esa
 * to'g'ri hisoblanadi.
 *
 * Qatnashuv, Tolovlar va Probniylar qatorlari o'z ID'si (Q001, T0001,
 * P001) bilan yoziladi — skriptni qayta yurgizish xavfsiz: yozuv
 * yangilanadi, ikkilanmaydi (0015_sheets_id.sql).
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  kitobniOqi, varaq, varaqBormi, matn, qiymat, belgi,
  type Qator,
} from './lib/sheets'
import {
  pulga, telefonga, sanaga, davrga, usulga, bosqichNormal, yonalishAniqla,
  axlatmi, kunTuriga, vaqtAjrat, kalitAjrat, oyRaqami, davrdan, oylarSoni,
  chegirmaOyda, narxTarixi, narxOyda,
  type KunTuri, type NarxQator,
} from './lib/parse'
import { jurnallarniOqi, type Dars, type Davomat, type JurnalNatija } from './lib/jurnal'

config({ path: '.env.local' })

const DRY = process.argv.includes('--dry-run')
const DAVOMAT = process.argv.includes('--davomat')
/** Prod'ni o'qib reja chiqaradi, yozmaydi */
const REJA = process.argv.includes('--reja')
/** Davomat shu kungacha (shu kun kirmaydi) Sheets'dan; undan keyin davomat saytda (01.10 qaror) */
const DAVOMAT_GACHA = process.argv.find((a) => a.startsWith('--davomat-gacha='))?.split('=')[1] ?? '2026-10-02'
const SHEETS_ID = process.env.SHEETS_ID

/* ------------------------------------------------------------------ */
/*  Ogohlantirishlar                                                    */
/* ------------------------------------------------------------------ */

const ogohlantirishlar: string[] = []
const ogoh = (m: string) => {
  if (ogohlantirishlar.length < 300) ogohlantirishlar.push(m)
}

/** Yozishni to'xtatadigan muammolar — taxmin qilmasdan hal qilib bo'lmaydi. */
const toxtatuvchilar: string[] = []
const toxtat = (m: string) => {
  toxtatuvchilar.push(m)
}

/* ------------------------------------------------------------------ */
/*  Tiplar                                                             */
/* ------------------------------------------------------------------ */

type Ustoz = {
  id: string
  ism: string
  telefon: string | null
  telegram_id: number | null
  holat: 'faol' | 'bloklangan'
}

type Guruh = {
  id: string
  nom: string
  subject_id: string | null
  bosqich: string | null
  teacher_id: string | null
  boshlanish: string
  tugash: string
  kun_turi: KunTuri
  oylik_narx: number
  holat: 'faol' | 'yopilgan'
}

type Oquvchi = {
  id: string
  fish: string
  tugilgan_sana: string | null
  ota_tel: string | null
  ona_tel: string | null
  shaxsiy_tel: string | null
  qoshilgan_sana: string
  holat: 'faol' | 'tanaffus' | 'ketgan'
  izoh: string | null
  /** VIP — pul to'lamaydi, lekin faol o'quvchi hisobida (Sheets Holat = "VIP") */
  vip: boolean
  /** Arxivga o'tgan kun va sabab (0030) — faqat Arxiv varag'idagilar */
  arxiv_sana: string | null
  arxiv_sabab: string | null
}

type Yozilish = {
  kalit: string                 // "S001|N01"
  sheets_id: string | null      // Qatnashuv ID — Q001
  student_id: string
  group_id: string
  guruhNomi: string
  boshlandi: string
  tugadi: string | null
  chegirma_summa: number
  chegirma_oy: number | null
  chegirma2_summa: number
  chegirma2_oy: number | null
  chegirma_sabab: string | null
  holat: 'faol' | 'tugagan'
  /** VIP — hisob-fakturalari 0 so'm */
  vip: boolean
  /** Arxivdan qaytganning eski qarzi (O'quvchilar "Oldingi qoldiq") */
  qoldiq: number
  /** Arxiv qatori: "Arxivga o'tgan" (seriya) — _Arxiv_tolovlar shu sessiya bo'yicha sanaladi */
  arxivVaqt?: number
  /**
   * Arxivdagi yozilish — hisob qayta hisoblanmaydi: Arxiv varag'idagi
   * "To'lashi kerak" chiqib ketgan kundagi yakuniy summa (admin uni qo'lda
   * tuzatgan bo'lishi ham mumkin). Bitta hisob-faktura bo'lib yoziladi.
   */
  kerakQatiy?: number
  // solishtiruv uchun — Sheets o'zi hisoblagan qiymatlar
  sheetKerak: number
  sheetTolangan: number
  sheetQarz: number
  sheetOylar: number
  /** Sheets'ning o'zi noto'g'ri hisoblagan bo'lsa — sababi. Farq shu bilan tushuntiriladi. */
  sheetsXato: string | null
}

type Hisob = {
  kalit: string
  davr: string
  /** Yakuniy (Sheets bilan solishtiriladi): narx − chegirma − tuzatish, VIP — 0 */
  summa: number
  chegirma: number
  tuzatish: number
  /**
   * Bazaga yoziladigan xom qiymat: narx − chegirma. VIP va tuzatishni bazaning
   * o'z triggerlari ayiradi (invoices_a_vip, invoices_tuzatish) — shunda
   * saytdagi "VIP" belgisi va "Tuzatishlar" ro'yxati ham to'g'ri ko'rinadi.
   */
  xomSumma: number
  xomChegirma: number
}

/** Tuzatishlar varag'idagi bitta qator (bazada `tuzatishlar` jadvali) */
type TuzatishQator = { sid: string; oy: number; summa: number; sabab: string }

type Tolov = {
  sheets_id: string | null      // Tolovlar ID — T0001
  student_id: string
  kalit: string | null
  sana: string
  davr: string
  summa: number
  usul: 'naqd' | 'karta' | 'click' | 'payme' | null
  izoh: string | null
  tasdiqlangan: boolean
  tasdiqlangan_vaqt: string | null
}

type Probniy = {
  sheets_id: string             // Probniylar ID — P001
  ism: string
  telefon: string
  tugilgan_sana: string | null
  subject_id: string | null
  group_id: string | null
  holat: 'yangi' | 'yozildi' | 'kelmadi' | 'rad'
  student_id: string | null
  izoh: string | null
  created_at: string | null
}

/* ------------------------------------------------------------------ */
/*  Yordamchilar                                                       */
/* ------------------------------------------------------------------ */

/**
 * "12.09.2026 14:30" yoki Sheets seriyasi (46276.6) → ISO, Toshkent vaqti.
 * Vaqti bo'lmasa kun boshi.
 */
function vaqtIso(v: unknown): string | null {
  const kun = sanaga(v)
  if (!kun) return null

  let soat = '00:00'
  if (typeof v === 'number') {
    const daqiqa = Math.round((v - Math.floor(v)) * 24 * 60)
    soat = `${String(Math.floor(daqiqa / 60)).padStart(2, '0')}:${String(daqiqa % 60).padStart(2, '0')}`
  } else {
    const m = String(v ?? '').match(/(\d{1,2}):(\d{2})/)
    if (m) soat = `${m[1].padStart(2, '0')}:${m[2]}`
  }
  return `${kun}T${soat}:00+05:00`   // Asia/Tashkent
}

function oquvchiHolati(v: string): 'faol' | 'tanaffus' | 'ketgan' {
  const s = v.toLowerCase()
  if (s.includes('tanaffus')) return 'tanaffus'
  if (/ketgan|chiqqan|to'?xtat/.test(s)) return 'ketgan'
  return 'faol'
}

/** "Necha oy" katagi: bo'sh — muddatsiz (null), 0 yoki manfiy — chegirma yo'q. */
function chegirmaOylari(q: Qator, ...nomlar: string[]): number | null {
  const xom = matn(q, ...nomlar)
  if (!xom) return null
  const n = pulga(xom)
  // "0" — Sheets'da chegirma yo'q (_oqD1); muddatsiz EMAS (05.10: S061, S069, S070)
  return n > 0 ? n : 0
}

/* ------------------------------------------------------------------ */
/*  1. Ustozlar, guruhlar, o'quvchilar                                  */
/* ------------------------------------------------------------------ */

function ustozlarniQur(qatorlar: Qator[]): Ustoz[] {
  const natija: Ustoz[] = []

  for (const q of qatorlar) {
    const ism = matn(q, "O'qituvchi", 'Ism')
    if (!ism || axlatmi(ism)) continue

    const id = matn(q, 'ID') || `U${String(natija.length + 1).padStart(2, '0')}`
    const tg = pulga(qiymat(q, 'Telegram ID'))

    natija.push({
      id,
      ism,
      telefon: telefonga(qiymat(q, 'Telefon')),
      telegram_id: tg > 0 ? tg : null,
      holat: /ishdan|bloklangan/i.test(matn(q, 'Holat')) ? 'bloklangan' : 'faol',
    })
  }
  return natija
}

function guruhlarniQur(qatorlar: Qator[], ustozlar: Ustoz[]): Guruh[] {
  const ustozId = new Map(ustozlar.map((u) => [u.ism.toLowerCase(), u.id]))
  const natija: Guruh[] = []

  for (const q of qatorlar) {
    const nom = matn(q, 'Guruh nomi')
    const yonalishXom = matn(q, "Yo'nalish")
    if (!nom || axlatmi(nom)) {
      if (nom) ogoh(`Guruh tashlandi (nomi tushunarsiz): "${nom}"`)
      continue
    }

    const id = matn(q, 'Guruh ID') || `G${String(natija.length + 1).padStart(2, '0')}`
    const ustozIsm = matn(q, "O'qituvchi")
    const teacher = ustozIsm ? (ustozId.get(ustozIsm.toLowerCase()) ?? null) : null
    if (ustozIsm && !teacher) ogoh(`Ustoz topilmadi: "${ustozIsm}" (guruh: ${nom})`)

    const vaqt = vaqtAjrat(qiymat(q, 'Dars vaqti'))
    if (!vaqt) ogoh(`Dars vaqti o'qilmadi: "${nom}" — [ANIQLANMAGAN]`)

    const kun = kunTuriga(qiymat(q, 'Kun'))
    if (!kun) ogoh(`Kun turi o'qilmadi: "${nom}" — [ANIQLANMAGAN]`)

    const narx = pulga(qiymat(q, 'Oylik narx'))
    if (narx <= 0) ogoh(`Guruh narxi yo'q: "${nom}" — [ANIQLANMAGAN]`)

    const subject = yonalishAniqla(yonalishXom)
    if (!subject) ogoh(`Yo'nalish tanilmadi: "${yonalishXom}" (guruh: ${nom})`)

    natija.push({
      id,
      nom,
      subject_id: subject,
      bosqich: subject === 'ingliz-tili' || subject === 'matematika' ? bosqichNormal(yonalishXom) : null,
      teacher_id: teacher,
      boshlanish: vaqt?.boshlanish ?? '00:00',
      tugash: vaqt?.tugash ?? '00:00',
      kun_turi: kun ?? 'toq',
      oylik_narx: narx,
      holat: /yopilgan|tugagan/i.test(matn(q, 'Holat')) ? 'yopilgan' : 'faol',
    })
  }
  return natija
}

function oquvchilarniQur(qatorlar: Qator[]): Oquvchi[] {
  const natija: Oquvchi[] = []
  const korilgan = new Set<string>()

  for (const q of qatorlar) {
    const fish = matn(q, 'Ism familya', 'F.I.Sh')
    if (axlatmi(fish)) {
      if (fish) ogoh(`O'quvchi tashlandi (axlat qator): "${fish}"`)
      continue
    }

    const id = matn(q, 'ID').toUpperCase()
    if (!/^S\d+$/.test(id)) {
      ogoh(`O'quvchi tashlandi (ID noto'g'ri): "${fish}" — "${id}"`)
      continue
    }
    if (korilgan.has(id)) {
      ogoh(`ID takrorlandi, tashlandi: ${id} — ${fish}`)
      continue
    }
    korilgan.add(id)

    natija.push({
      id,
      fish,
      tugilgan_sana: sanaga(qiymat(q, "Tug'ilgan sana")),
      ota_tel: telefonga(qiymat(q, 'Ota telefoni')),
      ona_tel: telefonga(qiymat(q, 'Ona telefoni')),
      shaxsiy_tel: telefonga(qiymat(q, 'Shaxsiy telefon')),
      qoshilgan_sana: sanaga(qiymat(q, "Qo'shilgan sana")) ?? '2026-09-01',
      holat: oquvchiHolati(matn(q, 'Holat')),
      izoh: matn(q, 'Izoh') || null,
      vip: /^vip$/i.test(matn(q, 'Holat')),
      arxiv_sana: null,
      arxiv_sabab: null,
    })
  }
  return natija
}

/**
 * Arxiv varag'idagi (chiqib ketgan) o'quvchilar. O'quvchilar varag'ida
 * qatori yo'q, lekin to'lovlari Tolovlar'da qolgan bo'lishi mumkin —
 * shuning uchun ular ham ko'chadi: holat "ketgan", yozilishi "tugagan".
 */
function arxivniQur(
  qatorlar: Qator[],
  guruhlar: Guruh[],
  bor: Set<string>,
): { oquvchilar: Oquvchi[]; yozilishlar: Yozilish[] } {
  const guruhId = new Map(guruhlar.map((g) => [g.nom, g.id]))
  const oquvchilar: Oquvchi[] = []
  const yozilishlar: Yozilish[] = []

  for (const q of qatorlar) {
    const id = matn(q, 'ID').toUpperCase()
    const fish = matn(q, 'Ism familya')
    if (!/^S\d+$/.test(id) || !fish) continue
    // "Qaytdi" — shu ID yana O'quvchilar varag'ida; arxiv qatori tarix bo'lib qoladi
    if (bor.has(id)) continue

    const boshlandi = sanaga(qiymat(q, 'Boshlandi'))
    const chiqdi = sanaga(qiymat(q, 'Chiqdi')) ?? sanaga(qiymat(q, "Arxivga o'tgan"))

    oquvchilar.push({
      id,
      fish,
      tugilgan_sana: sanaga(qiymat(q, "Tug'ilgan sana")),
      ota_tel: telefonga(qiymat(q, 'Ota telefoni')),
      ona_tel: telefonga(qiymat(q, 'Ona telefoni')),
      shaxsiy_tel: telefonga(qiymat(q, 'Shaxsiy telefon')),
      qoshilgan_sana: boshlandi ?? chiqdi ?? '2026-09-01',
      holat: 'ketgan',
      izoh: matn(q, 'Izoh') || null,
      vip: false,
      arxiv_sana: chiqdi ?? null,
      arxiv_sabab: matn(q, 'Sabab') || null,
    })

    const guruhNomi = matn(q, 'Guruh')
    if (!guruhNomi) continue               // guruhsiz kiritilgan (xato yozuv) — yozilish yo'q
    const gid = guruhId.get(guruhNomi)
    if (!gid) {
      ogoh(`Arxiv ${id}: guruh topilmadi — "${guruhNomi}" (${fish})`)
      continue
    }
    if (!boshlandi) {
      ogoh(`Arxiv ${id}: boshlanish sanasi yo'q — ${fish}`)
      continue
    }
    yozilishlar.push({
      kalit: `${id}|${gid}`,
      sheets_id: id,
      student_id: id,
      group_id: gid,
      guruhNomi,
      boshlandi,
      tugadi: chiqdi ?? boshlandi,
      chegirma_summa: 0, chegirma_oy: 0, chegirma2_summa: 0, chegirma2_oy: 0,
      chegirma_sabab: null,
      holat: 'tugagan',
      vip: false,
      qoldiq: 0,
      kerakQatiy: pulga(qiymat(q, "To'lashi kerak")),
      arxivVaqt: Number(qiymat(q, "Arxivga o'tgan")) || undefined,
      sheetKerak: pulga(qiymat(q, "To'lashi kerak")),
      sheetTolangan: pulga(qiymat(q, "To'langan")) + pulga(qiymat(q, "Arxivda to'langan")),
      sheetQarz: pulga(qiymat(q, 'Qarz')),
      sheetOylar: pulga(qiymat(q, 'Oylar')),
      sheetsXato: null,
    })
  }
  return { oquvchilar, yozilishlar }
}

/**
 * 29.09.2026 dan Qatnashuv varag'i yo'q: u O'quvchilar ichiga birlashgan.
 * Endi O'quvchilar'ning HAR QATORI = bitta bola × bitta fan, o'z ID'si bilan
 * (ikki fanga yozilgan bola — ikkita qator, ikkita ID). Yozilish shu qatorning
 * o'zidan olinadi; ID ham o'sha (S001) — qayta yurgizilsa yangilanadi.
 */
function yozilishlarOquvchilardan(
  qatorlar: Qator[],
  guruhlar: Guruh[],
  oquvchilar: Oquvchi[],
): Yozilish[] {
  const guruhId = new Map(guruhlar.map((g) => [g.nom, g.id]))
  const oquvchiBor = new Map(oquvchilar.map((o) => [o.id, o]))
  const natija: Yozilish[] = []

  for (const q of qatorlar) {
    const id = matn(q, 'ID').toUpperCase()
    const o = oquvchiBor.get(id)
    if (!o) continue
    const guruhNomi = matn(q, 'Guruh')
    if (!guruhNomi) {
      ogoh(`O'quvchilar ${q._qator}-qator: guruh yo'q — ${o.fish} (${id}), yozilishsiz ko'chadi`)
      continue
    }
    const gid = guruhId.get(guruhNomi)
    if (!gid) {
      toxtat(`O'quvchilar ${q._qator}-qator: guruh Guruhlar varag'ida yo'q — "${guruhNomi}" (${o.fish})`)
      continue
    }
    const boshlandiXom = qiymat(q, "Qo'shilgan sana")
    const boshlandi = sanaga(boshlandiXom)
    if (!boshlandi) {
      toxtat(`O'quvchilar ${q._qator}-qator: "Qo'shilgan sana" yo'q — ${o.fish} (${id})`)
      continue
    }
    const tugadi = sanaga(qiymat(q, 'Tugadi'))
    const cheg1 = pulga(qiymat(q, '1-chegirma'))
    const cheg2 = pulga(qiymat(q, '2-chegirma'))

    natija.push({
      kalit: `${id}|${gid}`,
      sheets_id: id,
      student_id: id,
      group_id: gid,
      guruhNomi,
      boshlandi,
      tugadi,
      chegirma_summa: cheg1,
      chegirma_oy: cheg1 > 0 ? chegirmaOylari(q, '1-necha oy') : 0,
      chegirma2_summa: cheg2,
      chegirma2_oy: cheg2 > 0 ? chegirmaOylari(q, '2-necha oy') : 0,
      chegirma_sabab: null,
      holat: tugadi ? 'tugagan' : 'faol',
      vip: o.vip,
      qoldiq: pulga(qiymat(q, 'Oldingi qoldiq')),
      sheetKerak: pulga(qiymat(q, "To'lashi kerak")),
      sheetTolangan: pulga(qiymat(q, "Jami to'langan")),
      sheetQarz: pulga(qiymat(q, 'Qarz')),
      sheetOylar: pulga(qiymat(q, 'Oylar')),
      sheetsXato: typeof boshlandiXom === 'string'
        ? `${id}: "Qo'shilgan sana" matn bo'lib kiritilgan ("${String(boshlandiXom)}")`
        : null,
    })
  }
  return natija
}

/**
 * Tuzatishlar varag'i — o'quvchining ma'lum OYIDAGI to'lovidan aniq summa
 * ayriladi (Y_Tuzatish.js). Kalit: O'quvchi ID → oy raqami → summa.
 */
function tuzatishlarniQur(qatorlar: Qator[]): { jami: Map<string, Map<number, number>>; royxat: TuzatishQator[] } {
  const natija = new Map<string, Map<number, number>>()
  const royxat: TuzatishQator[] = []
  for (const q of qatorlar) {
    const summa = pulga(qiymat(q, 'Summa (−)', 'Summa (-)', 'Summa'))
    if (summa <= 0) continue
    const { id } = kalitAjrat(qiymat(q, "O'quvchi · guruh", "O'quvchi"))
    const sid = (matn(q, "O'quvchi ID") || id || '').toUpperCase()
    const oy = oyRaqami(qiymat(q, 'Oy'))
    if (!sid || oy <= 0) {
      toxtat(`Tuzatish ${q._qator}-qator: o'quvchi yoki oy o'qilmadi (${summa})`)
      continue
    }
    const oylar = natija.get(sid) ?? new Map<number, number>()
    oylar.set(oy, (oylar.get(oy) ?? 0) + summa)
    natija.set(sid, oylar)
    royxat.push({ sid, oy, summa, sabab: `Sheets: ${matn(q, 'Sabab') || 'tuzatish'}` })
  }
  return { jami: natija, royxat }
}

/* ------------------------------------------------------------------ */
/*  2. Qatnashuv → yozilish + hisob-faktura                            */
/* ------------------------------------------------------------------ */

function yozilishlarniQur(
  qatorlar: Qator[],
  guruhlar: Guruh[],
  oquvchilar: Oquvchi[],
): Yozilish[] {
  const guruhId = new Map(guruhlar.map((g) => [g.nom, g.id]))
  const oquvchiBor = new Set(oquvchilar.map((o) => o.id))
  const natija: Yozilish[] = []

  for (const q of qatorlar) {
    const { fish, id } = kalitAjrat(qiymat(q, "O'quvchi"))
    const guruhNomi = matn(q, 'Guruh')

    if (!id || !oquvchiBor.has(id)) {
      ogoh(`Qatnashuv ${q._qator}-qator: o'quvchi topilmadi — "${fish}"`)
      continue
    }
    const gid = guruhId.get(guruhNomi)
    if (!gid) {
      ogoh(`Qatnashuv ${q._qator}-qator: guruh topilmadi — "${guruhNomi}" (${fish})`)
      continue
    }

    const boshlandiXom = qiymat(q, 'Boshlandi')
    const boshlandi = sanaga(boshlandiXom)
    if (!boshlandi) {
      ogoh(`Qatnashuv ${q._qator}-qator: boshlanish sanasi yo'q — ${fish} · ${guruhNomi}`)
      continue
    }
    const tugadi = sanaga(qiymat(q, 'Tugadi'))

    const cheg1 = pulga(qiymat(q, '1-chegirma'))
    const cheg2 = pulga(qiymat(q, '2-chegirma'))

    const sheetsId = matn(q, 'ID').toUpperCase() || null
    if (!sheetsId) toxtat(`Qatnashuv ${q._qator}-qator: ID yo'q — ${fish} · ${guruhNomi}`)

    // Sana katakka matn bo'lib yozilsa (masalan "16.09.2026 "), Sheets
    // formulasi DATEDIF'da #VALUE! beradi va hisob chiqmaydi. Biz sanani
    // o'qiy olamiz — farq Sheets xatosi deb belgilanadi.
    const sanaMatn = typeof boshlandiXom === 'string'

    natija.push({
      kalit: `${id}|${gid}`,
      sheets_id: sheetsId,
      student_id: id,
      group_id: gid,
      guruhNomi,
      boshlandi,
      tugadi,
      chegirma_summa: cheg1,
      chegirma_oy: cheg1 > 0 ? chegirmaOylari(q, '1-necha oy') : 0,
      chegirma2_summa: cheg2,
      chegirma2_oy: cheg2 > 0 ? chegirmaOylari(q, '2-necha oy') : 0,
      chegirma_sabab: matn(q, 'Izoh') || null,
      holat: tugadi ? 'tugagan' : 'faol',
      vip: false,
      qoldiq: 0,
      sheetKerak: pulga(qiymat(q, "To'lashi kerak")),
      sheetTolangan: pulga(qiymat(q, "To'langan")),
      sheetQarz: pulga(qiymat(q, 'Qarz')),
      sheetOylar: pulga(qiymat(q, 'Oylar')),
      sheetsXato: sanaMatn
        ? `${sheetsId ?? q._qator + '-qator'}: "Boshlandi" sanasi matn bo'lib kiritilgan ("${String(boshlandiXom)}") — Sheets hisoblay olmagan`
        : null,
    })
  }
  return takrorlarniBirlashtir(natija)
}

/**
 * Bir o'quvchi bir guruhga ikki marta yozilgan bo'lsa.
 *
 * Davrlari ustma-ust tushsa — bu kiritishdagi xato (bir odam bir vaqtda
 * bir guruhda ikki marta o'qimaydi), Sheets esa ikkala qator uchun ham
 * hisob chiqaradi. Bazaga bitta yozilish ketadi: eng erta boshlangani,
 * tugash sanasi — ochiq bo'lsa ochiq, aks holda eng kechi.
 *
 * Davrlari ustma-ust tushmasa (tugatib, keyin qaytib kelgan) — bu haqiqiy
 * holat, lekin to'lovni qaysi biriga bog'lashni taxmin qilib bo'lmaydi.
 * Bunday juftlik tushuntirilmagan farq bo'lib qoladi va yozishni to'xtatadi.
 */
function takrorlarniBirlashtir(yozilishlar: Yozilish[]): Yozilish[] {
  const kalitBoyicha = new Map<string, Yozilish[]>()
  for (const y of yozilishlar) {
    kalitBoyicha.set(y.kalit, [...(kalitBoyicha.get(y.kalit) ?? []), y])
  }

  const natija: Yozilish[] = []
  for (const guruh of kalitBoyicha.values()) {
    if (guruh.length === 1) {
      natija.push(guruh[0])
      continue
    }

    const tartib = [...guruh].sort((a, b) => a.boshlandi.localeCompare(b.boshlandi))
    const ustma = tartib.every((y, i) => {
      const oldingi = tartib[i - 1]
      return i === 0 || !oldingi.tugadi || oldingi.tugadi >= y.boshlandi
    })
    const idlar = tartib.map((y) => y.sheets_id ?? '?').join(', ')

    if (!ustma) {
      toxtat(`Qayta yozilish (${idlar}) — ${tartib[0].student_id} · ${tartib[0].guruhNomi}: to'lovni qaysi biriga bog'lash noma'lum`)
      natija.push(...tartib)
      continue
    }

    const [asosiy, ...qolgan] = tartib
    const ochiq = tartib.some((y) => !y.tugadi)
    const farqliChegirma = qolgan.some(
      (y) => y.chegirma_summa !== asosiy.chegirma_summa || y.chegirma2_summa !== asosiy.chegirma2_summa,
    )
    if (farqliChegirma) {
      ogoh(`${idlar}: chegirmalari farq qiladi — ${asosiy.sheets_id} dagi olindi`)
    }

    natija.push({
      ...asosiy,
      tugadi: ochiq ? null : tartib.map((y) => y.tugadi!).sort().at(-1)!,
      holat: ochiq ? 'faol' : 'tugagan',
      // Sheets ustunlarining jami o'zgarmasin — solishtiruvda haqiqiy
      // Sheets raqami ko'rinsin (u yerda bitta to'lov ikkala qatorda sanalgan).
      sheetKerak: tartib.reduce((a, y) => a + y.sheetKerak, 0),
      sheetTolangan: tartib.reduce((a, y) => a + y.sheetTolangan, 0),
      sheetQarz: tartib.reduce((a, y) => a + y.sheetQarz, 0),
      sheetsXato:
        `${idlar}: bir guruhga ikki marta yozilgan (ustma-ust davr) — ` +
        `Sheets ikki barobar hisoblaydi, bazaga bitta yozildi (${asosiy.sheets_id})`,
    })
  }
  return natija
}

/**
 * Har yozilish uchun oy-oy hisob-faktura.
 * Formulaning o'zi: oylar boshlanish oyidan boshlab ketma-ket sanaladi,
 * har oyning narxi Narxlar tarixidan, chegirma esa o'sha oyning
 * BOSQICHIDAN olinadi.
 */
function hisoblarniQur(
  yozilishlar: Yozilish[],
  guruhlar: Guruh[],
  tarix: Map<string, NarxQator[]>,
  tuzatishlar: Map<string, Map<number, number>> = new Map(),
  bugun = new Date(),
): Hisob[] {
  const guruhNarxi = new Map(guruhlar.map((g) => [g.id, g.oylik_narx]))
  const natija: Hisob[] = []

  for (const y of yozilishlar) {
    if (y.kerakQatiy !== undefined) {
      if (y.kerakQatiy > 0) {
        /* Arxiv "To'lashi kerak" tuzatishi AYIRILGAN summa; bazada invoices_tuzatish
           shu oy tuzatishini yana ayiradi — xom summaga qaytarib qo'shiladi (05.10) */
        const tuz = tuzatishlar.get(y.sheets_id ?? y.student_id)?.get(oyRaqami(y.boshlandi.slice(0, 7))) ?? 0
        natija.push({
          kalit: y.kalit, davr: y.boshlandi.slice(0, 7), summa: y.kerakQatiy, chegirma: 0, tuzatish: tuz,
          xomSumma: y.kerakQatiy + tuz, xomChegirma: 0,
        })
      }
      continue
    }
    const oylar = oylarSoni(y.boshlandi, y.tugadi, bugun)
    if (oylar <= 0) continue
    if (y.sheetOylar > 0 && y.sheetOylar !== oylar) {
      ogoh(
        `Oylar soni farq qiladi: ${y.student_id} · ${y.guruhNomi} — ` +
          `Sheets ${y.sheetOylar}, hisoblangan ${oylar}`,
      )
    }

    const boshOy = oyRaqami(y.boshlandi.slice(0, 7))
    const zaxira = guruhNarxi.get(y.group_id) ?? 0

    for (let i = 1; i <= oylar; i++) {
      const oy = boshOy + i - 1
      const narx = narxOyda(tarix.get(y.guruhNomi), oy, zaxira)
      const chegirma = chegirmaOyda(
        i,
        { summa: y.chegirma_summa, oylar: y.chegirma_oy },
        { summa: y.chegirma2_summa, oylar: y.chegirma2_oy },
      )
      /* VIP — to'lamaydi: hisob 0 (Sheets T = 0). Tuzatish — shu oyning
         summasidan aniq ayriladi; Sheets uni chegaralamaydi, shuning uchun
         bu yerda ham manfiyga tushsa ogohlantiriladi. */
      // Tuzatish Sheets qatori (= yozilish) ID'si bo'yicha — 2 fanli bolada ham to'g'ri fanga
      const tuz = tuzatishlar.get(y.sheets_id ?? y.student_id)?.get(oy) ?? 0
      const toza = narx - chegirma - tuz
      if (!y.vip && toza < 0) {
        ogoh(`${y.student_id} · ${davrdan(oy)}: chegirma + tuzatish (${chegirma + tuz}) narxdan (${narx}) katta`)
      }
      natija.push({
        kalit: y.kalit,
        davr: davrdan(oy),
        summa: y.vip ? 0 : toza,
        chegirma: y.vip ? narx : chegirma,
        tuzatish: y.vip ? 0 : tuz,
        xomSumma: narx - chegirma,
        xomChegirma: chegirma,
      })
    }

    /* Arxivdan qaytgan: eski davr "Oldingi qoldiq" — yangi davrdan oldingi oyga
       bitta hisob-faktura. Qoldiq TUZATISHSIZ (Y_Arxiv.js); eski oylar tuzatishini
       Sheets ayiradi — bazada esa invoices_tuzatish faqat shu oynikini ayiradi. */
    if (y.qoldiq !== 0) {
      const oy = boshOy - 1
      const eskiTuz = [...(tuzatishlar.get(y.sheets_id ?? y.student_id) ?? new Map<number, number>())]
        .filter(([m]) => m < boshOy)
      if (y.qoldiq < 0) {
        toxtat(`${y.sheets_id}: "Oldingi qoldiq" manfiy (${pul(y.qoldiq)}) — ortiqcha to'lov, bazaga yozish qilinmagan`)
      } else if (eskiTuz.some(([m]) => m !== oy)) {
        toxtat(`${y.sheets_id}: eski davr tuzatishi ${davrdan(oy)} dan boshqa oyda — "Oldingi qoldiq" bilan mos kelmaydi`)
      } else {
        const tuz = eskiTuz.reduce((a, [, v]) => a + v, 0)
        natija.push({
          kalit: y.kalit, davr: davrdan(oy), summa: y.qoldiq - tuz, chegirma: 0, tuzatish: tuz,
          xomSumma: y.qoldiq, xomChegirma: 0,
        })
      }
    }
  }
  return natija
}

/* ------------------------------------------------------------------ */
/*  3. To'lovlar                                                       */
/* ------------------------------------------------------------------ */

function tolovlarniQur(
  qatorlar: Qator[],
  guruhlar: Guruh[],
  oquvchilar: Oquvchi[],
  yozilishKaliti: Map<string, string> = new Map(),
): Tolov[] {
  const guruhId = new Map(guruhlar.map((g) => [g.nom, g.id]))
  const oquvchiBor = new Set(oquvchilar.map((o) => o.id))
  const natija: Tolov[] = []

  for (const q of qatorlar) {
    const summa = pulga(qiymat(q, 'Summa'))
    if (summa <= 0) continue

    const { fish, id, guruh } = kalitAjrat(qiymat(q, "O'quvchi"))
    const sid = id ?? matn(q, "O'quvchi ID").toUpperCase()
    if (!sid || !oquvchiBor.has(sid)) {
      ogoh(`To'lov ${q._qator}-qator: o'quvchi topilmadi — "${fish}" (${summa})`)
      continue
    }

    const gid = guruh ? guruhId.get(guruh) : undefined
    if (guruh && !gid) {
      ogoh(`To'lov ${q._qator}-qator: guruh topilmadi — "${guruh}" (${fish})`)
    }

    const sana = sanaga(qiymat(q, 'Sana'))
    const davr = davrga(qiymat(q, 'Davr')) ?? (sana ? sana.slice(0, 7) : null)
    if (!sana || !davr) {
      ogoh(`To'lov ${q._qator}-qator: sana yoki davr yo'q — ${fish} (${summa})`)
      continue
    }

    const usul = usulga(qiymat(q, 'Usul'))
    if (!usul) ogoh(`To'lov ${q._qator}-qator: usul manbada yo'q — ${fish} (${summa}) [ANIQLANMAGAN]`)

    const tasdiqlangan = belgi(q, 'Tasdiq')

    // ID'siz to'lovni qayta ko'chirishda ikkilanmasligini kafolatlab bo'lmaydi
    const sheetsId = matn(q, 'ID').toUpperCase() || null
    if (!sheetsId) toxtat(`To'lov ${q._qator}-qator: ID yo'q — ${fish} (${summa})`)

    natija.push({
      sheets_id: sheetsId,
      student_id: sid,
      // Yangi tuzilma: o'quvchi ID = bitta fan, to'lov shu yozilishga tegishli
      // (kalitdagi guruh nomi eskirgan bo'lsa ham).
      kalit: yozilishKaliti.get(sid) ?? (gid ? `${sid}|${gid}` : null),
      sana,
      davr,
      summa,
      usul,
      izoh: matn(q, 'Izoh') || null,
      tasdiqlangan,
      tasdiqlangan_vaqt: tasdiqlangan ? vaqtIso(qiymat(q, 'Tasdiqlangan')) : null,
    })
  }
  return natija
}

/* ------------------------------------------------------------------ */
/*  3a. Probniylar → leads                                             */
/* ------------------------------------------------------------------ */

/** Botdagi holatlar (Y_Probniy.js: PROB_HOLAT) → lead_status. */
const PROBNIY_HOLAT: Record<string, Probniy['holat']> = {
  probniy: 'yangi',
  doimiy: 'yozildi',
  kelmadi: 'kelmadi',
  'rad etdi': 'rad',
}

function probniylarniQur(qatorlar: Qator[], guruhlar: Guruh[], oquvchilar: Oquvchi[]): Probniy[] {
  const guruhId = new Map(guruhlar.map((g) => [g.nom, g.id]))
  const natija: Probniy[] = []

  for (const q of qatorlar) {
    const ism = matn(q, 'F.I.Sh')
    if (!ism || axlatmi(ism)) continue

    const sheetsId = matn(q, 'ID').toUpperCase()
    if (!sheetsId) {
      toxtat(`Probniy ${q._qator}-qator: ID yo'q — ${ism}`)
      continue
    }

    const telefon =
      telefonga(qiymat(q, 'Shaxsiy telefon')) ??
      telefonga(qiymat(q, 'Ota telefoni')) ??
      telefonga(qiymat(q, 'Ona telefoni'))
    if (!telefon) {
      ogoh(`Probniy ${sheetsId}: telefon yo'q — ${ism}, ko'chirilmadi`)
      continue
    }

    const holatXom = matn(q, 'Holat').toLowerCase()
    const holat = PROBNIY_HOLAT[holatXom]
    if (!holat) ogoh(`Probniy ${sheetsId}: holat tanilmadi "${matn(q, 'Holat')}" — "Kutilmoqda" deb olindi`)

    const guruhNomi = matn(q, 'Guruh')
    const group = guruhNomi ? (guruhId.get(guruhNomi) ?? null) : null
    if (guruhNomi && !group) ogoh(`Probniy ${sheetsId}: guruh topilmadi — "${guruhNomi}"`)

    // Doimiy bo'lgan probniy O'quvchilarga ko'chgan. Bot ham ismni AYNAN
    // solishtiradi (Y_Probniy.js: PROB_TUZAT) — biz ham shunday qilamiz.
    let student: string | null = null
    if (holat === 'yozildi') {
      const moslar = oquvchilar.filter((o) => o.fish === ism)
      if (moslar.length === 1) student = moslar[0].id
      else ogoh(`Probniy ${sheetsId} (${ism}): O'quvchilarda ${moslar.length} ta aynan mos — bog'lanmadi`)
    }

    natija.push({
      sheets_id: sheetsId,
      ism,
      telefon,
      tugilgan_sana: sanaga(qiymat(q, "Tug'ilgan sana")),
      subject_id: yonalishAniqla(matn(q, "Yo'nalish")),
      group_id: group,
      holat: holat ?? 'yangi',
      student_id: student,
      izoh: matn(q, 'Izoh') || null,
      created_at: vaqtIso(qiymat(q, "Qo'shilgan")),
    })
  }
  return natija
}

/* ------------------------------------------------------------------ */
/*  3b. Davomat jurnallari                                             */
/* ------------------------------------------------------------------ */

const JURNAL_VARAQLAR = ['Davomat toq', 'Davomat juft', 'Davomat dam olish']

function davomatniQur(
  kitob: Map<string, ReturnType<typeof varaq>>,
  guruhlar: Guruh[],
  oquvchilar: Oquvchi[],
): JurnalNatija {
  const varaqlar: [string, unknown[][]][] = []
  for (const nom of JURNAL_VARAQLAR) {
    const v = varaqBormi(kitob, nom)
    if (v) varaqlar.push([v.nom, v.xom])
    else ogoh(`Jurnal varag'i topilmadi: "${nom}"`)
  }

  return jurnallarniOqi(varaqlar, {
    guruhId: new Map(guruhlar.map((g) => [g.nom, g.id])),
    oquvchiBor: new Set(oquvchilar.map((o) => o.id)),
    ogoh,
  })
}

/* ------------------------------------------------------------------ */
/*  3c. 2 fanli bola — bitta o'quvchi                                   */
/* ------------------------------------------------------------------ */

const ismKalit = (s: string) =>
  s.toLowerCase().replace(/[‘’ʻʼ`']/g, '').replace(/\s+/g, ' ').trim()

/**
 * Bir bolaning qatorlari: ism AYNAN bir xil va kamida bitta telefon umumiy
 * (qaysi ustunda yozilganidan qat'i nazar). Telefoni yo'q yoki umumiy
 * telefoni yo'q qator birlashmaydi (taxmin qilinmaydi) — alohida o'quvchi.
 * Asosiy ID — eng kichigi. Qaytadi: qo'shimcha ID → asosiy ID.
 *
 * `oquvchilar` va `yozilishlar` JOYIDA o'zgaradi: qo'shimcha o'quvchi
 * yozuvi olib tashlanadi, uning yozilishi asosiy ID'ga o'tadi.
 */
function bolalarniBirlashtir(oquvchilar: Oquvchi[], yozilishlar: Yozilish[]): Map<string, string> {
  const raqam = (id: string) => Number(id.replace(/\D/g, ''))
  const tel = (o: Oquvchi) => new Set([o.ota_tel, o.ona_tel, o.shaxsiy_tel].filter((t): t is string => Boolean(t)))
  const ismBoyicha = new Map<string, Oquvchi[]>()
  for (const o of oquvchilar) {
    if (o.holat === 'ketgan') continue
    const k = ismKalit(o.fish)
    ismBoyicha.set(k, [...(ismBoyicha.get(k) ?? []), o])
  }
  // Bir ism ichida: umumiy telefon bo'yicha bog'langan to'plamlar
  const guruhlar: Oquvchi[][] = []
  for (const bir of ismBoyicha.values()) {
    const qolgan = [...bir]
    while (qolgan.length) {
      const toplam = [qolgan.shift()!]
      const tellar = tel(toplam[0])
      for (let o = true; o; ) {
        o = false
        for (let i = qolgan.length - 1; i >= 0; i--) {
          if ([...tel(qolgan[i])].some((t) => tellar.has(t))) {
            tel(qolgan[i]).forEach((t) => tellar.add(t))
            toplam.push(...qolgan.splice(i, 1))
            o = true
          }
        }
      }
      guruhlar.push(toplam)
    }
  }

  const xarita = new Map<string, string>()
  for (const g of guruhlar) {
    if (g.length < 2) continue
    const [asosiy, ...qolgan] = [...g].sort((a, b) => raqam(a.id) - raqam(b.id))
    for (const o of qolgan) xarita.set(o.id, asosiy.id)
    // VIP — yozilishda (fan bo'yicha); o'quvchi yozuvida emas
    if (qolgan.some((o) => o.izoh && o.izoh !== asosiy.izoh)) {
      asosiy.izoh = [asosiy.izoh, ...qolgan.map((o) => o.izoh)].filter(Boolean).join(' · ')
    }
  }
  if (!xarita.size) return xarita

  for (let i = oquvchilar.length - 1; i >= 0; i--) {
    if (xarita.has(oquvchilar[i].id)) oquvchilar.splice(i, 1)
  }
  const band = new Set<string>()
  for (const y of yozilishlar) {
    const asosiy = xarita.get(y.student_id)
    if (asosiy) {
      y.student_id = asosiy
      y.kalit = `${asosiy}|${y.group_id}`
    }
    if (band.has(y.kalit)) toxtat(`${y.sheets_id}: bitta bola bitta guruhga ikki qatorda — ${y.guruhNomi}`)
    band.add(y.kalit)
  }
  return xarita
}

/* ------------------------------------------------------------------ */
/*  4. Hammasini yig'ish                                               */
/* ------------------------------------------------------------------ */

function malumotniQur(kitob: Map<string, ReturnType<typeof varaq>>) {
  const ustozlar = ustozlarniQur(varaq(kitob, 'Ustozlar').qatorlar)
  const guruhlar = guruhlarniQur(varaq(kitob, 'Guruhlar').qatorlar, ustozlar)
  const oquvVaraq = varaq(kitob, "O'quvchilar")
  const oquvchilar = oquvchilarniQur(oquvVaraq.qatorlar)

  /* 29.09.2026 dan Qatnashuv yo'q — yozilish O'quvchilar qatorining o'zi.
     Eski jadval (Qatnashuv bor) ham ishlayveradi. */
  const qatnVaraq = varaqBormi(kitob, 'Qatnashuv')
  const yangiTuzilma = !qatnVaraq
  const yozilishlar = qatnVaraq
    ? yozilishlarniQur(qatnVaraq.qatorlar, guruhlar, oquvchilar)
    : yozilishlarOquvchilardan(oquvVaraq.qatorlar, guruhlar, oquvchilar)

  const arxivVaraq = yangiTuzilma ? varaqBormi(kitob, 'Arxiv') : null
  if (arxivVaraq) {
    const a = arxivniQur(arxivVaraq.qatorlar, guruhlar, new Set(oquvchilar.map((o) => o.id)))
    oquvchilar.push(...a.oquvchilar)
    yozilishlar.push(...a.yozilishlar)
  }

  const tuzVaraq = yangiTuzilma ? varaqBormi(kitob, 'Tuzatishlar') : null
  const tuz = tuzVaraq ? tuzatishlarniQur(tuzVaraq.qatorlar) : { jami: new Map<string, Map<number, number>>(), royxat: [] as TuzatishQator[] }
  const tuzatishlar = tuz.jami

  /* 2 fanli bola Sheets'da 2 qator, 2 ID. Saytda — bitta o'quvchi (bitta login),
     ikkita yozilish (Jamshid, 01.10). Qator ID'si yozilish ID'si bo'lib qoladi. */
  const birlash = yangiTuzilma ? bolalarniBirlashtir(oquvchilar, yozilishlar) : new Map<string, string>()
  const asosiyId = (id: string) => birlash.get(id) ?? id

  const narxVaraq = varaqBormi(kitob, 'Narxlar')
  const tarix = narxTarixi(
    (narxVaraq?.qatorlar ?? []).map((q) => ({
      guruh: matn(q, 'Guruh'),
      narx: pulga(qiymat(q, 'Narx')),
      oydan: qiymat(q, 'Qaysi oydan'),
    })),
  )
  if (!narxVaraq || tarix.size === 0) {
    ogoh("Narxlar varag'i bo'sh — har oy guruhning joriy narxidan hisoblanadi.")
  }

  const hisoblar = hisoblarniQur(yozilishlar, guruhlar, tarix, tuzatishlar)
  const tolovlar = tolovlarniQur(
    varaq(kitob, 'Tolovlar').qatorlar,
    guruhlar,
    [...oquvchilar, ...[...birlash.keys()].map((id) => ({ id }) as Oquvchi)],
    yangiTuzilma ? new Map(yozilishlar.map((y) => [y.sheets_id ?? y.student_id, y.kalit])) : new Map(),
  ).map((t) => ({ ...t, student_id: asosiyId(t.student_id) }))

  /* Arxivga o'tgandan keyingi to'lovlar — alohida jurnalda (_Arxiv_tolovlar) */
  const arxTolVaraq = yangiTuzilma ? varaqBormi(kitob, '_Arxiv_tolovlar') : null
  const arxivTolovlari = (arxTolVaraq?.qatorlar ?? [])
    .map((q) => ({
      qator: q._qator,
      id: matn(q, 'ID').toUpperCase(),
      summa: pulga(qiymat(q, 'Summa')),
      sana: sanaga(qiymat(q, 'Sana')),
      davr: davrga(qiymat(q, 'Davr')),
      usul: usulga(qiymat(q, 'Usul')),
      vaqt: Number(qiymat(q, "Arxivga o'tgan")) || 0,
    }))
    .filter((x) => x.id && x.summa > 0)

  const probVaraq = varaqBormi(kitob, 'Probniylar')
  const probniylar = probVaraq ? probniylarniQur(probVaraq.qatorlar, guruhlar, oquvchilar) : []

  const davomatXom = DAVOMAT
    ? davomatniQur(kitob, guruhlar, [...oquvchilar, ...[...birlash.keys()].map((id) => ({ id }) as Oquvchi)])
    : { darslar: [] as Dars[], belgilar: [] as Davomat[] }
  const davomat = {
    darslar: davomatXom.darslar,
    belgilar: davomatXom.belgilar.map((b) => ({ ...b, student_id: asosiyId(b.student_id) })),
  }

  const tuzatishRoyxat = tuz.royxat.map((t) => ({ ...t, kalit: yozilishlar.find((y) => y.sheets_id === t.sid)?.kalit ?? null }))
  for (const t of tuzatishRoyxat) {
    if (!t.kalit) toxtat(`Tuzatish: ${t.sid} uchun yozilish topilmadi (${t.summa})`)
  }

  /* Arxiv to'lovlari: faqat HOZIR arxivdagi qatorning sessiyasiga tegishlisi
     (Arxiv O ustuni: SUMIFS ... F = W). Qaytganniki "Oldingi qoldiq" ichida. */
  const vaqtKalit = (v: number) => Math.round(v * 86400)
  for (const x of arxivTolovlari) {
    const y = yozilishlar.find((z) => z.sheets_id === x.id && z.kerakQatiy !== undefined)
    if (!y || !y.arxivVaqt || !x.vaqt || vaqtKalit(y.arxivVaqt) !== vaqtKalit(x.vaqt)) {
      ogoh(`_Arxiv_tolovlar ${x.qator}-qator: ${x.id} ${pul(x.summa)} — hozirgi arxiv sessiyasiga tegishli emas (qaytgan bo'lsa "Oldingi qoldiq" ichida)`)
      continue
    }
    if (!x.sana) {
      toxtat(`_Arxiv_tolovlar ${x.qator}-qator: sana yo'q — ${x.id} (${x.summa})`)
      continue
    }
    tolovlar.push({
      sheets_id: `AT${String(x.qator).padStart(4, '0')}`,
      student_id: y.student_id,
      kalit: y.kalit,
      sana: x.sana,
      davr: x.davr ?? x.sana.slice(0, 7),
      summa: x.summa,
      usul: x.usul,
      izoh: "Arxivdagi qarz to'lovi (Sheets _Arxiv_tolovlar)",
      tasdiqlangan: false,
      tasdiqlangan_vaqt: null,
    })
  }

  return {
    ustozlar, guruhlar, oquvchilar, yozilishlar, hisoblar, tolovlar, probniylar, davomat,
    tuzatishlar, tuzatishRoyxat, arxivTolovlari, yangiTuzilma, birlash,
    davomatGacha: DAVOMAT_GACHA,
  }
}

type Tayyor = ReturnType<typeof malumotniQur>

/* ------------------------------------------------------------------ */
/*  5. Solishtiruv — hisob Sheets bilan mos keladimi                    */
/* ------------------------------------------------------------------ */

function solishtir(d: Tayyor) {
  const hisobJami = new Map<string, number>()
  for (const h of d.hisoblar) {
    hisobJami.set(h.kalit, (hisobJami.get(h.kalit) ?? 0) + h.summa)
  }

  const tolovJami = new Map<string, number>()
  for (const t of d.tolovlar) {
    if (!t.kalit) continue
    tolovJami.set(t.kalit, (tolovJami.get(t.kalit) ?? 0) + t.summa)
  }

  const farqlar: string[] = []
  const tushuntirilgan: string[] = []
  let jamiKerak = 0, jamiKerakSheets = 0
  let jamiTolangan = 0, jamiTolanganSheets = 0

  for (const y of d.yozilishlar) {
    const kerak = hisobJami.get(y.kalit) ?? 0   // "Oldingi qoldiq" — hisob-faktura ichida
    const tolangan = tolovJami.get(y.kalit) ?? 0

    jamiKerak += kerak
    jamiKerakSheets += y.sheetKerak
    jamiTolangan += tolangan
    jamiTolanganSheets += y.sheetTolangan

    if (kerak !== y.sheetKerak || tolangan !== y.sheetTolangan) {
      const matn =
        `${y.student_id} · ${y.guruhNomi}: kerak ${pul(kerak)} (Sheets ${pul(y.sheetKerak)}) · ` +
        `to'langan ${pul(tolangan)} (Sheets ${pul(y.sheetTolangan)})`
      if (y.sheetsXato) tushuntirilgan.push(`${matn}\n       sabab: ${y.sheetsXato}`)
      else farqlar.push(matn)
    }
  }

  return {
    farqlar,
    tushuntirilgan,
    jamiKerak, jamiKerakSheets,
    jamiTolangan, jamiTolanganSheets,
    qarz: jamiKerak - jamiTolangan,
    qarzSheets: d.yozilishlar.reduce((a, y) => a + y.sheetQarz, 0),
  }
}

const pul = (n: number) => n.toLocaleString('uz-UZ')

/* ------------------------------------------------------------------ */
/*  6. Bazaga yozish                                                   */
/* ------------------------------------------------------------------ */

/**
 * Sheets — haqiqat (Jamshid, 01.10). Baza Sheets'ga TENGLASHTIRILADI:
 *
 *   · bor yozuv yangilanadi, yo'g'i qo'shiladi;
 *   · Sheets'da yo'q eski yozilish o'chiriladi (hisob-fakturasi bilan);
 *   · Sheets'da yo'q eski to'lov o'chirilmaydi — `bekor` qilinadi (qoida 3);
 *   · Sheets'da yo'q o'quvchi (va uning logini) o'chiriladi; o'chirib
 *     bo'lmasa (to'lovi bor) — arxivga o'tadi;
 *   · ID'si boshqa bolaga o'tgan o'quvchining profil ismi yangilanadi
 *     (login raqam — 10001…, ismga bog'liq emas).
 *
 * `quruq = true` — prod'dan faqat o'qiydi va REJAni chiqaradi, hech narsa yozmaydi.
 */
async function yoz(d: Tayyor, quruq: boolean) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase kalitlari topilmadi (.env.local)')

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const xato = (nom: string, e: { message: string } | null) => {
    if (e) throw new Error(`${nom}: ${e.message}`)
  }
  /** 1000 qatordan ko'p bo'lsa ham hammasini o'qiydi */
  async function hammasi<T>(jadval: string, ustunlar: string): Promise<T[]> {
    const natija: T[] = []
    for (let dan = 0; ; dan += 1000) {
      const { data, error } = await db.from(jadval).select(ustunlar).range(dan, dan + 999)
      xato(jadval, error)
      natija.push(...((data ?? []) as T[]))
      if (!data || data.length < 1000) return natija
    }
  }
  /** Ko'p ID bo'yicha amal — bo'laklab (URL uzun bo'lib ketmasin) */
  async function bolaklab<T>(royxat: T[], amal: (b: T[]) => Promise<void>, hajm = 200) {
    for (let i = 0; i < royxat.length; i += hajm) await amal(royxat.slice(i, i + hajm))
  }

  /* ── 1. Prod holati ── */
  type PS = { id: string; fish: string; profile_id: string | null; holat: string }
  type PE = { id: string; sheets_id: string | null; student_id: string; group_id: string; holat: string }
  type PP = { id: number; sheets_id: string | null; student_id: string; manba: string; bekor: boolean; summa: number }
  const [pOquvchi, pYozilish, pTolov, pGuruh] = await Promise.all([
    hammasi<PS>('students', 'id, fish, profile_id, holat'),
    hammasi<PE>('enrollments', 'id, sheets_id, student_id, group_id, holat'),
    hammasi<PP>('payments', 'id, sheets_id, student_id, manba, bekor, summa'),
    hammasi<{ id: string; nom: string }>('groups', 'id, nom'),
  ])

  /* ── 2. Reja ── */
  const yangiOquvchi = new Map(d.oquvchilar.map((o) => [o.id, o]))
  const ismOzgardi = pOquvchi
    .filter((p) => yangiOquvchi.has(p.id) && ismKalit(p.fish) !== ismKalit(yangiOquvchi.get(p.id)!.fish))
    .map((p) => ({ id: p.id, profile_id: p.profile_id, eski: p.fish, yangi: yangiOquvchi.get(p.id)!.fish }))

  const yangiTolovId = new Set(d.tolovlar.map((t) => t.sheets_id).filter(Boolean) as string[])
  const tolovBekor = pTolov.filter((p) => p.manba === 'sheets' && !p.bekor && p.sheets_id && !yangiTolovId.has(p.sheets_id))
  const idsizTolov = pTolov.filter((p) => p.manba === 'sheets' && !p.sheets_id).length
  if (idsizTolov > 0) {
    throw new Error(`Bazada ID'siz ${idsizTolov} ta Sheets to'lovi bor — qaysi biri qaysi ekanini bilib bo'lmaydi.`)
  }

  // Yozilishlar: avval Sheets qator ID'si bo'yicha, keyin (o'quvchi, guruh) bo'yicha egallanadi
  const yangiYozId = new Set(d.yozilishlar.map((y) => y.sheets_id).filter(Boolean) as string[])
  const egallangan = new Set<string>()
  const pBySid = new Map(pYozilish.filter((e) => e.sheets_id).map((e) => [e.sheets_id!, e]))
  for (const y of d.yozilishlar) {
    const e = y.sheets_id ? pBySid.get(y.sheets_id) : undefined
    if (e) egallangan.add(e.id)
  }
  const qaytaKalit: { id: string; eski: string | null; yangi: string }[] = []
  for (const y of d.yozilishlar) {
    if (!y.sheets_id || pBySid.has(y.sheets_id)) continue
    const e = pYozilish.find((p) =>
      !egallangan.has(p.id) && p.student_id === y.student_id && p.group_id === y.group_id &&
      !(p.sheets_id && yangiYozId.has(p.sheets_id)))
    if (e) {
      egallangan.add(e.id)
      qaytaKalit.push({ id: e.id, eski: e.sheets_id, yangi: y.sheets_id })
    }
  }
  // Tuzatishi bor yozilish o'chirilmaydi (0029) — avvalgi yurishda yopilgani qayta sanalmasin
  const tuzliYoz = new Set(
    (await hammasi<{ enrollment_id: string }>('tuzatishlar', 'enrollment_id')).map((t) => t.enrollment_id),
  )
  const yozilishOchir = pYozilish.filter((e) =>
    !egallangan.has(e.id) && !(tuzliYoz.has(e.id) && !e.sheets_id && e.holat === 'tugagan'))

  // Sheets'da yo'q o'quvchilar: to'lovi qolsa — arxiv, aks holda o'chiriladi
  const qolganTolov = new Set(
    pTolov.filter((p) => !(p.sheets_id && yangiTolovId.has(p.sheets_id))).map((p) => p.student_id),
  )
  const ortiqcha = pOquvchi.filter((p) => !yangiOquvchi.has(p.id))
  const oquvchiOchir = ortiqcha.filter((p) => !qolganTolov.has(p.id))
  const oquvchiArxiv = ortiqcha.filter((p) => qolganTolov.has(p.id))

  const sinovGuruh = pGuruh.filter((g) => /^sinov/i.test(g.nom))

  const davomatGacha = d.davomatGacha
  let eskiBelgi = 0
  let eskiDarslar: { id: string }[] = []
  if (DAVOMAT) {
    const darslar = await hammasi<{ id: string; sana: string }>('lessons', 'id, sana')
    eskiDarslar = darslar.filter((l) => l.sana < davomatGacha)
    const belgilar = await hammasi<{ lesson_id: string }>('attendance', 'lesson_id')
    const eskiId = new Set(eskiDarslar.map((l) => l.id))
    eskiBelgi = belgilar.filter((b) => eskiId.has(b.lesson_id)).length
  }

  console.log('\nREJA — prod baza Sheets\'ga tenglashtiriladi:')
  console.log(`  o‘quvchi: ${d.oquvchilar.length} yoziladi · ${oquvchiOchir.length} o‘chiriladi (logini bilan) · ${oquvchiArxiv.length} arxivga`)
  oquvchiOchir.forEach((p) => console.log(`     − ${p.id} ${p.fish}${p.profile_id ? ' [login]' : ''}`))
  oquvchiArxiv.forEach((p) => console.log(`     ⌂ ${p.id} ${p.fish} (to‘lovi bor — arxivga)`))
  console.log(`  ismi o‘zgargan (ID boshqa bolaga o‘tgan yoki ism to‘ldirilgan): ${ismOzgardi.length}`)
  ismOzgardi.forEach((x) => console.log(`     ~ ${x.id}: "${x.eski}" → "${x.yangi}"`))
  console.log(`  yozilish: ${d.yozilishlar.length} yoziladi · ${qaytaKalit.length} eski yozuv yangi ID oladi · ${yozilishOchir.length} o‘chiriladi (hisob-fakturasi bilan)`)
  console.log(`  to‘lov: ${d.tolovlar.length} yoziladi · ${tolovBekor.length} eski to‘lov bekor qilinadi (${pul(tolovBekor.reduce((a, p) => a + Number(p.summa), 0))} so‘m)`)
  tolovBekor.slice(0, 15).forEach((p) => console.log(`     × ${p.sheets_id} ${p.student_id} ${pul(Number(p.summa))}`))
  console.log(`  tuzatish: ${d.tuzatishRoyxat.length} · hisob-faktura: ${d.hisoblar.length}`)
  if (sinovGuruh.length) console.log(`  sinov guruh darslari o‘chiriladi: ${sinovGuruh.map((g) => `${g.id} "${g.nom}"`).join(', ')}`)
  if (DAVOMAT) {
    console.log(`  davomat (${davomatGacha} gacha): eski ${eskiBelgi} belgi o‘chiriladi → Sheets'dan ${d.davomat.belgilar.filter((b) => b.sana < davomatGacha).length} belgi yoziladi`)
  }

  if (quruq) return null

  /* ── 3. Yozish ── */
  xato('teachers', (await db.from('teachers').upsert(d.ustozlar)).error)

  // Ustoz hisobi: kabinetdagi ism Sheets'dagidek; ishdan ketgan — kira olmaydi.
  // Admin/direktor/qabulxona hisobiga tegilmaydi (ular ham ustoz bo'lishi mumkin).
  const { data: ustozProfil } = await db.from('teachers').select('ism, holat, profile_id').not('profile_id', 'is', null)
  for (const u of ustozProfil ?? []) {
    const ozgar: { ism: string; holat?: string } = { ism: u.ism as string }
    if (u.holat === 'bloklangan') ozgar.holat = 'bloklangan'
    xato('profiles (ustoz)', (await db.from('profiles').update(ozgar).eq('id', u.profile_id as string).eq('rol', 'ustoz')).error)
  }

  if (sinovGuruh.length) {
    xato('sinov darslari', (await db.from('lessons').delete().in('group_id', sinovGuruh.map((g) => g.id))).error)
  }

  const { data: bosqichlar } = await db.from('levels').select('id, subject_id, nom')
  const bosqichId = new Map(
    (bosqichlar ?? []).map((b) => [`${b.subject_id}|${b.nom.toLowerCase()}`, b.id as number]),
  )
  xato('groups', (await db.from('groups').upsert(
    d.guruhlar.map(({ bosqich, ...g }) => ({
      ...g,
      level_id: bosqich && g.subject_id
        ? (bosqichId.get(`${g.subject_id}|${bosqich.toLowerCase()}`) ?? null)
        : null,
    })),
  )).error)

  xato('students', (await db.from('students').upsert(
    d.oquvchilar.map(({ vip: _vip, ...o }) => o),
  )).error)

  for (const x of ismOzgardi) {
    if (x.profile_id) xato('profiles', (await db.from('profiles').update({ ism: x.yangi }).eq('id', x.profile_id)).error)
  }

  for (const q of qaytaKalit) {
    xato('enrollments (ID)', (await db.from('enrollments').update({ sheets_id: q.yangi }).eq('id', q.id)).error)
  }
  xato('enrollments', (await db.from('enrollments').upsert(
    d.yozilishlar.map((y) => ({
      sheets_id: y.sheets_id,
      student_id: y.student_id,
      group_id: y.group_id,
      boshlandi: y.boshlandi,
      tugadi: y.tugadi,
      chegirma_summa: y.chegirma_summa,
      chegirma_oy: y.chegirma_oy,
      chegirma2_summa: y.chegirma2_summa,
      chegirma2_oy: y.chegirma2_oy,
      chegirma_sabab: y.chegirma_sabab,
      holat: y.holat,
      vip: y.vip,
    })),
    { onConflict: 'sheets_id' },
  )).error)
  /* Tuzatishi bor yozilish o'chirilmaydi (0029 himoyasi): u yopiladi —
     hisob-fakturasi olinadi, tuzatishi bekor bo'ladi, qarz qolmaydi. */
  const yopiladi = yozilishOchir.filter((e) => tuzliYoz.has(e.id))
  for (const e of yopiladi) {
    xato('tuzatishlar (bekor)', (await db.from('tuzatishlar')
      .update({ bekor: true, bekor_sabab: 'Sheets\'da yo‘q yozilish' }).eq('enrollment_id', e.id).eq('bekor', false)).error)
    xato('invoices (yopish)', (await db.from('invoices').delete().eq('enrollment_id', e.id)).error)
    xato('enrollments (yopish)', (await db.from('enrollments')
      .update({ holat: 'tugagan', tugadi: new Date().toISOString().slice(0, 10), sheets_id: null }).eq('id', e.id)).error)
    ogoh(`Yozilish ${e.sheets_id ?? e.id} (${e.student_id}) tuzatishi bor — o‘chirilmadi, yopildi`)
  }
  await bolaklab(yozilishOchir.filter((e) => !tuzliYoz.has(e.id)).map((e) => e.id), async (b) => {
    xato('enrollments (o‘chirish)', (await db.from('enrollments').delete().in('id', b)).error)
  })

  // Yozilish ID'lari — Sheets qator ID'si (kalit) bo'yicha
  const bazada = await hammasi<{ id: string; sheets_id: string | null }>('enrollments', 'id, sheets_id')
  const sidDan = new Map(bazada.filter((e) => e.sheets_id).map((e) => [e.sheets_id!, e.id]))
  const yId = new Map(
    d.yozilishlar.filter((y) => y.sheets_id && sidDan.has(y.sheets_id)).map((y) => [y.kalit, sidDan.get(y.sheets_id!)!]),
  )
  const bizning = [...yId.values()]

  /* Tuzatishlar — hisob-fakturadan OLDIN: invoices_tuzatish triggeri ularni o'zi ayiradi.
     O'chirilmaydi: farq bo'lsa eskisi bekor qilinadi, yangisi yoziladi. */
  type PT = { id: number; enrollment_id: string; davr: string; summa: number }
  const eskiTuz = (await hammasi<PT & { bekor: boolean }>('tuzatishlar', 'id, enrollment_id, davr, summa, bekor'))
    .filter((t) => !t.bekor)
  const kerakTuz = new Map<string, { enrollment_id: string; davr: string; summa: number; sabab: string }[]>()
  for (const t of d.tuzatishRoyxat) {
    const eid = t.kalit ? yId.get(t.kalit) : undefined
    if (!eid) continue
    const k = `${eid}|${davrdan(t.oy)}`
    kerakTuz.set(k, [...(kerakTuz.get(k) ?? []), { enrollment_id: eid, davr: davrdan(t.oy), summa: t.summa, sabab: t.sabab }])
  }
  const eskiBoyicha = new Map<string, PT[]>()
  for (const t of eskiTuz) eskiBoyicha.set(`${t.enrollment_id}|${t.davr}`, [...(eskiBoyicha.get(`${t.enrollment_id}|${t.davr}`) ?? []), t])
  const tuzKalitlar = new Set([...kerakTuz.keys(), ...[...eskiBoyicha.keys()].filter((k) => bizning.includes(k.split('|')[0]))])
  let tuzYangi = 0
  for (const k of tuzKalitlar) {
    const kerak = kerakTuz.get(k) ?? []
    const eski = eskiBoyicha.get(k) ?? []
    const jami = (r: { summa: number }[]) => r.reduce((a, x) => a + Number(x.summa), 0)
    if (jami(kerak) === jami(eski) && kerak.length === eski.length) continue
    if (eski.length) {
      xato('tuzatishlar (bekor)', (await db.from('tuzatishlar')
        .update({ bekor: true, bekor_sabab: 'Sheets bilan tenglashtirildi' })
        .in('id', eski.map((t) => t.id))).error)
    }
    if (kerak.length) {
      xato('tuzatishlar', (await db.from('tuzatishlar').insert(kerak)).error)
      tuzYangi += kerak.length
    }
  }

  /* Hisob-faktura — xom summa; VIP va tuzatishni bazaning triggerlari ayiradi */
  const hisobRows = d.hisoblar
    .map((h) => {
      const id = yId.get(h.kalit)
      return id ? { enrollment_id: id, davr: h.davr, summa: h.xomSumma, chegirma: h.xomChegirma, tuzatish: 0 } : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
  await bolaklab(hisobRows, async (b) => {
    xato('invoices', (await db.from('invoices').upsert(b, { onConflict: 'enrollment_id,davr' })).error)
  })
  // Sheets'da yo'q oylar (masalan tugash sanasi o'zgargan)
  const kerakHisob = new Set(hisobRows.map((h) => `${h.enrollment_id}|${h.davr}`))
  const barchaHisob = await hammasi<{ id: string; enrollment_id: string; davr: string }>('invoices', 'id, enrollment_id, davr')
  const ortiqHisob = barchaHisob.filter((h) => bizning.includes(h.enrollment_id) && !kerakHisob.has(`${h.enrollment_id}|${h.davr}`))
  await bolaklab(ortiqHisob.map((h) => h.id), async (b) => {
    xato('invoices (o‘chirish)', (await db.from('invoices').delete().in('id', b)).error)
  })

  /* To'lovlar — Tolovlar ID (T0001) bo'yicha */
  const tolovRows = d.tolovlar.map((t) => ({
    sheets_id: t.sheets_id,
    student_id: t.student_id,
    enrollment_id: t.kalit ? (yId.get(t.kalit) ?? null) : null,
    sana: t.sana,
    davr: t.davr,
    summa: t.summa,
    usul: t.usul,
    tasdiqlangan: t.tasdiqlangan,
    tasdiqlangan_vaqt: t.tasdiqlangan_vaqt,
    izoh: t.izoh,
    manba: 'sheets',
    bekor: false,
  }))
  if (tolovRows.length) {
    xato('payments', (await db.from('payments').upsert(tolovRows, { onConflict: 'sheets_id' })).error)
  }
  await bolaklab(tolovBekor.map((p) => p.id), async (b) => {
    xato('payments (bekor)', (await db.from('payments')
      .update({ bekor: true, bekor_sabab: 'Sheets\'da yo‘q — tenglashtirishda bekor qilindi' })
      .in('id', b)).error)
  })

  /* Sheets'da yo'q o'quvchilar */
  let ochirildi = 0
  const bugun = new Date().toISOString().slice(0, 10)
  for (const p of oquvchiOchir) {
    const { error } = await db.from('students').delete().eq('id', p.id)
    if (error) {
      ogoh(`${p.id} o‘chirilmadi (${error.message}) — arxivga o‘tkazildi`)
      oquvchiArxiv.push(p)
      continue
    }
    if (p.profile_id) {
      const { error: e2 } = await db.auth.admin.deleteUser(p.profile_id)
      if (e2) ogoh(`${p.id}: logini o‘chmadi — ${e2.message}`)
    }
    ochirildi++
  }
  for (const p of oquvchiArxiv) {
    xato('students (arxiv)', (await db.from('students').update({
      holat: 'ketgan', arxiv_sana: bugun, arxiv_sabab: 'Sheets\'da yo‘q (tenglashtirish)',
    }).eq('id', p.id)).error)
  }

  /* Probniylar */
  if (d.probniylar.length) {
    xato('leads', (await db.from('leads').upsert(
      d.probniylar.map(({ created_at, ...p }) => ({
        ...p,
        manba: 'boshqa',            // qayerdan kelgani Sheets'da yozilmagan
        ...(created_at ? { created_at } : {}),
      })),
      { onConflict: 'sheets_id' },
    )).error)
  }

  /* Davomat — faqat chegaragacha (undan keyin davomat saytda qilinadi) */
  let darsSoni = 0, belgiSoni = 0
  if (DAVOMAT) {
    await bolaklab(eskiDarslar.map((l) => l.id), async (b) => {
      xato('attendance (eski)', (await db.from('attendance').delete().in('lesson_id', b)).error)
    })
    const darslar = d.davomat.darslar.filter((l) => l.sana < davomatGacha)
    await bolaklab(darslar, async (b) => {
      xato('lessons', (await db.from('lessons').upsert(
        b.map((l) => ({ group_id: l.group_id, sana: l.sana, otkazildi: true })),
        { onConflict: 'group_id,sana' },
      )).error)
    }, 500)
    darsSoni = darslar.length

    const darsRows = await hammasi<{ id: string; group_id: string; sana: string }>('lessons', 'id, group_id, sana')
    const darsId = new Map(darsRows.map((l) => [`${l.group_id}|${l.sana}`, l.id]))
    const belgiRows = d.davomat.belgilar
      .filter((b) => b.sana < davomatGacha)
      .map((b) => {
        const id = darsId.get(`${b.group_id}|${b.sana}`)
        return id ? { lesson_id: id, student_id: b.student_id, holat: b.holat } : null
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
    await bolaklab(belgiRows, async (b) => {
      xato('attendance', (await db.from('attendance').upsert(b, { onConflict: 'lesson_id,student_id' })).error)
    }, 500)
    belgiSoni = belgiRows.length
  }

  /* ── 4. Tekshiruv: bazadagi jami Sheets bilan teng bo'lishi shart ── */
  const hisobJami = (await hammasi<{ enrollment_id: string; summa: number }>('invoices', 'enrollment_id, summa'))
    .filter((h) => bizning.includes(h.enrollment_id))
    .reduce((a, h) => a + Number(h.summa), 0)
  const tolovJami = (await hammasi<{ summa: number; bekor: boolean; manba: string }>('payments', 'summa, bekor, manba'))
    .filter((p) => p.manba === 'sheets' && !p.bekor)
    .reduce((a, p) => a + Number(p.summa), 0)
  const kutilganHisob = d.hisoblar.reduce((a, h) => a + h.summa, 0)
  const kutilganTolov = d.tolovlar.reduce((a, t) => a + t.summa, 0)

  return {
    oquvchilar: d.oquvchilar.length,
    ochirildi,
    arxivga: oquvchiArxiv.length,
    yozilishlar: yId.size,
    tuzatishlar: tuzYangi,
    hisoblar: hisobRows.length,
    tolovlar: tolovRows.length,
    tolovBekor: tolovBekor.length,
    darslar: darsSoni,
    davomat: belgiSoni,
    tekshiruv: {
      hisob: `${pul(hisobJami)} / Sheets ${pul(kutilganHisob)} ${hisobJami === kutilganHisob ? '✓' : '✗ FARQ'}`,
      tolov: `${pul(tolovJami)} / Sheets ${pul(kutilganTolov)} ${tolovJami === kutilganTolov ? '✓' : '✗ FARQ'}`,
    },
  }
}

/* ------------------------------------------------------------------ */

async function ishga() {
  if (!SHEETS_ID) throw new Error('SHEETS_ID topilmadi (.env.local)')
  console.log(DRY ? '— QURUQ YURISH: hech narsa yozilmaydi —\n' : '— KO‘CHIRISH —\n')

  const kitob = await kitobniOqi(SHEETS_ID)
  console.log(
    'Varaqlar:',
    [...kitob.values()].map((v) => `${v.nom} (${v.qatorlar.length})`).join(', '),
    '\n',
  )

  const d = malumotniQur(kitob)

  console.log('Tayyorlandi:')
  console.log(`  ustozlar        ${d.ustozlar.length}`)
  console.log(`  guruhlar        ${d.guruhlar.length}`)
  console.log(`  o‘quvchilar     ${d.oquvchilar.length}`)
  console.log(`  qatnashuvlar    ${d.yozilishlar.length}`)
  console.log(`  hisob-faktura   ${d.hisoblar.length}`)
  console.log(`  to‘lovlar       ${d.tolovlar.length}  (${pul(d.tolovlar.reduce((a, t) => a + t.summa, 0))} so‘m)`)
  console.log(`  probniylar      ${d.probniylar.length}`)
  if (d.yangiTuzilma) {
    const faol = d.oquvchilar.filter((o) => o.holat === 'faol')
    const bolalar = new Set(faol.map((o) => `${o.fish.trim().toLowerCase()}|${o.ota_tel ?? ''}${o.ona_tel ?? ''}${o.shaxsiy_tel ?? ''}`))
    const tuzSoni = [...d.tuzatishlar.values()].reduce((a, m) => a + m.size, 0)
    const tuzJami = [...d.tuzatishlar.values()].reduce((a, m) => a + [...m.values()].reduce((x, y) => x + y, 0), 0)
    const faolYoz = d.yozilishlar.filter((y) => y.holat === 'faol')
    console.log('  — yangi tuzilma (1 qator = 1 bola × 1 fan) —')
    console.log(`  faol: fan bo‘yicha ${faolYoz.length} · bolalar ${bolalar.size} · VIP ${faolYoz.filter((y) => y.vip).length}`)
    console.log(`  2 fanli bola birlashtirildi: ${d.birlash.size}  (${[...d.birlash].map(([a, b]) => `${a}→${b}`).join(', ')})`)
    console.log(`  arxivdagilar    ${d.oquvchilar.filter((o) => o.holat === 'ketgan').length}`)
    console.log(`  tuzatishlar     ${tuzSoni}  (${pul(tuzJami)} so‘m)`)
    console.log(`  arxiv to‘lovlari ${d.arxivTolovlari.length}  (${pul(d.arxivTolovlari.reduce((a, x) => a + x.summa, 0))} so‘m)`)
  }

  const usulsiz = d.tolovlar.filter((t) => !t.usul).length
  if (usulsiz) console.log(`  · shundan ${usulsiz} tasining USULI [ANIQLANMAGAN]`)

  if (DAVOMAT) {
    const kelgan = d.davomat.belgilar.filter((b) => b.holat === 'keldi').length
    console.log(`  darslar         ${d.davomat.darslar.length}`)
    console.log(`  davomat belgisi ${d.davomat.belgilar.length}  (${kelgan} keldi)`)
  }

  const s = solishtir(d)
  console.log('\nSOLISHTIRUV — hisoblangan / Sheets:')
  console.log(`  to‘lashi kerak  ${pul(s.jamiKerak)} / ${pul(s.jamiKerakSheets)}`)
  console.log(`  to‘langan       ${pul(s.jamiTolangan)} / ${pul(s.jamiTolanganSheets)}`)
  console.log(`  qarz            ${pul(s.qarz)} / ${pul(s.qarzSheets)}`)
  console.log(
    s.farqlar.length === 0
      ? '  ✓ tushuntirilmagan farq yo‘q'
      : `  ✗ ${s.farqlar.length} ta qatnashuvda farq bor:`,
  )
  s.farqlar.slice(0, 20).forEach((f) => console.log('     ·', f))
  if (s.farqlar.length > 20) console.log(`     … yana ${s.farqlar.length - 20} ta`)

  if (s.tushuntirilgan.length) {
    console.log(`
Sheets'ning o'z xatosi (${s.tushuntirilgan.length}) — bazada TO'G'RI hisoblanadi, Sheets'da tuzatish kerak:`)
    s.tushuntirilgan.forEach((f) => console.log('  ·', f))
  }

  if (toxtatuvchilar.length) {
    console.log(`
Yozishni to'xtatadi (${toxtatuvchilar.length}):`)
    toxtatuvchilar.forEach((m) => console.log('  ✗', m))
  }

  if (ogohlantirishlar.length) {
    console.log(`\nOgohlantirishlar (${ogohlantirishlar.length}):`)
    ogohlantirishlar.slice(0, 40).forEach((m) => console.log('  ·', m))
    if (ogohlantirishlar.length > 40) console.log(`  … yana ${ogohlantirishlar.length - 40} ta`)
  }

  if (DRY) {
    console.log('\nQuruq yurish tugadi. Prod bilan reja: npm run migrate -- --reja [--davomat]')
    return
  }

  if (REJA) {
    await yoz(d, true)
    console.log('\nReja tugadi — hech narsa yozilmadi. Yozish: npm run migrate -- --tasdiq [--davomat]')
    return
  }

  /* ── QULF (20.09) ──
     Sayt endi ASOSIY manba, Sheets esa ko'zgu (faqat ko'rish). Bu skript
     teskari yo'nalishda yozadi: Sheets → baza. Bilmasdan yurgizilsa,
     saytda kiritilgan yangi to'lov/davomat eski Sheets qiymati bilan
     ustidan yozilishi mumkin. Shuning uchun ataylab tasdiq kerak. */
  if (!process.argv.includes('--tasdiq')) {
    throw new Error(
      'Sayt endi asosiy manba, Sheets — ko‘zgu. Bu skript Sheets‘dan bazaga yozadi ' +
        'va saytdagi yangi ma’lumotni ustidan yozishi mumkin.\n' +
        'Ko‘rish uchun:        npm run migrate:dry\n' +
        'Rostdan kerak bo‘lsa: npm run migrate -- --tasdiq',
    )
  }

  if (s.farqlar.length > 0 || toxtatuvchilar.length > 0) {
    throw new Error(
      `Solishtiruvda ${s.farqlar.length} ta tushuntirilmagan farq, ` +
        `${toxtatuvchilar.length} ta to'xtatuvchi muammo — yozilmadi. ` +
        `Avval sababini tushunib oling (--dry-run bilan ko‘ring).`,
    )
  }

  const natija = await yoz(d, false)
  console.log('\nYozildi:', natija)

  if (!DAVOMAT) {
    console.log('\nDavomat jurnallari ko‘chirilmadi. Kerak bo‘lsa: npm run migrate -- --davomat')
  }
}

ishga().catch((e) => {
  console.error('\nXATO:', e instanceof Error ? e.message : e)
  process.exit(1)
})

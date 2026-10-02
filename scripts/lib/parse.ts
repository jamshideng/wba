/** Sheets'dagi "iflos" matnni toza qiymatga aylantiruvchi funksiyalar. */

export type KunTuri = 'toq' | 'juft' | 'dam_olish' | 'har_kuni'

/** Narxlar varag'idagi "oxiri yo'q" belgisi (N_Narxlar.js: OY_CHEKSIZ). */
export const CHEKSIZ = 999999

/** "650,000" · "650 000" · "650000.00" → 650000 */
export function pulga(v: unknown): number {
  if (typeof v === 'number') return Math.round(v)
  const s = String(v ?? '').replace(/[^\d.,-]/g, '')
  if (!s) return 0
  const n = Number(s.replace(/\s/g, '').replace(/,/g, ''))
  return Number.isFinite(n) ? Math.round(n) : 0
}

/** "+998-90-968-07-12" · "901234567" → "+998901234567" | null */
export function telefonga(v: unknown): string | null {
  const raqam = String(v ?? '').replace(/\D/g, '')
  if (raqam.length === 9) return `+998${raqam}`
  if (raqam.length === 12 && raqam.startsWith('998')) return `+${raqam}`
  if (raqam.length === 13 && raqam.startsWith('9998')) return `+${raqam.slice(1)}`
  return null
}

/** "15.09.2026" · "2026-09-15" · Excel seriyasi → "2026-09-15" | null */
export function sanaga(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null

  if (typeof v === 'number' && v > 20000 && v < 60000) {
    // Excel/Sheets sana seriyasi (1899-12-30 dan boshlab)
    const ms = (v - 25569) * 86400 * 1000
    return new Date(ms).toISOString().slice(0, 10)
  }

  const s = String(v).trim()

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`

  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`

  return null
}

/** "2026-09" formatiga keltiradi */
export function davrga(v: unknown): string | null {
  const s = String(v ?? '').trim()
  const m = s.match(/(\d{4})[-/](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`
  const sana = sanaga(v)
  return sana ? sana.slice(0, 7) : null
}

const USUL_MAP: Record<string, 'naqd' | 'karta' | 'click' | 'payme'> = {
  naqd: 'naqd', nal: 'naqd', cash: 'naqd', наличные: 'naqd',
  karta: 'karta', plastik: 'karta', card: 'karta', карта: 'karta',
  click: 'click', klik: 'click',
  payme: 'payme', payma: 'payme',
}

/** To'lov usulini aniqlaydi. Aniqlanmasa — null (qo'lda tekshiriladi). */
export function usulga(v: unknown): 'naqd' | 'karta' | 'click' | 'payme' | null {
  const s = String(v ?? '').trim().toLowerCase()
  if (!s) return null
  for (const [kalit, qiymat] of Object.entries(USUL_MAP)) {
    if (s.includes(kalit)) return qiymat
  }
  return null
}

/** Bosqich nomlaridagi qisqartmalarni to'g'rilaydi */
const BOSQICH_MAP: Record<string, string> = {
  'pre-inter': 'Pre-Intermediate',
  'pre inter': 'Pre-Intermediate',
  'pre-intermediate': 'Pre-Intermediate',
  'pre-ielts': 'Pre-IELTS',
  'inter': 'Intermediate',
  'intermediate': 'Intermediate',
  'elementary': 'Elementary',
  'beginner': 'Beginner',
  'starter': 'Starter',
  'ielts': 'IELTS',
}

export function bosqichNormal(nom: string): string {
  const kalit = nom.trim().toLowerCase()
  return BOSQICH_MAP[kalit] ?? nom.trim()
}

/** Guruh/bosqich nomidan yo'nalishni topadi */
export function yonalishAniqla(nom: string): string | null {
  const s = nom.toLowerCase()
  if (/starter|beginner|elementary|inter|ielts|english|ingliz/.test(s)) return 'ingliz-tili'
  if (/rus|русск/.test(s)) return 'rus-tili'
  if (/arab/.test(s)) return 'arab-tili'
  if (/matem|matma|математ/.test(s)) return 'matematika'
  if (/pochemuchka|почемучка/.test(s)) return 'pochemuchka'
  if (/\bai\b|sun'?iy|it\b/.test(s)) return 'ai-it'
  if (/scratch/.test(s)) return 'scratch'
  if (/dastur|web|html|css|javascript/.test(s)) return 'web-dasturlash'
  return null
}

/** "Toq kun" · "Juft kun" · "Dam olish" → baza qiymati (R_Guruh.js: KUN_ROY) */
export function kunTuriga(v: unknown): KunTuri | null {
  const s = String(v ?? '').toLowerCase()
  if (!s.trim()) return null
  if (s.includes('dam')) return 'dam_olish'
  if (s.includes('juft')) return 'juft'
  if (s.includes('toq')) return 'toq'
  if (/har\s*kun/.test(s)) return 'har_kuni'
  return null
}

/** "08:30-10:00" · "18:30/20:00" · "8:30 – 10:00" → { boshlanish, tugash } */
export function vaqtAjrat(v: unknown): { boshlanish: string; tugash: string } | null {
  const m = String(v ?? '').match(/(\d{1,2}):(\d{2})\s*[-–—/]\s*(\d{1,2}):(\d{2})/)
  if (!m) return null
  const t = (soat: string, daq: string) => `${soat.padStart(2, '0')}:${daq}`
  return { boshlanish: t(m[1], m[2]), tugash: t(m[3], m[4]) }
}

/** "Madina Abduganiyeva (S015)" → { fish, id } */
export function ismVaId(xom: unknown): { fish: string; id: string | null } {
  const s = String(xom ?? '').trim()
  const m = s.match(/^(.*?)\s*\((S\d+)\)\s*$/i)
  if (m) return { fish: m[1].trim(), id: m[2].toUpperCase() }
  return { fish: s, id: null }
}

/**
 * Qatnashuv va to'lov kaliti:
 *   "Muslima G'ayratova (S001) · Elementary · Diyora · 18:30-20:00"
 * Guruh nomining o'zida ham "·" bor, shuning uchun ") · " bo'yicha
 * BIR MARTA ajratiladi (BOT_Baza.js: bGuruhAjrat).
 */
export function kalitAjrat(xom: unknown): { fish: string; id: string | null; guruh: string | null } {
  const s = String(xom ?? '').trim()
  const i = s.indexOf(') · ')
  if (i < 0) {
    const { fish, id } = ismVaId(s)
    return { fish, id, guruh: null }
  }
  const { fish, id } = ismVaId(s.slice(0, i + 1))
  return { fish, id, guruh: s.slice(i + 4).trim() || null }
}

/* ------------------------------------------------------------------ */
/*  Oy arifmetikasi — Sheets bilan bir xil bo'lishi shart               */
/* ------------------------------------------------------------------ */

/** "2026-09" yoki sana → 2026*12+9. Tushunarsiz bo'lsa 0. */
export function oyRaqami(v: unknown): number {
  const davr = davrga(v)
  if (!davr) return 0
  const [yil, oy] = davr.split('-').map(Number)
  return yil * 12 + oy
}

/** 24321 → "2026-09" */
export function davrdan(raqam: number): string {
  const yil = Math.floor((raqam - 1) / 12)
  const oy = raqam - yil * 12
  return `${yil}-${String(oy).padStart(2, '0')}`
}

/**
 * Qatnashuv necha oy davom etgan — KALENDAR oy (O'quvchilar.Oylar, 02.10 dan):
 *   DATEDIF(EOMONTH(boshlandi, -1) + 1, tugadi yoki bugun, "M") + 1
 * Oy boshlangan kundan emas, oyning 1-sanasidan sanaladi: 25.09 da kelgan
 * bola uchun 1-oktabrdan 2-oy. Bazadagi create_monthly_invoices ham shunday.
 */
export function oylarSoni(boshlandi: string, tugadi?: string | null, bugun = new Date()): number {
  if (!boshlandi) return 0
  const b = new Date(`${boshlandi}T00:00:00Z`)
  const o = tugadi ? new Date(`${tugadi}T00:00:00Z`) : new Date(bugun.toISOString().slice(0, 10) + 'T00:00:00Z')
  if (Number.isNaN(b.getTime()) || Number.isNaN(o.getTime()) || o < b) return 0

  const oylar = (o.getUTCFullYear() - b.getUTCFullYear()) * 12 + (o.getUTCMonth() - b.getUTCMonth())
  return Math.max(oylar + 1, 0)
}

/**
 * Qatnashuvning `oy`-oyida amal qiladigan chegirma (U_Qatnashuv.js:100-111).
 * "Necha oy" bo'sh bo'lsa — bosqich muddatsiz.
 */
export function chegirmaOyda(
  oy: number,
  bir: { summa: number; oylar: number | null },
  ikki: { summa: number; oylar: number | null },
): number {
  const d1 = bir.summa > 0 ? (bir.oylar ?? CHEKSIZ) : 0
  const d2 = ikki.summa > 0 ? (ikki.oylar ?? CHEKSIZ) : 0

  if (bir.summa > 0 && oy <= d1) return bir.summa
  if (ikki.summa > 0 && oy > d1 && oy <= d1 + d2) return ikki.summa
  return 0
}

/* ------------------------------------------------------------------ */
/*  Narx tarixi                                                        */
/* ------------------------------------------------------------------ */

export type NarxQator = { guruh: string; narx: number; dan: number; gacha: number }

/**
 * Narxlar varag'ining qatorlaridan tarix quradi.
 * Har guruhning ENG BIRINCHI qatori orqaga ham amal qiladi (dan = 0),
 * oxirgisi esa oldinga cheksiz (N_Narxlar.js:60-78).
 */
export function narxTarixi(
  qatorlar: { guruh: string; narx: number; oydan: unknown }[],
): Map<string, NarxQator[]> {
  const guruhlar = new Map<string, { narx: number; oy: number }[]>()

  for (const q of qatorlar) {
    const oy = oyRaqami(q.oydan)
    if (!q.guruh || q.narx <= 0 || oy <= 0) continue
    const roy = guruhlar.get(q.guruh) ?? []
    roy.push({ narx: q.narx, oy })
    guruhlar.set(q.guruh, roy)
  }

  const tarix = new Map<string, NarxQator[]>()
  for (const [guruh, roy] of guruhlar) {
    roy.sort((a, b) => a.oy - b.oy)
    tarix.set(
      guruh,
      roy.map((r, i) => ({
        guruh,
        narx: r.narx,
        dan: i === 0 ? 0 : r.oy,
        gacha: i + 1 < roy.length ? roy[i + 1].oy - 1 : CHEKSIZ,
      })),
    )
  }
  return tarix
}

/** Shu oydagi narx. Guruh uchun tarix bo'lmasa — guruhning joriy narxi. */
export function narxOyda(tarix: NarxQator[] | undefined, oy: number, zaxira: number): number {
  if (!tarix || tarix.length === 0) return zaxira
  const topildi = tarix.find((n) => oy >= n.dan && oy <= n.gacha)
  return topildi ? topildi.narx : zaxira
}

/** Axlat qatorlarni tashlab yuborish uchun */
export function axlatmi(fish: string): boolean {
  const s = fish.trim().toLowerCase()
  if (!s || s.length < 2) return true
  if (/^namuna|^misol|^test|^sdfd|^dars soati|^jami|^umumiy/.test(s)) return true
  if (/^\d+$/.test(s)) return true
  if (/^[^a-zA-Zа-яА-ЯёЁʻʼ'`]+$/.test(s)) return true
  return false
}

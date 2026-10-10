/**
 * Woblar Market (0040) — umumiy turlar va yordamchilar.
 * Narx woblarda; balans = berilgan woblar − bekor qilinmagan buyurtmalar.
 */

export type Mahsulot = {
  id: string
  nom: string
  tavsif: string | null
  toifa: string | null
  rasm_url: string | null
  rasmlar: string[]
  rejim: 'sotuvda' | 'oldindan'
  kelish_sana: string | null
  narx_ball: number
  qolgan_soni: number
  cheksiz: boolean
  holat: 'faol' | 'yopilgan'
  tartib: number
  created_at: string
}

export type BuyurtmaHolati = 'buyurtma' | 'kutilmoqda' | 'berildi' | 'bekor'

export type Buyurtma = {
  id: string
  kod: string | null
  student_id: string
  reward_id: string | null
  mahsulot_nomi: string | null
  /** 0063 — market | bozor (an'anaviy bozor, o'quvchi o'zi yozgan) */
  tur?: 'market' | 'bozor'
  soni: number
  ball: number
  holat: BuyurtmaHolati
  created_at: string
  berildi_vaqt: string | null
  keldi_vaqt: string | null
  bekor_sabab: string | null
}

export const HOLAT_NOMI: Record<BuyurtmaHolati, string> = {
  buyurtma: 'Kelishi kutilmoqda',
  kutilmoqda: 'Tayyor — olib keting',
  berildi: 'Berildi',
  bekor: 'Bekor qilingan',
}

export const HOLAT_TONI: Record<BuyurtmaHolati, 'accent' | 'ok' | 'jim' | 'brand'> = {
  buyurtma: 'brand',
  kutilmoqda: 'accent',
  berildi: 'ok',
  bekor: 'jim',
}

/** Ombor holati matni */
export function omborMatni(m: Pick<Mahsulot, 'cheksiz' | 'qolgan_soni'>): { matn: string; tugagan: boolean; kam: boolean } {
  if (m.cheksiz) return { matn: 'Bor', tugagan: false, kam: false }
  if (m.qolgan_soni <= 0) return { matn: 'Tugagan', tugagan: true, kam: false }
  return { matn: `${m.qolgan_soni} ta qoldi`, tugagan: false, kam: m.qolgan_soni <= 3 }
}

/** "WM-7K4P2X" — kod shaklini tekshirish (qidiruv va berishda) */
export function kodNormal(xom: string | null | undefined): string | null {
  const s = String(xom ?? '').trim().toUpperCase().replace(/\s+/g, '')
  if (/^WM-[2-9A-HJ-NP-Z]{6}$/.test(s)) return s
  if (/^[2-9A-HJ-NP-Z]{6}$/.test(s)) return `WM-${s}`
  return null
}

/** Rasm yuklash cheklovlari (bucket bilan bir xil — 0040) */
export const RASM_TURLARI = ['image/jpeg', 'image/png', 'image/webp'] as const
export const RASM_MAKS_BAYT = 3 * 1024 * 1024
/** Bitta mahsulotga eng ko'p rasm (0042 cheklovi bilan bir xil) */
export const RASM_MAKS_SONI = 8

/**
 * Formadan kelgan rasm manzillari — faqat o'zimizning 'market' bucketidagi
 * ochiq fayllar o'tadi (begona sayt rasmi qo'yib bo'lmaydi).
 */
export function rasmlarniOqi(xom: unknown, supabaseUrl: string): string[] {
  let royxat: unknown
  try {
    royxat = JSON.parse(String(xom ?? '[]'))
  } catch {
    return []
  }
  if (!Array.isArray(royxat)) return []
  const boshi = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/market/`
  const toza = royxat.filter(
    (u): u is string => typeof u === 'string' && u.startsWith(boshi) && /^[\w./-]+$/.test(u.slice(boshi.length)),
  )
  return [...new Set(toza)].slice(0, RASM_MAKS_SONI)
}

/** "2026-10-01T14:05:00Z" → "01.10.2026, 19:05" (Toshkent vaqti) */
export function sanaVaqt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const q = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d).map((p) => [p.type, p.value]),
  )
  return `${q.day}.${q.month}.${q.year}, ${q.hour}:${q.minute}`
}

/** Oldindan buyurtma tovari qachon keladi: o'z sanasi, bo'lmasa bozor kuni */
export function kelishSanasi(m: Pick<Mahsulot, 'rejim' | 'kelish_sana'>, bozor: string | null): string | null {
  if (m.rejim !== 'oldindan') return null
  return m.kelish_sana ?? bozor
}

/** "2026-10-30" → "30-oktabr" */
export function kunOy(sana: string | null | undefined): string {
  if (!sana) return ''
  const OY = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
  const [, o, k] = sana.split('-').map(Number)
  return o && k ? `${k}-${OY[o - 1]}` : ''
}

/** Bozor kunigacha necha kun: 0 — bugun, manfiy — o'tib ketgan */
export function nechaKunQoldi(sana: string, bugun: string): number {
  return Math.round((Date.parse(`${sana}T00:00:00Z`) - Date.parse(`${bugun}T00:00:00Z`)) / 86_400_000)
}

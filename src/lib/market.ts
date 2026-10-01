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
  narx_ball: number
  qolgan_soni: number
  cheksiz: boolean
  holat: 'faol' | 'yopilgan'
  tartib: number
  created_at: string
}

export type BuyurtmaHolati = 'kutilmoqda' | 'berildi' | 'bekor'

export type Buyurtma = {
  id: string
  kod: string | null
  student_id: string
  reward_id: string
  mahsulot_nomi: string | null
  soni: number
  ball: number
  holat: BuyurtmaHolati
  created_at: string
  berildi_vaqt: string | null
  bekor_sabab: string | null
}

export const HOLAT_NOMI: Record<BuyurtmaHolati, string> = {
  kutilmoqda: 'Olib ketilmagan',
  berildi: 'Berildi',
  bekor: 'Bekor qilingan',
}

export const HOLAT_TONI: Record<BuyurtmaHolati, 'accent' | 'ok' | 'jim'> = {
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

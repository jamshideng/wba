/**
 * Lidlar kanbani — ustunlar (0059).
 *
 * Bazadagi holatlar botdagi probniy holatlari bilan bir xil qoladi
 * (yangi · qongiroq · keldi · kelmadi · yozildi · rad). Kanban ustuni
 * holat + sinov_sana dan hisoblanadi: sinov kuni belgilangan lid
 * "Sinov darsi" ustunida turadi — Probniylar sahifasi bilan mos.
 */

import type { LeadSource, LeadStatus } from '@/lib/types'

export type Bosqich = 'yangi' | 'boglanildi' | 'sinov' | 'oquvchi' | 'yoqotildi'

export const BOSQICHLAR: { id: Bosqich; nom: string; izoh: string; rang: string }[] = [
  { id: 'yangi', nom: 'Yangi', izoh: 'Hali bog‘lanilmagan', rang: 'bg-ink-3' },
  { id: 'boglanildi', nom: 'Bog‘lanildi', izoh: 'Qo‘ng‘iroq yoki Telegram orqali', rang: 'bg-accent' },
  { id: 'sinov', nom: 'Sinov darsi', izoh: 'Sinov kuni belgilangan yoki keldi', rang: 'bg-brand' },
  { id: 'oquvchi', nom: 'O‘quvchi bo‘ldi', izoh: 'Guruhga yozildi', rang: 'bg-ok' },
  { id: 'yoqotildi', nom: 'Yo‘qotildi', izoh: 'Kelmadi yoki rad etdi', rang: 'bg-ink-4' },
]

export function bosqichi(l: { holat: LeadStatus; sinov_sana: string | null; student_id: string | null }): Bosqich {
  if (l.student_id || l.holat === 'yozildi') return 'oquvchi'
  if (l.holat === 'rad' || l.holat === 'kelmadi') return 'yoqotildi'
  if (l.holat === 'keldi' || l.sinov_sana) return 'sinov'
  if (l.holat === 'qongiroq') return 'boglanildi'
  return 'yangi'
}

export const MANBA_NOMI: Record<LeadSource, string> = {
  sayt: 'Sayt',
  telegram: 'Telegram',
  instagram: 'Instagram',
  tavsiya: 'Tanishlar tavsiyasi',
  boshqa: 'Boshqa',
}

export const MANBALAR = Object.keys(MANBA_NOMI) as LeadSource[]

/** Toshkent sanasiga n kun qo'shadi (YYYY-MM-DD). */
export function kunQosh(isoSana: string, n: number): string {
  const d = new Date(`${isoSana}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Kanbandagi karta uchun ma'lumot. */
export type LidKarta = {
  id: string
  ism: string
  telefon: string
  manba: LeadSource
  holat: LeadStatus
  izoh: string | null
  sabab: string | null
  teglar: string[]
  student_id: string | null
  group_id: string | null
  guruh: string | null
  sinov_sana: string | null
  keyingi_aloqa: string | null
  aloqa_soni: number
  oxirgi_aloqa: string | null
  created_at: string
}

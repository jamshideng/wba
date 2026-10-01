/**
 * Sayt ichidagi bildirishnomalar (0047) — umumiy turlar va matnlar.
 * Kimga va filtr qoidasi Telegram e'loni (src/lib/elon.ts) bilan bir xil.
 */

export type BildirishnomaTuri = 'eslatma' | 'elon' | 'reklama' | 'sorovnoma'

export const BTURLAR: { qiymat: BildirishnomaTuri; nom: string; izoh: string }[] = [
  { qiymat: 'eslatma', nom: 'Eslatma', izoh: 'Qisqa ogohlantirish: to‘lov, imtihon, uy vazifasi…' },
  { qiymat: 'elon', nom: 'E’lon', izoh: 'Markaz yangiligi: dam olish kuni, tadbir, jadval o‘zgarishi…' },
  { qiymat: 'reklama', nom: 'Reklama', izoh: 'Yangi kurs, chegirma, aksiya — tugma bilan' },
  { qiymat: 'sorovnoma', nom: 'So‘rovnoma', izoh: 'Savol va variantlar — javob shu yerning o‘zida' },
]

export const BTUR_NOMI: Record<BildirishnomaTuri, string> = Object.fromEntries(
  BTURLAR.map((t) => [t.qiymat, t.nom]),
) as Record<BildirishnomaTuri, string>

/** Foydalanuvchiga ko'rinadigan bitta bildirishnoma (mening_bildirishnomalarim) */
export type MeningBildirishnomam = {
  id: number
  turi: BildirishnomaTuri
  sarlavha: string
  matn: string | null
  havola: string | null
  havola_matn: string | null
  muhim: boolean
  kop_tanlov: boolean
  natija_ochiq: boolean
  created_at: string
  korilgan: boolean
  yopilgan: boolean
  javob_berdim: boolean
  variantlar: { id: number; matn: string }[]
}

export type SorovnomaNatija = { variant_id: number; matn: string; ovoz: number; jami: number }

/** So'rovnoma variantlari — har qatorda bittasi, bo'shlari tashlanadi */
export function variantlarniOqi(xom: string): string[] {
  return [...new Set(xom.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))].slice(0, 10).map((s) => s.slice(0, 120))
}

/** Havola: faqat sayt ichidagi yo'l (/crm/…) yoki https manzil */
export function havolaToza(xom: string | null): string | null {
  const s = (xom ?? '').trim()
  if (!s) return null
  if (s.startsWith('/') && !s.startsWith('//')) return s.slice(0, 300)
  if (/^https:\/\/[^\s]+$/.test(s)) return s.slice(0, 300)
  return null
}

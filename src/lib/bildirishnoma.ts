import { filtrOqi } from '@/lib/elon'
import type { ElonFiltr } from '@/lib/types'

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
  savollar: SorovnomaSavol[]
}

/** So'rovnomaning bitta savoli (0052): har birining o'z variantlari */
export type SorovnomaSavol = { id: number; matn: string; kop_tanlov: boolean; variantlar: { id: number; matn: string }[] }

export type SorovnomaNatija = { savol_id: number; savol_matn: string; variant_id: number; matn: string; ovoz: number; jami: number }

/** Admin formasidan kelgan savol (hali bazada id yo'q) */
export type YangiSavol = { matn: string; kop_tanlov: boolean; variantlar: string[] }

export const SAVOL_MAX = 10

/**
 * Formadagi savollar (JSON) → toza ro'yxat. Bo'sh savol matni o'rniga
 * so'rovnoma sarlavhasi (bitta savolli so'rovnoma — eskicha). Kamida
 * 2 variantli savollargina qoladi.
 */
export function savollarniOqi(xom: string, sarlavha: string): YangiSavol[] {
  let arr: unknown
  try { arr = JSON.parse(xom) } catch { return [] }
  if (!Array.isArray(arr)) return []
  return arr
    .slice(0, SAVOL_MAX)
    .map((x) => {
      const o = (x ?? {}) as { matn?: unknown; kop_tanlov?: unknown; variantlar?: unknown }
      const variantlar = variantlarniOqi(Array.isArray(o.variantlar) ? o.variantlar.map(String).join('\n') : String(o.variantlar ?? ''))
      const matn = String(o.matn ?? '').trim().slice(0, 200) || sarlavha.slice(0, 200)
      return { matn, kop_tanlov: o.kop_tanlov === true, variantlar }
    })
    .filter((q) => q.matn && q.variantlar.length >= 2)
}

/** Natijani savollar bo'yicha guruhlash (tartib saqlanadi) */
export function natijaSavollarga(natija: SorovnomaNatija[]): { savol_id: number; savol_matn: string; variantlar: SorovnomaNatija[] }[] {
  const m = new Map<number, { savol_id: number; savol_matn: string; variantlar: SorovnomaNatija[] }>()
  for (const n of natija) {
    if (!m.has(n.savol_id)) m.set(n.savol_id, { savol_id: n.savol_id, savol_matn: n.savol_matn, variantlar: [] })
    m.get(n.savol_id)!.variantlar.push(n)
  }
  return [...m.values()]
}

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

/**
 * Bildirishnoma filtri: e'londagi (guruh/fan/qarzdor) + BITTA o'quvchi (0056).
 * "oquvchi:S016" faqat shu yerda o'qiladi — Telegram e'loni (filtrOqi /
 * elon_oluvchilar) uni bilmaydi va hammaga yuborib yubormasin.
 */
export type BildirishnomaFiltr = ElonFiltr & { oquvchi?: string }

export function bildirishnomaFiltri(f: string): BildirishnomaFiltr {
  const [tur, qiymat] = f.split(':')
  if (tur === 'oquvchi') return /^S\d{1,5}$/.test(qiymat ?? '') ? { oquvchi: qiymat } : {}
  return filtrOqi(f)
}

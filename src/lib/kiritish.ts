/**
 * Formadan kelgan matnni tekshirish va toza qiymatga aylantirish.
 * Bu yerdagi qoidalar botdagi bilan bir xil — admin qaysi joyda
 * yozmasin, natija bir xil chiqsin.
 */

import { telefonNormal } from '@/lib/format'

/**
 * Summa — botdagi qoida (Kod.js: oddiyTahlil):
 *   "550"      → 550 000   (3000 dan kichik raqam — minglarda yozilgan)
 *   "650 000"  → 650 000
 *   "1.2 mln"  → 1 200 000
 *   "600 ming" → 600 000
 * Tushunarsiz yoki musbat bo'lmasa — null.
 */
export function summaOqi(xom: FormDataEntryValue | string | null | undefined): number | null {
  const s = String(xom ?? '').trim().toLowerCase()
  const m = s.match(/(\d[\d\s,]*(?:\.\d+)?)\s*(mln|million|ming)?/)
  if (!m) return null

  let n = parseFloat(m[1].replace(/[\s,]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null

  const birlik = m[2] ?? ''
  if (birlik.startsWith('ml')) n *= 1_000_000
  else if (birlik === 'ming') n *= 1_000
  else if (n < 3000) n *= 1_000

  return Math.round(n)
}

/** Matn — bo'sh bo'lsa null. */
export function matn(v: FormDataEntryValue | null | undefined): string | null {
  const s = String(v ?? '').trim()
  return s ? s : null
}

/**
 * Telefon. Bo'sh — null (xato emas), noto'g'ri — undefined (xato).
 * Z_Telefon.js dagi kabi: qanday yozilsa ham +998XXXXXXXXX ga keladi.
 */
export function telefonOqi(v: FormDataEntryValue | null | undefined): string | null | undefined {
  const s = matn(v)
  if (!s) return null
  return telefonNormal(s) ?? undefined
}

/**
 * Telegram username (0116): "@user", "user", "t.me/user", "https://t.me/user"
 * — hammasi "user" ga keladi. Bo'sh — null; noto'g'ri — undefined.
 * Telegram qoidasi: 5–32 belgi, harf bilan boshlanadi, faqat lotin harf, raqam, "_".
 */
export function telegramUserOqi(v: FormDataEntryValue | null | undefined): string | null | undefined {
  const s = matn(v)
  if (!s) return null
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)\/([^/?#\s]+)\/?$/i)
  const nom = (m ? m[1] : s).replace(/^@/, '')
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(nom) && !nom.endsWith('_') ? nom : undefined
}

/** "2026-09-17" — faqat shu ko'rinish qabul qilinadi (input type=date beradi). */
export function sanaOqi(v: FormDataEntryValue | null | undefined): string | null {
  const s = matn(v)
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

/** "2026-09" — input type=month beradi. */
export function davrOqi(v: FormDataEntryValue | null | undefined): string | null {
  const s = matn(v)
  return s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s) ? s : null
}

/** Butun son. Bo'sh — null. */
export function sonOqi(v: FormDataEntryValue | null | undefined): number | null {
  const s = matn(v)
  if (!s) return null
  const n = Number(s.replace(/\s/g, ''))
  return Number.isInteger(n) ? n : null
}

/** Natija bilan qaytish uchun manzil: /crm/x?ok=... yoki ?xato=... */
export function xabarliYol(yol: string, xabar: { ok?: string; xato?: string }): string {
  const [asos, sorov = ''] = yol.split('?')
  const q = new URLSearchParams(sorov)
  q.delete('ok')
  q.delete('xato')
  if (xabar.ok) q.set('ok', xabar.ok)
  if (xabar.xato) q.set('xato', xabar.xato)
  const qs = q.toString()
  return qs ? `${asos}?${qs}` : asos
}

/**
 * Kirgandan keyingi qaytish yo'li — FAQAT shu saytning ichki yo'li.
 *
 * `?keyin=https://evil.com` yoki `//evil.com` yozib qo'yilsa, login
 * sahifasi bizniki bo'lgani uchun odam ishonib bosadi va begona saytga
 * tushadi (ochiq yo'naltirish). Shuning uchun:
 *   · '/' bilan boshlanmasa — rad (mutlaq yoki tashqi manzil)
 *   · '//' yoki '/\' — protokolsiz tashqi manzil, rad
 *   · teskari slash yoki kodlangan slash (%2f/%5c) — rad
 *   · oxirida URL bilan tekshiramiz: origin o'zgarmasin
 * Rad etilsa — xavfsiz zaxira '/crm'.
 */
export function ichkiYol(xom: FormDataEntryValue | string | null | undefined): string {
  const y = String(xom ?? '').trim()
  if (!y.startsWith('/')) return '/crm'
  if (y.startsWith('//') || y.startsWith('/\\')) return '/crm'
  if (/\\/.test(y)) return '/crm'
  if (/%2f|%5c/i.test(y)) return '/crm'
  try {
    const u = new URL(y, 'http://x')
    if (u.origin !== 'http://x' || !u.pathname.startsWith('/')) return '/crm'
  } catch {
    return '/crm'
  }
  return y
}

/**
 * Bazadan kelgan xatoni odam tushunadigan qilib beradi.
 * Bizning funksiyalar o'zbekcha xabar tashlaydi — shuni o'zgarishsiz
 * qoldiramiz; texnik xatolarni esa umumiy tilga o'giramiz.
 */
export function xatoMatni(e: { message?: string; code?: string } | null): string {
  if (!e) return 'Nimadir noto‘g‘ri ketdi.'
  if (e.code === '42501') return 'Bu amal uchun huquqingiz yo‘q.'
  if (e.code === '23505') return 'Bunday yozuv allaqachon bor.'
  if (e.code === '23514') return 'Kiritilgan qiymat qoidaga to‘g‘ri kelmaydi.'
  return e.message ?? 'Nimadir noto‘g‘ri ketdi.'
}

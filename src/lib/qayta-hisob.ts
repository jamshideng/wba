/**
 * Qayta hisoblash (kelmagan darslar, 0147) — oyning to'lov holatiga qarab
 * oynaning pastki qismi qanday ko'rinishi (Jamshid, 28.11).
 *
 *   S — shu safargi qayta hisob summasi (darslar × bir dars narxi)
 *   F — shu oy hozir to'lanishi kerak summa (avvalgi qayta hisoblardan keyin)
 *   P — shu oy uchun to'langan (naqd qaytarishlar ayirilgan)
 *
 * Jami ortiqcha = P − (F − S) — to'langan minus shu oyning BARCHA qayta
 * hisoblaridan keyingi summasi. Unga avvalgi qayta hisobdan keyingi oyga
 * o'tgan ortiqcha ham kiradi (masalan 173 075 + 69 230 = 242 305).
 * Radio tanlov (keyingi oy / naqd) jami ortiqcha uchun ishlaydi; bazadagi
 * tuzatish_darslar_qosh ham naqdda shu summani qaytaradi.
 */
export type QaytaHisobHolati =
  | { tur: 'tolangan'; shuSafar: number; jami: number }
  | { tur: 'tolanmagan'; endiTolanadi: number }
  | { tur: 'qisman'; qarz: number; endiTolanadi: number }
  | { tur: 'qisman_ortiqcha'; qarz: number; jami: number }

export function qaytaHisobHolati(S: number, F: number, P: number): QaytaHisobHolati {
  const jami = Math.max(0, P - (F - S))
  if (P >= F) return { tur: 'tolangan', shuSafar: S, jami }
  if (P <= 0) return { tur: 'tolanmagan', endiTolanadi: Math.max(0, F - S) }
  const qarz = F - P
  if (jami === 0) return { tur: 'qisman', qarz, endiTolanadi: qarz - S }
  return { tur: 'qisman_ortiqcha', qarz, jami }
}

/** 173075 → "173 075" (oddiy probel; brauzer lokaliga bog'liq emas) */
export function somProbel(n: number | string | null | undefined): string {
  const v = Math.round(Number(n ?? 0))
  if (!Number.isFinite(v)) return '0'
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return v < 0 ? `−${s}` : s
}

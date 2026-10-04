/**
 * Audit jurnali (audit_log) yozuvini odam o'qiydigan qilish.
 * Trigger (audit_trigger, 0002) butun qatorni eski/yangi jsonb qilib yozadi —
 * bu yerda faqat O'ZGARGAN maydonlar ajratib olinadi.
 */

/** Har o'zgarishda o'zi yangilanadigan, ko'rsatishga arzimaydigan maydonlar. */
const SHOVQIN = new Set(['updated_at', 'created_at'])

export type Farq = { maydon: string; eski: unknown; yangi: unknown }

function obyekt(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

/** eski → yangi: qaysi maydonlar o'zgardi. INSERT da hamma to'ldirilgan maydon, DELETE da — eski qiymatlar. */
export function auditFarqi(eski: unknown, yangi: unknown): Farq[] {
  const a = obyekt(eski) ?? {}
  const b = obyekt(yangi) ?? {}
  const kalitlar = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !SHOVQIN.has(k))
  return kalitlar
    .filter((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null))
    .filter((k) => !(obyekt(eski) === null && (b[k] === null || b[k] === '')))
    .map((k) => ({ maydon: k, eski: a[k] ?? null, yangi: b[k] ?? null }))
}

/** Qiymatni bir qatorga sig'adigan matnga. */
export function qiymatMatni(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'ha' : 'yo‘q'
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return s.length > 60 ? `${s.slice(0, 57)}…` : s
}

export const AMAL_NOMI: Record<string, string> = {
  INSERT: 'Qo‘shildi',
  UPDATE: 'O‘zgardi',
  DELETE: 'O‘chirildi',
  LOGIN_OZGARDI: 'Login o‘zgardi',
  PAROL_OZGARDI: 'Parol o‘zgardi',
  HISOB_OCHILDI: 'Hisob ochildi',
  HISOB_PAROL: 'Admin parol qo‘ydi',
}

export const JADVAL_NOMI: Record<string, string> = {
  payments: 'To‘lov',
  invoices: 'Oylik hisob',
  enrollments: 'Guruhga yozilish',
  students: 'O‘quvchi',
  groups: 'Guruh',
  tuzatishlar: 'Tuzatish',
  xarajatlar: 'Xarajat',
  profiles: 'Hisob (login)',
  woblr: 'Woblar',
  woblr_redemptions: 'Market buyurtmasi',
  woblr_rewards: 'Market mahsuloti',
}

export const WOBLR_SABAB: Record<string, string> = {
  faollik: 'faollik',
  uy_vazifasi: 'uy vazifasi',
  yordam: 'yordam',
  qoida: 'qoida buzish',
  boshqa: 'boshqa',
}

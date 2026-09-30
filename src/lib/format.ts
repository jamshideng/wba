import type { DayType } from '@/lib/types'

/** Pul: 650000 → "650 000" */
export function pul(n: number | string | null | undefined): string {
  const v = Number(n ?? 0)
  if (!Number.isFinite(v)) return '0'
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 })
    .format(v)
    .replace(/ /g, ' ')
}

/** Pul + birlik: "650 000 so'm" */
export function pulSom(n: number | string | null | undefined): string {
  return `${pul(n)} so‘m`}

const OYLAR = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
]

const OYLAR_QISQA = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']

/** "2026-09-15" → "15 sentabr 2026" */
export function sana(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(dt.getTime())) return '—'
  return `${dt.getDate()} ${OYLAR[dt.getMonth()]} ${dt.getFullYear()}`
}

/** "2026-09-15" → "15.09.2026" */
export function sanaQisqa(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(dt.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()}`
}

/** "2026-09" → "Sentabr 2026" */
export function davrNomi(davr: string): string {
  const [y, m] = davr.split('-')
  const oy = OYLAR[Number(m) - 1]
  if (!oy) return davr
  return `${oy[0].toUpperCase()}${oy.slice(1)} ${y}`
}

/** "2026-09" → "Sen" */
export function davrQisqa(davr: string): string {
  const m = Number(davr.split('-')[1])
  return OYLAR_QISQA[m - 1] ?? davr
}

/**
 * Joriy davr: "2026-09" — Toshkent vaqti bilan. Server UTC'da turadi:
 * getMonth() bilan yarim tundan keyin 5 soat eski oy chiqardi.
 */
export function joriyDavr(d: Date = new Date()): string {
  return bugunToshkent(d).slice(0, 7)
}

/** Telefonni o'qishga qulay ko'rinishga keltiradi */
export function telefon(t: string | null | undefined): string {
  if (!t) return '—'
  const raqam = t.replace(/\D/g, '')
  if (raqam.length === 12 && raqam.startsWith('998')) {
    return `+${raqam.slice(0, 3)} ${raqam.slice(3, 5)} ${raqam.slice(5, 8)} ${raqam.slice(8, 10)} ${raqam.slice(10)}`
  }
  if (raqam.length === 9) {
    return `+998 ${raqam.slice(0, 2)} ${raqam.slice(2, 5)} ${raqam.slice(5, 7)} ${raqam.slice(7)}`
  }
  return t
}

/** Saqlash uchun normal ko'rinish: "+998901234567" */
export function telefonNormal(t: string): string | null {
  const raqam = t.replace(/\D/g, '')
  if (raqam.length === 9) return `+998${raqam}`
  if (raqam.length === 12 && raqam.startsWith('998')) return `+${raqam}`
  return null
}

/** Ismdan bosh harflar: "Anvarbekov Amirxan" → "AA" */
export function bosh(ism: string): string {
  return ism
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('')
}

/** "08:30:00" → "08:30" */
export function vaqt(t: string | null | undefined): string {
  if (!t) return '—'
  return t.slice(0, 5)
}

/** Guruh jadvali: "08:30–10:00, Du · Ch · Ju". Eski yozuvlar uchun kun turi ham qabul qilinadi. */
export function jadval(
  boshlanish: string | null,
  tugash: string | null,
  kunlar: readonly number[] | DayType | null,
): string {
  const kun = Array.isArray(kunlar) ? kunlarNomi(kunlar) : KUN_NOMI[(kunlar as DayType | null) ?? 'har_kuni']
  if (!boshlanish || !tugash) return kun
  return `${vaqt(boshlanish)}–${vaqt(tugash)}, ${kun}`
}

/** Hafta kunlari — ISO tartibida (1 = dushanba … 7 = yakshanba), bazadagi groups.kunlar bilan bir xil. */
export const HAFTA_KUNLARI = [
  { raqam: 1, qisqa: 'Du', nom: 'Dushanba' },
  { raqam: 2, qisqa: 'Se', nom: 'Seshanba' },
  { raqam: 3, qisqa: 'Ch', nom: 'Chorshanba' },
  { raqam: 4, qisqa: 'Pa', nom: 'Payshanba' },
  { raqam: 5, qisqa: 'Ju', nom: 'Juma' },
  { raqam: 6, qisqa: 'Sh', nom: 'Shanba' },
  { raqam: 7, qisqa: 'Ya', nom: 'Yakshanba' },
] as const

/** [1, 3, 5] → "Du · Ch · Ju" */
export function kunlarNomi(kunlar: readonly number[] | null | undefined): string {
  if (!kunlar?.length) return '—'
  return [...kunlar]
    .sort((a, b) => a - b)
    .map((k) => HAFTA_KUNLARI[k - 1]?.qisqa ?? '?')
    .join(' · ')
}

/** "2026-09-30" → ISO hafta kuni (1 = dushanba … 7 = yakshanba). Sana UTC'da o'qiladi — vaqt mintaqasi siljitmaydi. */
export function haftaKuni(isoSana: string): number {
  const d = new Date(`${isoSana}T00:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

/**
 * Bugun — Toshkent vaqti bilan, "YYYY-MM-DD".
 * Server qayerda turishidan qat'i nazar, markazning kuni hisoblanadi:
 * UTC bilan yurilsa kechqurungi dars "ertangi" bo'lib qolardi.
 */
export function bugunToshkent(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })
}

/** Shanba ikkala turga kiradi: juft guruh ham, dam olish guruhi ham o'qiydi. */
export const KUN_NOMI: Record<DayType, string> = {
  toq: 'toq kun',
  juft: 'juft kun',
  dam_olish: 'dam olish kunlari',
  har_kuni: 'har kuni',
}

/** Ketish sabablari (0083, Jamshid 13.10) — students.ketish_sababi */
export const KETISH_SABABLARI = {
  narx: 'Narx qimmat',
  ustoz: 'Ustoz yoqmadi',
  vaqt: 'Vaqt to‘g‘ri kelmadi',
  kochdi: 'Ko‘chib ketdi',
  natija: 'Natija yo‘q',
  boshqa_markaz: 'Boshqa markazga o‘tdi',
  boshqa: 'Boshqa',
} as const

export type KetishSababi = keyof typeof KETISH_SABABLARI

export function ketishNomi(s: string | null | undefined): string {
  return s && s in KETISH_SABABLARI ? KETISH_SABABLARI[s as KetishSababi] : 'Belgilanmagan'
}

/** ketish_tahlili() natijasi */
export type KetishTahlili = {
  jami: number
  boshida: number
  yangi: number
  koeffitsient: number | null
  yoqotilgan: number
  orta_oy: number | null
  sabablar: { sabab: string; soni: number }[]
  ustozlar: { ism: string; soni: number }[]
  fanlar: { nom: string; soni: number }[]
  royxat: { id: string; fish: string; sana: string; sabab: string; izoh: string | null }[]
}

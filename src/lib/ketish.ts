/** Ketish sabablari (0083, Jamshid 13.10) — students.ketish_sababi */
import { royxatNomi, type RoyxatBand } from '@/lib/royxat'

export function ketishNomi(s: string | null | undefined, royxat: RoyxatBand[]): string {
  return !s || s === 'belgilanmagan' ? 'Belgilanmagan' : royxatNomi(royxat, s)
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

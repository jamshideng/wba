/**
 * Sozlanadigan ro'yxatlar (0108): lid manbasi, xarajat toifasi, ketish va
 * woblar sababi. Yozuvlar kalitni saqlaydi, ko'rinadigan nom shu jadvaldan.
 */

export type RoyxatTur = 'lid_manba' | 'xarajat_toifa' | 'ketish_sabab' | 'woblar_sabab'

export type RoyxatBand = { kalit: string; nom: string; faol: boolean; tizim: boolean; tartib: number }

export const ROYXAT_NOMI: Record<RoyxatTur, { nom: string; izoh: string }> = {
  lid_manba: { nom: 'Lid manbasi', izoh: 'Lid qayerdan keldi' },
  xarajat_toifa: { nom: 'Xarajat toifalari', izoh: 'Xarajat qo‘shishda tanlanadi' },
  ketish_sabab: { nom: 'Ketish sabablari', izoh: 'Arxivlash va ketish tahlili' },
  woblar_sabab: { nom: 'Woblar sabablari', izoh: 'Woblar berishda tanlanadi' },
}

export const ROYXAT_TURLARI = Object.keys(ROYXAT_NOMI) as RoyxatTur[]

type Oquvchi = {
  from: (jadval: 'royxatlar') => {
    select: (ustunlar: string) => {
      eq: (ustun: 'tur', qiymat: string) => {
        order: (ustun: 'tartib') => { order: (ustun: 'nom') => PromiseLike<{ data: unknown }> }
      }
    }
  }
}

/** Bitta ro'yxat: tartib bo'yicha, yashirilganlari bilan */
export async function royxatOl(db: unknown, tur: RoyxatTur): Promise<RoyxatBand[]> {
  const { data } = await (db as Oquvchi)
    .from('royxatlar')
    .select('kalit, nom, faol, tizim, tartib')
    .eq('tur', tur)
    .order('tartib')
    .order('nom')
  return (data ?? []) as RoyxatBand[]
}

/** Kalit → nom. Topilmasa kalitning o'zi (yozuv yo'qolib ketmasin) */
export function royxatNomi(royxat: RoyxatBand[], kalit: string | null | undefined): string {
  if (!kalit) return ''
  return royxat.find((b) => b.kalit === kalit)?.nom ?? kalit
}

/** Tanlash uchun: faollari va joriy qiymat (yashirilgan bo'lsa ham, tahrirda yo'qolmasin) */
export function royxatVariantlari(royxat: RoyxatBand[], joriy?: string | null): RoyxatBand[] {
  return royxat.filter((b) => b.faol || b.kalit === joriy)
}

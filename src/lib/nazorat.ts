import 'server-only'
import { tg, html } from '@/lib/telegram'
import type { createClient } from '@/lib/supabase/server'
import type { createAdminClient } from '@/lib/supabase/admin'

/** nazorat_hodisalar.turi (0077) — nomi, kimning ishi va ogohlantirish shabloni */
export const NAZORAT_TURLAR = {
  ustoz_kechikdi: { nom: 'Kechikdi', kim: 'ustoz', shablon: 'darsga kechikdingiz' },
  davomat_qilinmadi: { nom: 'Davomat qilinmadi', kim: 'ustoz', shablon: 'dars davomatini qilmadingiz' },
  oquvchi_3_kelmadi: { nom: 'O‘quvchi 3 dars kelmadi', kim: 'ustoz', shablon: 'ketma-ket 3 dars kelmagan o‘quvchi bilan bog‘lanmadingiz' },
  woblar_berilmadi: { nom: 'Woblar berilmadi', kim: 'ustoz', shablon: 'darsda o‘quvchilarga woblar bermadingiz' },
  lid_qongiroq: { nom: 'Lidga qo‘ng‘iroq kechikdi', kim: 'xodim', shablon: 'lidga belgilangan vaqtda qo‘ng‘iroq qilmadingiz' },
  vazifa_muddati: { nom: 'Vazifa muddati o‘tdi', kim: 'xodim', shablon: 'vazifani muddatida bajarmadingiz' },
  qarzdor_eslatilmadi: { nom: 'Qarzdorga eslatilmadi', kim: 'xodim', shablon: 'qarzdor o‘quvchiga oy davomida to‘lovni eslatmadingiz' },
  tolov_kech: { nom: 'To‘lov kech kiritildi', kim: 'xodim', shablon: 'to‘lovni kech kiritdingiz' },
  tolov_tasdiqlanmadi: { nom: 'To‘lov tasdiqlanmagan', kim: 'xodim', shablon: 'to‘lov uzoq vaqt tasdiqlanmay turibdi' },
} as const

export type NazoratTuri = keyof typeof NAZORAT_TURLAR

export type NazoratHodisa = {
  id: number
  turi: NazoratTuri
  sana: string
  teacher_id: string | null
  profile_id: string | null
  tafsilot: string
  holat: 'yangi' | 'ogohlantirildi' | 'yopildi'
  yopish_izoh: string | null
  created_at: string
  teachers: { ism: string } | null
  profiles: { ism: string } | null
}

/** Tayyor ogohlantirish matni — manager xohlasa o'zgartiradi */
export function ogohlantirishMatni(h: Pick<NazoratHodisa, 'turi' | 'sana' | 'tafsilot'>, ism: string): string {
  const [y, m, d] = h.sana.split('-')
  return `Hurmatli ${ism}, ${d}.${m}.${y} kuni ${NAZORAT_TURLAR[h.turi].shablon} (${h.tafsilot}). Iltimos, bunday holat takrorlanmasin. Bir oyda 3 ta ogohlantirishdan keyin jarima qo‘llanadi.`
}

type Klient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>

/** Telegram: ustoz/xodimga yoki (ikkalasi bo'sh) managerlarga. Xato bo'lsa jim — sayt bildirishnomasi bor. */
export async function nazoratTelegram(db: Klient, teacher: string | null, profile: string | null, matn: string): Promise<number> {
  try {
    const { data } = await db.rpc('nazorat_chatlar', { p_teacher: teacher, p_profile: profile })
    let soni = 0
    for (const chat of (data ?? []) as number[]) {
      const r = await tg('sendMessage', { chat_id: chat, text: matn, parse_mode: 'HTML' })
      if (r.ok) soni++
    }
    return soni
  } catch (e) {
    console.error('[nazorat-telegram]', (e as Error).message)
    return 0
  }
}

export { html }

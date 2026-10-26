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
  darslar_kam: { nom: 'Oyda 12 dars yo‘q', kim: 'ustoz', shablon: 'dam kuniga tushgan darsni boshqa kunga ko‘chirib, oyda 12 ta darsni to‘ldirmadingiz' },
} as const

export type NazoratTuri = keyof typeof NAZORAT_TURLAR

export type NazoratHodisa = {
  id: number
  turi: NazoratTuri
  sana: string
  teacher_id: string | null
  profile_id: string | null
  group_id: string | null
  student_id: string | null
  lead_id: string | null
  vazifa_id: string | null
  payment_id: number | null
  kalit: string
  tafsilot: string
  holat: 'yangi' | 'ogohlantirildi' | 'yopildi'
  yopish_izoh: string | null
  created_at: string
  teachers: { ism: string } | null
  profiles: { ism: string } | null
}

export type ManbaHavola = { nom: string; href: string }

/**
 * Hodisaga sabab bo'lgan joy (26.10, Jamshid): birinchisi — asosiy manba,
 * qolganlari — bog'liq sahifalar. `b=` — o'sha sahifada rang bilan ajratiladi
 * (components/belgila.tsx).
 */
export function nazoratManba(h: Pick<NazoratHodisa, 'turi' | 'sana' | 'group_id' | 'student_id' | 'lead_id' | 'vazifa_id' | 'payment_id' | 'teacher_id' | 'kalit'>): ManbaHavola[] {
  const oy = h.sana.slice(0, 7)
  const jurnal = (b: string, davr = oy) => `/crm/davomat/${h.group_id}?oy=${davr}&b=${b}`
  const qoshimcha: ManbaHavola[] = []
  if (h.student_id && h.turi !== 'qarzdor_eslatilmadi') qoshimcha.push({ nom: 'O‘quvchi profili', href: `/crm/oquvchilar/${h.student_id}` })
  if (h.group_id) qoshimcha.push({ nom: 'Guruh', href: `/crm/guruhlar/${h.group_id}` })
  switch (h.turi) {
    case 'ustoz_kechikdi': {
      const id = h.kalit.startsWith('kech:') ? h.kalit.slice(5) : null
      const qs = new URLSearchParams({ oy })
      if (h.teacher_id) qs.set('ustoz', h.teacher_id)
      if (id) qs.set('b', `kech:${id}`)
      return [{ nom: 'Ustozlar davomati', href: `/crm/ustoz-davomati?${qs}` }, ...qoshimcha]
    }
    case 'davomat_qilinmadi':
    case 'woblar_berilmadi':
      return h.group_id ? [{ nom: 'Davomat jurnali — o‘sha kun', href: jurnal(`kun:${h.sana}`) }, ...qoshimcha] : qoshimcha
    case 'oquvchi_3_kelmadi':
      return h.group_id && h.student_id
        ? [{ nom: 'Davomat jurnali — kelmagan darslar', href: jurnal(`oq:${h.student_id},kelmadi:${h.student_id}`) }, ...qoshimcha]
        : qoshimcha
    case 'darslar_kam': {
      // kalit: kam:<guruh>:<davr>
      const davr = h.kalit.split(':')[2] ?? oy
      return h.group_id ? [{ nom: 'Davomat jurnali — dam kunlari', href: jurnal('dam', davr) }, ...qoshimcha] : qoshimcha
    }
    case 'lid_qongiroq':
      return [
        ...(h.lead_id ? [{ nom: 'Lid kartasi', href: `/crm/lidlar?b=lid:${h.lead_id}` }] : []),
        ...(h.vazifa_id ? [{ nom: 'Vazifa', href: `/crm/vazifalar?id=${h.vazifa_id}&b=vaz:${h.vazifa_id}` }] : []),
      ]
    case 'vazifa_muddati':
      return h.vazifa_id ? [{ nom: 'Vazifa', href: `/crm/vazifalar?id=${h.vazifa_id}&b=vaz:${h.vazifa_id}` }, ...qoshimcha] : qoshimcha
    case 'tolov_kech':
    case 'tolov_tasdiqlanmadi':
      return h.payment_id ? [{ nom: `To‘lov #${h.payment_id}`, href: `/crm/tolovlar?id=${h.payment_id}&b=tol:${h.payment_id}` }, ...qoshimcha] : qoshimcha
    case 'qarzdor_eslatilmadi':
      return h.student_id ? [{ nom: 'O‘quvchi — qarz va to‘lovlar', href: `/crm/oquvchilar/${h.student_id}?b=qarz` }] : []
  }
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

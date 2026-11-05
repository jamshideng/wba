import 'server-only'
import type { createClient } from '@/lib/supabase/server'
import { elonYubor, html, toplamlab } from '@/lib/telegram'
import { shaxsiyMatn, SARLAVHA } from '@/lib/elon'
import type { ElonFiltr, ElonOluvchi, ElonTuri, TelegramKim } from '@/lib/types'

type Baza = Awaited<ReturnType<typeof createClient>>

export type ElonNatija = { xato?: string; jami: number; yetdi: number; yetmadi: number }

/**
 * Telegram e'loni: elonlar qatori → yetkazish qatorlari → 25 tadan parallel
 * yuborish → holatlar. Admin nomidan, RLS bilan (xabarlar va qarz eslatmasi
 * bir xil yo'ldan). Bir chatga bitta o'quvchi haqida bir marta.
 */
export async function telegramElon(
  supabase: Baza,
  e: { turi: ElonTuri; matn: string; kimga: TelegramKim[]; filtr: ElonFiltr },
  auditoriya: ElonOluvchi[],
): Promise<ElonNatija> {
  const { data: elon, error: xatoElon } = await supabase
    .from('elonlar')
    .insert({ turi: e.turi, matn: e.matn, kimga: e.kimga, filtr: e.filtr })
    .select('id')
    .single()
  if (xatoElon || !elon) return { xato: xatoElon?.message ?? 'E’lon yozilmadi', jami: 0, yetdi: 0, yetmadi: 0 }

  const oluvchilar = new Map<string, ElonOluvchi>()
  for (const a of auditoriya) {
    if (a.chat_id) oluvchilar.set(`${a.chat_id}|${a.student_id ?? ''}`, a)
  }

  if (!oluvchilar.size) {
    await supabase.from('elonlar').update({ yuborildi_at: new Date().toISOString() }).eq('id', elon.id)
    return { jami: 0, yetdi: 0, yetmadi: 0 }
  }

  const { data: qatorlar, error: xatoQator } = await supabase
    .from('elon_yetkazish')
    .insert([...oluvchilar.values()].map((a) => ({ elon_id: elon.id, chat_id: a.chat_id!, kim: a.kim, student_id: a.student_id })))
    .select('id, chat_id, student_id')
  if (xatoQator || !qatorlar) return { xato: xatoQator?.message ?? 'Yetkazish yozilmadi', jami: 0, yetdi: 0, yetmadi: 0 }

  const natija = await toplamlab(qatorlar, async (q) => {
    const a = oluvchilar.get(`${q.chat_id}|${q.student_id ?? ''}`)!
    const n = await elonYubor(q.chat_id, `<b>${SARLAVHA[e.turi]}</b>\n\n${html(shaxsiyMatn(e.matn, a))}`)
    return { ...n, id: q.id, chat: q.chat_id }
  })

  const vaqt = new Date().toISOString()
  const yetdi = natija.filter((n) => n.holat === 'yetkazildi')
  if (yetdi.length) {
    await supabase.from('elon_yetkazish').update({ holat: 'yetkazildi', yuborildi_at: vaqt }).in('id', yetdi.map((n) => n.id))
  }
  for (const n of natija.filter((x) => x.holat !== 'yetkazildi')) {
    await supabase.from('elon_yetkazish').update({ holat: n.holat, xato_matn: n.xato ?? null, yuborildi_at: vaqt }).eq('id', n.id)
    if (n.holat === 'bloklagan') await supabase.rpc('telegram_bloklagan', { p_chat: n.chat })
  }

  const yetmadi = natija.length - yetdi.length
  await supabase
    .from('elonlar')
    .update({ yuborildi_at: vaqt, jami: natija.length, yetkazildi: yetdi.length, xato: yetmadi })
    .eq('id', elon.id)

  return { jami: natija.length, yetdi: yetdi.length, yetmadi }
}

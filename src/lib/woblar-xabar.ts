import 'server-only'
import { pushYubor, type PushObuna } from '@/lib/push'
import { tg, html } from '@/lib/telegram'
import type { createClient } from '@/lib/supabase/server'

/**
 * Woblar berilgach o'quvchiga xabar (0071): telefon (push) va Telegram.
 * Saytdagi bildirishnomani baza triggeri o'zi yozadi — bu yerda faqat
 * tashqi kanallar. Bir kunda bitta xabar: push shu teg bilan almashadi,
 * Telegram'dagi oldingi xabar tahrirlanadi (yangisi yuborilmaydi).
 *
 * `after()` ichida chaqiriladi — ustozning ekrani kutib qolmaydi.
 * Xato bo'lsa jim o'tadi: woblar baribir yozilgan.
 */

type Manzil = {
  sarlavha: string
  matn: string
  push: PushObuna[]
  tg: { chat: number; msg: number | null }[]
}

export async function woblarXabariniYubor(supabase: Awaited<ReturnType<typeof createClient>>, studentId: string) {
  try {
    const { data, error } = await supabase.rpc('woblr_xabar_manzil', { p_student: studentId })
    if (error || !data) return
    const m = data as Manzil

    const { eskirgan } = await pushYubor(m.push, {
      sarlavha: m.sarlavha,
      matn: m.matn,
      havola: '/crm/woblr/tarix',
      teg: `woblar-${studentId}`,
    })
    for (const e of eskirgan) await supabase.rpc('woblr_push_eskirgan', { p_student: studentId, p_endpoint: e })

    const matn = `<b>${html(m.sarlavha)}</b>\n${html(m.matn)}`
    for (const c of m.tg) {
      if (c.msg) {
        const r = await tg('editMessageText', { chat_id: c.chat, message_id: c.msg, text: matn, parse_mode: 'HTML' })
        // "message is not modified" ham muvaffaqiyat; boshqa xatoda — yangi xabar
        if (r.ok || /not modified/i.test(r.description)) continue
      }
      const r = await tg<{ message_id: number }>('sendMessage', { chat_id: c.chat, text: matn, parse_mode: 'HTML' })
      if (r.ok) await supabase.rpc('woblr_xabar_tg_saqla', { p_student: studentId, p_chat: c.chat, p_msg: r.result.message_id })
    }
  } catch (e) {
    console.error('[woblar-xabar]', studentId, (e as Error).message)
  }
}

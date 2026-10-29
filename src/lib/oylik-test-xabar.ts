import 'server-only'
import { pushYubor, type PushObuna } from '@/lib/push'
import { tg, html } from '@/lib/telegram'
import type { createClient } from '@/lib/supabase/server'

/**
 * Oylik test natijasi e'lon qilingach o'quvchi va ota-onaga (0104):
 * telefon (push) va Telegram. Saytga kirganda chiqadigan eslatmani
 * baza triggeri o'zi yozadi — bu yerda faqat tashqi kanallar.
 * Har natijaga bir marta (oylik_xabar_manzil o'zi belgilaydi).
 *
 * `after()` ichida chaqiriladi — admin ekrani kutib qolmaydi.
 * Xato bo'lsa jim o'tadi: e'lon baribir qilingan.
 */

type Manzil = {
  student: string
  sarlavha: string
  matn: string
  push: PushObuna[]
  tg: number[]
}

/* Lokal baza (127.0.0.1) — prod nusxasi: unda haqiqiy chat ID'lar bo'lishi mumkin,
   .env.local da esa haqiqiy bot tokeni. Lokal sinovda tashqariga xabar ketmasin. */
const lokal = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').includes('127.0.0.1')

export async function oylikXabarYubor(supabase: Awaited<ReturnType<typeof createClient>>, natijaIdlar: string[]) {
  for (const id of natijaIdlar) {
    try {
      const { data, error } = await supabase.rpc('oylik_xabar_manzil', { p_natija: id })
      if (error || !data) continue
      const m = data as Manzil
      if (lokal) {
        console.info('[oylik-test-xabar] lokal — yuborilmadi:', m.student, `push ${m.push.length}, tg ${m.tg.length}`, m.matn)
        continue
      }

      await pushYubor(m.push, {
        sarlavha: m.sarlavha,
        matn: m.matn,
        havola: '/crm',
        teg: `oylik-test-${id}`,
      })

      const matn = `<b>${html(m.sarlavha)}</b>\n${html(m.matn)}`
      for (const chat of m.tg) {
        await tg('sendMessage', { chat_id: chat, text: matn, parse_mode: 'HTML' })
      }
    } catch (e) {
      console.error('[oylik-test-xabar]', id, (e as Error).message)
    }
  }
}

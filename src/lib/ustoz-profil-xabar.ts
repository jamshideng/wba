import 'server-only'
import { tg, html } from '@/lib/telegram'
import { saytManzil } from '@/lib/markaz'

/**
 * Ustoz profili xabarlari Telegram'ga (0126). Kimga — bazadagi funksiya
 * hal qiladi (ustoz o'zgartirsa admin/managerlarga, rahbariyat o'zgartirsa
 * ustozga; tasdiq/qaytarish — ustozga). Saytdagi bildirishnomani baza
 * o'zi yozadi. after() ichida — xato bo'lsa jim o'tadi.
 */
export type TgManzil = { chat: number; sarlavha: string; matn?: string; havola?: string }

export async function ustozProfilTgYubor(royxat: TgManzil[] | null | undefined) {
  const sayt = saytManzil()
  for (const x of royxat ?? []) {
    try {
      const qator = [`<b>${html(x.sarlavha)}</b>`]
      if (x.matn) qator.push(html(x.matn))
      const havola = x.havola ?? '/crm/malumotlarim'
      await tg('sendMessage', {
        chat_id: x.chat,
        text: qator.join('\n'),
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: 'Ochish', url: `${sayt}${havola}` }]] },
      })
    } catch (e) {
      console.error('[ustoz-profil-xabar]', (e as Error).message)
    }
  }
}

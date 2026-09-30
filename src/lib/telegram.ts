import 'server-only'

/**
 * @WBAlcBot — Telegram Bot API bilan ishlash (faqat server).
 *
 * Token faqat muhit o'zgaruvchisida (TELEGRAM_BOT_TOKEN), kodga yozilmaydi.
 * Bot 20.09 da Apps Script'dan shu loyihaga ko'chdi: webhook —
 * /api/telegram, ma'lumot — Sheets emas, shu baza.
 */

export const BOT_NOMI = process.env.TELEGRAM_BOT_USERNAME || 'WBAlcBot'

/** "WBA Hisobot" guruhi — kunlik hisobot, guruh buyruqlari va saytdagi arizalar shu yerga. */
export const HISOBOT_GURUH = process.env.TELEGRAM_GROUP_ID || '-1003908526489'

type TgJavob<T> = { ok: true; result: T } | { ok: false; error_code: number; description: string; parameters?: { retry_after?: number } }

export async function tg<T = unknown>(metod: string, body: Record<string, unknown>): Promise<TgJavob<T>> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { ok: false, error_code: 0, description: 'TELEGRAM_BOT_TOKEN sozlanmagan' }
  const boshi = Date.now()
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${metod}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      // Telegram javob bermasa webhook osilib qolmasin
      signal: AbortSignal.timeout(8000),
    })
    const j = (await r.json()) as TgJavob<T>
    if (!j.ok) console.error('[telegram]', metod, j.error_code, j.description, `${Date.now() - boshi}ms`)
    return j
  } catch (e) {
    const matn = e instanceof Error ? e.message : String(e)
    console.error('[telegram]', metod, 'ulanmadi:', matn, `${Date.now() - boshi}ms`)
    return { ok: false, error_code: -1, description: matn }
  }
}

/** Telegram HTML rejimi uchun: foydalanuvchi matnidagi <, >, & buzmasin. */
export function html(s: string | number | null | undefined): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export type Tugma = { text: string; callback_data?: string; url?: string }

export function xabar(chat: number, matn: string, tugmalar?: Tugma[][]) {
  return tg('sendMessage', {
    chat_id: chat,
    text: matn,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(tugmalar ? { reply_markup: { inline_keyboard: tugmalar } } : {}),
  })
}

export type YuborishNatija = { holat: 'yetkazildi' | 'xato' | 'bloklagan'; xato?: string }

/**
 * E'lon uchun bitta xabar: 429 (juda tez) bo'lsa bir marta kutib qayta
 * urinadi; 403 (botni bloklagan / chat yo'q) — "bloklagan".
 */
export async function elonYubor(chat: number, matn: string): Promise<YuborishNatija> {
  for (let urinish = 0; urinish < 2; urinish++) {
    const r = await xabar(chat, matn)
    if (r.ok) return { holat: 'yetkazildi' }
    if (r.error_code === 429 && urinish === 0) {
      await new Promise((ok) => setTimeout(ok, ((r.parameters?.retry_after ?? 1) + 0.2) * 1000))
      continue
    }
    if (r.error_code === 403 || /chat not found|bot was blocked|user is deactivated/i.test(r.description)) {
      return { holat: 'bloklagan', xato: r.description }
    }
    return { holat: 'xato', xato: r.description }
  }
  return { holat: 'xato', xato: '429: qayta urinish ham o‘tmadi' }
}

/** Telegram cheklovi — sekundiga ~30 xabar. 25 tadan parallel, har to'plam kamida 1 soniya. */
export async function toplamlab<T, N>(royxat: T[], ish: (x: T) => Promise<N>, hajm = 25): Promise<N[]> {
  const natija: N[] = []
  for (let i = 0; i < royxat.length; i += hajm) {
    const boshi = Date.now()
    natija.push(...(await Promise.all(royxat.slice(i, i + hajm).map(ish))))
    const qoldi = 1000 - (Date.now() - boshi)
    if (i + hajm < royxat.length && qoldi > 0) await new Promise((ok) => setTimeout(ok, qoldi))
  }
  return natija
}

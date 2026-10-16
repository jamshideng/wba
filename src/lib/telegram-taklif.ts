/** Admin taklif havolalari (0072) — sahifada bir marta ko'rsatish uchun qisqa muddatli cookie. */
export const TAKLIF_COOKIE = 'wba_tg_taklif'

export type TaklifKim = 'oquvchi' | 'ota_ona'
export type Taklif = { student_id: string; fish: string; kim: TaklifKim; havola: string }

/** WhatsApp/SMS ga yuboriladigan tayyor matn */
export function taklifMatni(t: Taklif): string {
  return t.kim === 'ota_ona'
    ? `Assalomu alaykum! World Bridge Academy: ${t.fish} ning qarzi, darslari, davomati va woblari Telegram botda keladi. Ulanish uchun havolani bosing va Start ni bosing (7 kun amal qiladi): ${t.havola}`
    : `Salom, ${t.fish}! World Bridge Academy botiga ulan — woblar, darslar va e'lonlar Telegramda keladi. Havolani bosib Start ni bos (7 kun amal qiladi): ${t.havola}`
}

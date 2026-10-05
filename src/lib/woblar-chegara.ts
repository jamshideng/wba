/**
 * Bir martada beriladigan woblar chegarasi (0057).
 * Ustoz: −10…+10. Admin/direktor: chegara yo'q — faqat xato bilan ortiqcha
 * nol yozilmasin deb ±100 000 (bazadagi CHECK bilan bir xil).
 * Bazada ham tekshiriladi (woblr_ustoz_chegara trigger, woblar_ber) — bu
 * yerda faqat formani oldindan to'xtatish va to'g'ri xabar uchun.
 */
export const USTOZ_WOBLAR = 10
export const ADMIN_WOBLAR = 100_000

export function woblarChegara(admin: boolean): number {
  return admin ? ADMIN_WOBLAR : USTOZ_WOBLAR
}

/** null — to'g'ri; aks holda foydalanuvchiga xato matni */
export function woblarXato(ball: number, admin: boolean): string | null {
  const max = woblarChegara(admin)
  if (!Number.isInteger(ball) || ball === 0) return 'Woblar butun son bo‘lsin, 0 emas.'
  if (ball < -max || ball > max) return admin ? 'Woblar juda katta — xato yozilmadimi?' : 'Woblar −10 dan +10 gacha bo‘lsin, 0 emas.'
  return null
}

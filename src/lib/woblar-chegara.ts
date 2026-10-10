/**
 * Bir martada beriladigan woblar chegarasi.
 * 0064 dan: ustozda ham ±10 yo'q — uning cheklovi OYLIK limit (guruh bo'yicha,
 * bazada woblr_guruh_limit trigger tekshiradi). Bu yerda faqat xato bilan
 * ortiqcha nol yozilmasin deb ±100 000 (bazadagi CHECK bilan bir xil).
 */
export const ADMIN_WOBLAR = 100_000

export function woblarChegara(): number {
  return ADMIN_WOBLAR
}

/** null — to'g'ri; aks holda foydalanuvchiga xato matni */
export function woblarXato(ball: number): string | null {
  if (!Number.isInteger(ball) || ball === 0) return 'Woblar butun son bo‘lsin, 0 emas.'
  if (ball < -ADMIN_WOBLAR || ball > ADMIN_WOBLAR) return 'Woblar juda katta — xato yozilmadimi?'
  return null
}

/** 0064 · ustoz_woblar_limiti() natijasi */
export type WoblarLimiti = {
  davr: string
  stavka: number
  jami: { limit: number; berilgan: number; qoldi: number }
  guruhlar: { group_id: string; nom: string; limit: number; berilgan: number; qoldi: number }[]
}

/** Dars kunlari sanaga bog'liq (0110): o'tgan kunlar eski jadvalda qoladi. */
export type JadvalQatori = { dan: string; kunlar: number[] }

/** Shu sanada amal qilgan dars kunlari. Tarix bo'lmasa — joriy kunlar. */
export function kunlarSanada(jadval: readonly JadvalQatori[], joriy: readonly number[], sana: string): readonly number[] {
  let topildi: JadvalQatori | null = null
  for (const q of jadval) {
    if (q.dan <= sana && (!topildi || q.dan > topildi.dan)) topildi = q
  }
  return topildi?.kunlar ?? joriy
}

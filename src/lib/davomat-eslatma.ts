/**
 * Davomat eslatmasi (0125) — vaqt qoidasi bitta joyda.
 * Barcha vaqtlar Asia/Tashkent bo'yicha "HH:MM" (yoki "HH:MM:SS").
 */

/** Dars tugaganidan necha daqiqa keyin eslatiladi: 1-eslatma, 2-eslatma */
export const ESLATMA_DAQIQA = { 1: 10, 2: 60 } as const

export type EslatmaTuri = keyof typeof ESLATMA_DAQIQA

const KUN = 24 * 60

/** "09:30" / "09:30:00" → 570 */
export function daqiqa(vaqt: string): number {
  const [s, d] = vaqt.split(':').map(Number)
  return s * 60 + d
}

/**
 * Hozir qaysi eslatma yuborilishi kerak (yoki null).
 *  - darsi yo'q kun — null;
 *  - vaqti kelgan eng katta tur tanlanadi: cron kechiksa ham 1 va 2 birdan ketmaydi;
 *  - shu tur (yoki undan kattasi) yuborilgan bo'lsa — null;
 *  - eslatma vaqti yarim tundan o'tsa — u tur yuborilmaydi (ustoz ertasi kuni
 *    kechagi davomatni kirita olmaydi, 0085).
 */
export function navbatdagiEslatma(p: {
  tugash: string
  hozir: string
  yuborilgan: readonly number[]
  darsBor?: boolean
}): EslatmaTuri | null {
  if (p.darsBor === false) return null
  const tugash = daqiqa(p.tugash)
  const hozir = daqiqa(p.hozir)
  const turlar = (Object.keys(ESLATMA_DAQIQA).map(Number) as EslatmaTuri[]).sort((a, b) => b - a)
  for (const turi of turlar) {
    const vaqt = tugash + ESLATMA_DAQIQA[turi]
    if (vaqt >= KUN || hozir < vaqt) continue
    return p.yuborilgan.some((y) => y >= turi) ? null : turi
  }
  return null
}

/** "08:00:00" → "08:00" */
export function soatMinut(vaqt: string): string {
  return vaqt.slice(0, 5)
}

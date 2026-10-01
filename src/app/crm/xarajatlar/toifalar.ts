/** Xarajat toifalari — bazadagi check (0033) bilan bir xil. */
export const TOIFALAR = {
  ijara: 'Ijara',
  maosh: 'Maosh',
  kommunal: 'Kommunal',
  reklama: 'Reklama',
  jihoz: 'Jihoz',
  ofis: 'Ofis va kanstovar',
  soliq: 'Soliq',
  boshqa: 'Boshqa',
} as const

export type Toifa = keyof typeof TOIFALAR

export function toifami(v: unknown): v is Toifa {
  return typeof v === 'string' && v in TOIFALAR
}

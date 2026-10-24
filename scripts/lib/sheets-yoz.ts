/**
 * Students_wba ga YOZISH qatlami (sinxron uchun, 14.10).
 *
 * Faqat qo'lda kiritiladigan (sariq) kataklarga yoziladi — formula
 * ustunlariga hech qachon tegilmaydi. Ustun raqami sarlavha NOMI bo'yicha
 * topiladi: sarlavha topilmasa — xato, hech narsa yozilmaydi (10.10 dagi
 * "ID" o'rniga "xa" hodisasi takrorlanmasin).
 */

import { google, type sheets_v4 } from 'googleapis'
import { normKalit, type Varaq } from './sheets'

export type Katak = { varaq: string; qator: number; ustun: number; qiymat: string | number | boolean | null }

export async function yozuvchi(): Promise<sheets_v4.Sheets> {
  const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
  return google.sheets({ version: 'v4', auth: (await auth.getClient()) as never })
}

/** Sarlavha nomi → 1-asosli ustun raqami. Topilmasa — xato. */
export function ustun(v: Varaq, nom: string): number {
  const i = v.sarlavha.findIndex((s) => normKalit(s) === normKalit(nom))
  if (i < 0) throw new Error(`"${v.nom}" varag'ida "${nom}" ustuni topilmadi (sarlavha o'zgarganmi?)`)
  return i + 1
}

export function harf(n: number): string {
  let s = ''
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

const KUN0 = Date.UTC(1899, 11, 30)

/** "2026-10-14" → Sheets sana seriyasi */
export function sanaSeriya(iso: string | null): number | null {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return (Date.UTC(y, m - 1, d) - KUN0) / 86400000
}

/** ISO vaqt → Sheets seriyasi, Toshkent vaqtida */
export function vaqtSeriya(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  return Math.round(((ms + 5 * 3600000 - KUN0) / 86400000) * 1e6) / 1e6
}

/** +998998252446 → +998-99-825-24-46 (Sheets'dagi ko'rinish) */
export function telefonSheets(t: string | null): string | null {
  if (!t) return null
  const r = t.replace(/\D/g, '')
  if (r.length !== 12) return t
  return `+${r.slice(0, 3)}-${r.slice(3, 5)}-${r.slice(5, 8)}-${r.slice(8, 10)}-${r.slice(10, 12)}`
}

const USUL_NOMI: Record<string, string> = { naqd: 'Naqd', terminal: 'Terminal', click: 'Click', payme: 'Payme' }
export const usulSheets = (u: string | null) => (u ? (USUL_NOMI[u] ?? u) : null)

/** Kataklarni bitta so'rov bilan yozadi (RAW — Sheets o'zi talqin qilmaydi). */
export async function kataklarniYoz(sh: sheets_v4.Sheets, id: string, kataklar: Katak[]) {
  if (!kataklar.length) return
  await sh.spreadsheets.values.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      valueInputOption: 'RAW',
      data: kataklar.map((k) => ({
        range: `'${k.varaq.replace(/'/g, "''")}'!${harf(k.ustun)}${k.qator}`,
        values: [[k.qiymat ?? '']],
      })),
    },
  })
}

/** Yozishdan oldin: shu qatorlarning kalit katagi hali ham bo'shmi (bot ayni paytda yozmadimi). */
export async function bosh(sh: sheets_v4.Sheets, id: string, varaq: string, ust: number, qatorlar: number[]): Promise<boolean> {
  if (!qatorlar.length) return true
  const r = await sh.spreadsheets.values.batchGet({
    spreadsheetId: id,
    ranges: qatorlar.map((q) => `'${varaq.replace(/'/g, "''")}'!${harf(ust)}${q}`),
  })
  return (r.data.valueRanges ?? []).every((v) => String(v.values?.[0]?.[0] ?? '').trim() === '')
}

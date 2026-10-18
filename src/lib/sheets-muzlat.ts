import 'server-only'
import { google } from 'googleapis'

/**
 * SHEETS INTEGRATSIYASINI MUZLATISH (0084, Jamshid 18.10).
 *
 * Hech narsa o'chirilmaydi — bitta tugma bilan qaytariladi:
 *   * Students_wba ning eski varaqlariga himoya (tavsifi WBA_MUZLATISH):
 *     faqat service account yozadi, qolganlar ko'radi. Egasi baribir
 *     tahrirlay oladi (Google qoidasi).
 *   * BAZA_ varaqlari (ko'zgu) va WBA_Holat himoyalanmaydi.
 *   * WBA_Holat!A1 — Apps Script shu katakdan o'qiydi: "MUZLATILGAN"
 *     bo'lsa 19:40 hisoboti va maslahatni yubormaydi.
 * Qaytarishda himoyalar olinadi, A1 = "ISHLAYAPTI".
 */

const TAVSIF = 'WBA_MUZLATISH'
const HOLAT = 'WBA_Holat'

function auth() {
  const xom = process.env.GOOGLE_SA_JSON
  const scopes = ['https://www.googleapis.com/auth/spreadsheets']
  if (xom) return new google.auth.GoogleAuth({ credentials: JSON.parse(xom), scopes })
  return new google.auth.GoogleAuth({ keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS, scopes })
}

export type MuzlatNatija = { himoyalangan: number; olingan: number; varaqlar: string[] }

export async function sheetsniMuzlat(muzlat: boolean, jadvalId?: string): Promise<MuzlatNatija> {
  const id = jadvalId ?? process.env.KOZGU_SHEETS_ID ?? process.env.SHEETS_ID
  if (!id) throw new Error('KOZGU_SHEETS_ID sozlanmagan')
  const a = auth()
  const email = (await a.getCredentials()).client_email
  if (!email) throw new Error('Service account email topilmadi')
  const sheets = google.sheets({ version: 'v4', auth: a })

  const { data } = await sheets.spreadsheets.get({
    spreadsheetId: id,
    fields: 'sheets(properties(sheetId,title),protectedRanges(protectedRangeId,description,range))',
  })
  const varaqlar = data.sheets ?? []
  const so: object[] = []
  let himoyalangan = 0
  let olingan = 0

  // Holat varag'i — yo'q bo'lsa ochiladi
  if (!varaqlar.some((v) => v.properties?.title === HOLAT)) {
    so.push({ addSheet: { properties: { title: HOLAT, hidden: false } } })
  }

  // Ko'zgu (BAZA_), holat va Apps Script log varag'i himoyalanmaydi
  const eski = varaqlar.filter((v) => {
    const t = v.properties?.title ?? ''
    return !t.startsWith('BAZA_') && t !== HOLAT && t !== '_Bot_log'
  })
  /* Butun varaqqa qo'yilgan himoya (diapazonsiz) — bunday varaqqa ikkinchisini qo'yib
     bo'lmaydi; u allaqachon yopiq (masalan "Xodimlar — faqat egasi") */
  const butun = (r: { startRowIndex?: number | null; endRowIndex?: number | null; startColumnIndex?: number | null; endColumnIndex?: number | null } | undefined) =>
    !!r && r.startRowIndex == null && r.endRowIndex == null && r.startColumnIndex == null && r.endColumnIndex == null
  for (const v of eski) {
    const bizniki = (v.protectedRanges ?? []).filter((p) => p.description === TAVSIF)
    const yopiq = (v.protectedRanges ?? []).some((p) => p.description !== TAVSIF && butun(p.range ?? undefined))
    if (muzlat && bizniki.length === 0 && !yopiq) {
      so.push({
        addProtectedRange: {
          protectedRange: { range: { sheetId: v.properties!.sheetId }, description: TAVSIF, warningOnly: false, editors: { users: [email] } },
        },
      })
      himoyalangan++
    }
    if (!muzlat) {
      for (const p of bizniki) {
        so.push({ deleteProtectedRange: { protectedRangeId: p.protectedRangeId } })
        olingan++
      }
    }
  }

  if (so.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: so } })

  const vaqt = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${HOLAT}!A1:B2`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        [muzlat ? 'MUZLATILGAN' : 'ISHLAYAPTI', vaqt],
        [muzlat ? 'Ish saytda (wbalc.uz). Eski varaqlar faqat ko‘rish uchun. Qaytarish — sayt → Sozlamalar.' : 'Sheets integratsiyasi ishlayapti.', ''],
      ],
    },
  })

  return { himoyalangan, olingan, varaqlar: eski.map((v) => v.properties?.title ?? '') }
}

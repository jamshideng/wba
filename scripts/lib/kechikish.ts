/**
 * "Ustoz kechikishlari" varag'ini o'qish (Y_UstozKech.js, 06.10.2026).
 * Faqat talqin — tarmoq va baza yo'q, shuning uchun test qilinadi.
 */

import { matn, qiymat, type Qator } from './sheets'
import { sanaga } from './parse'

export const KECHIKISH_VARAQ = 'Ustoz kechikishlari'

export type KechikishQator = {
  sheets_id: string
  sana: string
  group_id: string | null
  teacher_id: string
  daqiqa: number
  sabab: string | null
  kiritilgan: string | null
}

/** Sheets sana-vaqt seriyasi (Toshkent vaqti) → ISO timestamptz. */
export function sanaVaqtga(v: unknown): string | null {
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    const mahalliy = Math.round((v - 25569) * 86400 * 1000)
    // Seriya Toshkent soatini bildiradi — UTC ga o'tkazish uchun 5 soat ayiriladi
    return new Date(mahalliy - 5 * 3600 * 1000).toISOString()
  }
  const s = String(v ?? '').trim()
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})/)
  if (m) {
    return new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T${m[4].padStart(2, '0')}:${m[5]}:00+05:00`).toISOString()
  }
  return null
}

/**
 * Qatorlarni bazaga tayyorlaydi. Xato qatorlar `xatolar` ga tushadi
 * (ular yozilmaydi, lekin sinxronni to'xtatmaydi).
 */
export function kechikishlarniQur(qatorlar: Qator[]): { royxat: KechikishQator[]; xatolar: string[] } {
  const royxat: KechikishQator[] = []
  const xatolar: string[] = []
  const korildi = new Set<string>()

  for (const q of qatorlar) {
    const guruh = matn(q, 'Guruh')
    if (!guruh) continue
    const id = matn(q, 'ID')
    const sana = sanaga(qiymat(q, 'Sana'))
    const teacher = matn(q, 'Ustoz ID')
    const daqiqa = Number(qiymat(q, 'Kech (daqiqa)'))
    const joy = `${q._qator}-qator (${id || 'ID yo‘q'})`

    if (!/^UK\d{4,}$/.test(id)) { xatolar.push(`${joy}: ID noto‘g‘ri`); continue }
    if (korildi.has(id)) { xatolar.push(`${joy}: ID takrorlangan`); continue }
    if (!sana) { xatolar.push(`${joy}: sana o‘qilmadi`); continue }
    if (!teacher) { xatolar.push(`${joy}: ustoz topilmadi`); continue }
    if (!Number.isInteger(daqiqa) || daqiqa < 1 || daqiqa > 300) { xatolar.push(`${joy}: daqiqa 1–300 bo‘lishi kerak`); continue }

    korildi.add(id)
    royxat.push({
      sheets_id: id,
      sana,
      group_id: matn(q, 'Guruh ID') || null,
      teacher_id: teacher,
      daqiqa,
      sabab: matn(q, 'Sabab / izoh') || null,
      kiritilgan: sanaVaqtga(qiymat(q, 'Kiritilgan')),
    })
  }
  return { royxat, xatolar }
}

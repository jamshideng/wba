import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { xabar } from '@/lib/telegram'
import { bugunToshkent } from '@/lib/format'
import { kunlikHisobotMatn } from '@/lib/kunlik-hisobot'

/**
 * 19:40 — kunlik hisobot "WBA Hisobot" guruhiga (TELEGRAM_GROUP_ID).
 *
 * Chaqiruvchi: Supabase pg_cron + pg_net (0022), har kuni 14:40 UTC.
 * Vercel Hobby cron'i soat ichida istalgan daqiqada ishlaydi — aniq
 * 19:40 kerak bo'lgani uchun jadval bazada.
 *
 * Himoya kalitsiz ham xavfsiz qilingan: hisobot KUNIGA BIR MARTA va
 * faqat 19:35–20:30 (Toshkent) oralig'ida ketadi — begona odam
 * chaqirsa ham, eng ko'pi shu bitta hisobotni bir necha daqiqa oldin
 * yuboradi. Qo'lda sinash (boshqa vaqtda, boshqa chatga) — faqat
 * `Authorization: Bearer <CRON_SIR>` bilan.
 */

export const dynamic = 'force-dynamic'

/* Apps Script ham 19:40 da Sheets hisobotini yuboradi — sarlavha bir xil
   bo'lib adashtirmasin: bu xabar saytdagi bazadan ekani boshida yoziladi. */
const SAYT_BELGISI = '<b>[BAZA · sayt]</b> — saytdagi baza, Sheets emas\n\n'

export async function POST(req: NextRequest) {
  const sir = process.env.CRON_SIR
  const qolda = Boolean(sir) && req.headers.get('authorization') === `Bearer ${sir}`
  const body = (await req.json().catch(() => ({}))) as { chat_id?: number }

  const kun = bugunToshkent()
  const soat = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Tashkent', hour12: false }).slice(0, 5)

  if (!qolda && (soat < '19:35' || soat > '20:30')) {
    return NextResponse.json({ ok: false, sabab: `vaqt emas (${soat})` }, { status: 202 })
  }

  const chat = qolda && body.chat_id ? Number(body.chat_id) : Number(process.env.TELEGRAM_GROUP_ID)
  if (!chat) return NextResponse.json({ ok: false, sabab: 'TELEGRAM_GROUP_ID sozlanmagan' }, { status: 500 })

  const db = createAdminClient()
  const guruhga = chat === Number(process.env.TELEGRAM_GROUP_ID)
  // Bugungi hisobot YUBORISHDAN OLDIN atomik band qilinadi (0038) —
  // ikki chaqiruv bir vaqtda kelsa ham guruhga faqat bittasi ketadi.
  if (guruhga && !qolda) {
    const { data: band, error } = await db.rpc('kunlik_band', { p_kun: kun })
    if (error) return NextResponse.json({ ok: false, sabab: error.message }, { status: 500 })
    if (!band) return NextResponse.json({ ok: true, sabab: 'bugun yuborilgan' })
  }

  const r = await xabar(chat, SAYT_BELGISI + (await kunlikHisobotMatn()))
  if (!r.ok) return NextResponse.json({ ok: false, sabab: r.description }, { status: 502 })
  return NextResponse.json({ ok: true, chat, kun })
}

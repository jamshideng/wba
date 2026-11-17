import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { xabar } from '@/lib/telegram'
import { bugunToshkent } from '@/lib/format'
import { tugilganMatn, type TugilganKunlar } from '@/lib/tugilgan-kun'

/**
 * Tug'ilgan kun eslatmasi (0131) — har kuni 09:00 (Toshkent), "WBA Hisobot" guruhiga.
 * Ustozlar va o'quvchilar alohida xabar; 3 kun oldindan har kuni eslatiladi.
 *
 * Chaqiruvchi: Supabase pg_cron + pg_net, `Authorization: Bearer <CRON_SIR>`.
 * Kuniga bir marta (tugilgan_band). Sinov: `?sinov=1` — matnni qaytaradi, yubormaydi.
 */

export const dynamic = 'force-dynamic'

function kalitTogri(req: NextRequest) {
  const sir = process.env.CRON_SECRET || process.env.CRON_SIR
  return Boolean(sir) && req.headers.get('authorization') === `Bearer ${sir}`
}

export async function POST(req: NextRequest) {
  if (!kalitTogri(req)) return NextResponse.json({ ok: false, sabab: 'ruxsat yo‘q' }, { status: 401 })
  const sinov = req.nextUrl.searchParams.get('sinov') === '1'
  const chat = Number(process.env.TELEGRAM_GROUP_ID)
  if (!chat) return NextResponse.json({ ok: false, sabab: 'TELEGRAM_GROUP_ID sozlanmagan' }, { status: 500 })

  const kun = bugunToshkent()
  const db = createAdminClient()
  const { data, error } = await db.rpc('tugilgan_kunlar', { p_kun: kun, p_oldin: 3 })
  if (error) return NextResponse.json({ ok: false, sabab: error.message }, { status: 500 })
  const t = data as TugilganKunlar

  const matnlar = [
    tugilganMatn('Ustozlarning tug‘ilgan kuni', t.ustozlar),
    tugilganMatn('O‘quvchilarning tug‘ilgan kuni', t.oquvchilar),
  ].filter((x): x is string => Boolean(x))

  if (sinov) return NextResponse.json({ ok: true, sinov: true, kun, matnlar })
  if (!matnlar.length) return NextResponse.json({ ok: true, kun, sabab: 'yaqin 3 kunda tug‘ilgan kun yo‘q' })

  const { data: band, error: e2 } = await db.rpc('tugilgan_band', { p_kun: kun })
  if (e2) return NextResponse.json({ ok: false, sabab: e2.message }, { status: 500 })
  if (!band) return NextResponse.json({ ok: true, kun, sabab: 'bugun yuborilgan' })

  const natija = []
  for (const m of matnlar) natija.push((await xabar(chat, m)).ok)
  return NextResponse.json({ ok: natija.every(Boolean), kun, yuborildi: natija.length })
}

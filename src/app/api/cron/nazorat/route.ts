import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NAZORAT_TURLAR, nazoratTelegram, html, type NazoratTuri } from '@/lib/nazorat'

/**
 * Nazorat (0077) — har 30 daqiqa: Supabase pg_cron + pg_net chaqiradi.
 * 1) nazorat_yig() — yangi qoidabuzarliklar (kalit bo'yicha bir marta);
 * 2) hali yuborilmaganlar managerga: bitta Telegram xabar + sayt bildirishnomasi.
 *
 * Kalitsiz chaqirilsa ham xavfsiz: hodisa bir marta yoziladi, xabar bir
 * marta ketadi (yuborildi belgisi) — begona chaqiruv faqat tekshiruvni
 * oldinroq yurgizadi.
 */
export const dynamic = 'force-dynamic'

type Qator = {
  id: number
  turi: NazoratTuri
  tafsilot: string
  teachers: { ism: string } | null
  profiles: { ism: string } | null
}

export async function POST() {
  const db = createAdminClient()
  const { data: yangi, error } = await db.rpc('nazorat_yig')
  if (error) return NextResponse.json({ ok: false, sabab: error.message }, { status: 500 })

  const { data } = await db
    .from('nazorat_hodisalar')
    .select('id, turi, tafsilot, teachers(ism), profiles:profile_id(ism)')
    .eq('yuborildi', false)
    .order('id')
    .limit(40)
  const qatorlar = (data ?? []) as unknown as Qator[]
  if (qatorlar.length === 0) return NextResponse.json({ ok: true, yangi, yuborildi: 0 })

  const satr = (q: Qator) =>
    `• <b>${html(NAZORAT_TURLAR[q.turi].nom)}</b> — ${html(q.teachers?.ism ?? q.profiles?.ism ?? 'mas’ul yo‘q')}: ${html(q.tafsilot)}`
  const matn = `<b>Nazorat: ${qatorlar.length} ta yangi hodisa</b>\n${qatorlar.map(satr).join('\n')}\n\nOgohlantirish: wbalc.uz/crm/nazorat`
  const yetdi = await nazoratTelegram(db, null, null, matn)

  await db.from('bildirishnomalar').insert({
    turi: 'eslatma',
    sarlavha: `Nazorat: ${qatorlar.length} ta yangi hodisa`,
    matn: qatorlar.map((q) => `${NAZORAT_TURLAR[q.turi].nom} — ${q.teachers?.ism ?? q.profiles?.ism ?? 'mas’ul yo‘q'}`).join('; ').slice(0, 1900),
    havola: '/crm/nazorat',
    havola_matn: 'Nazorat',
    kimga: ['xodim'],
    filtr: { rol: 'manager' },
    tugash: new Date(Date.now() + 2 * 86400_000).toISOString(),
  })
  await db.from('nazorat_hodisalar').update({ yuborildi: true }).in('id', qatorlar.map((q) => q.id))

  return NextResponse.json({ ok: true, yangi, yuborildi: qatorlar.length, telegram: yetdi })
}

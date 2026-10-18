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
  await db.rpc('dars_kam_tekshir')
  const kam = await darsKamYubor(db)

  const { data } = await db
    .from('nazorat_hodisalar')
    .select('id, turi, tafsilot, teachers(ism), profiles:profile_id(ism)')
    .eq('yuborildi', false)
    .order('id')
    .limit(40)
  const qatorlar = (data ?? []) as unknown as Qator[]
  if (qatorlar.length === 0) return NextResponse.json({ ok: true, yangi, yuborildi: 0, kam })

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

  return NextResponse.json({ ok: true, yangi, yuborildi: qatorlar.length, telegram: yetdi, kam })
}

/**
 * 0081 — oyda 12 tadan kam dars: ustozga (sayt + Telegram) taklif bilan,
 * managerga — Telegram. Har yangi holat bir marta (yuborildi).
 */
async function darsKamYubor(db: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data } = await db
    .from('dars_kam_eslatma')
    .select('group_id, davr, soni, teacher_id, groups(nom), teachers(ism)')
    .eq('yuborildi', false)
    .limit(30)
  const royxat = (data ?? []) as unknown as {
    group_id: string; davr: string; soni: number; teacher_id: string | null
    groups: { nom: string } | null; teachers: { ism: string } | null
  }[]
  for (const r of royxat) {
    const { data: tx } = await db.rpc('kochirish_takliflari', { p_group: r.group_id, p_davr: r.davr })
    const takliflar = ((tx ?? []) as { eski: string; taklif: string | null; sabab: string | null }[])
      .map((t) => `${t.eski.slice(8, 10)}.${t.eski.slice(5, 7)}${t.sabab ? ` (${t.sabab})` : ''} → ${t.taklif ? `${t.taklif.slice(8, 10)}.${t.taklif.slice(5, 7)}` : 'boshqa kun'}`)
    const nom = r.groups?.nom ?? r.group_id
    const matn = `${nom}: ${r.davr} oyida ${r.soni} ta dars — 12 tadan ${12 - r.soni} ta kam. Dam kuniga tushgan darsni boshqa kunga ko‘chiring.${takliflar.length ? `\nTaklif: ${takliflar.join('; ')}` : ''}`
    if (r.teacher_id) {
      await nazoratTelegram(db, r.teacher_id, null, `<b>Oyda 12 dars yo‘q</b>\n${html(matn)}\n\nJurnal: wbalc.uz/crm/davomat/${r.group_id}`)
      await db.from('bildirishnomalar').insert({
        turi: 'eslatma',
        sarlavha: 'Oyda 12 dars yetmaydi',
        matn: matn.slice(0, 1900),
        havola: `/crm/davomat/${r.group_id}`,
        havola_matn: 'Ko‘chirish',
        kimga: ['ustoz'],
        filtr: { ustoz: r.teacher_id },
        muhim: true,
        tugash: new Date(Date.now() + 7 * 86400_000).toISOString(),
      })
    }
    await nazoratTelegram(db, null, null, `<b>Oyda 12 dars yo‘q</b> — ${html(r.teachers?.ism ?? 'ustoz')}\n${html(matn)}`)
    await db.from('dars_kam_eslatma').update({ yuborildi: true }).eq('group_id', r.group_id).eq('davr', r.davr).eq('soni', r.soni)
  }
  return royxat.length
}

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { html, xabar } from '@/lib/telegram'
import { saytManzil } from '@/lib/markaz'
import { bugunToshkent } from '@/lib/format'
import { pushYoqilganmi, pushYubor } from '@/lib/push'
import { navbatdagiEslatma, soatMinut, type EslatmaTuri } from '@/lib/davomat-eslatma'

/**
 * Davomat qilinmasa ustozga eslatma (0125) — har 5 daqiqa.
 * Chaqiruvchi: Supabase pg_cron + pg_net, `Authorization: Bearer <CRON_SIR>`
 * (kalit Vault'da 'cron_sir'). Kalitsiz — 401.
 *
 * Tartib: nomzodlar (bazada) → qaysi eslatma vaqti kelgani (davomat-eslatma.ts)
 * → davomat_eslatma qatori BAND QILINADI (unique) → Telegram + sayt + push.
 * Bitta guruhdagi xato qolganlarini to'xtatmaydi.
 *
 * Sinov: `?sinov=1` — kimga nima ketishi ko'rsatiladi, hech narsa yozilmaydi.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Nomzod = {
  group_id: string
  nom: string
  teacher_id: string
  profile_id: string | null
  boshlanish: string | null
  tugash: string
  jami: number
  belgilangan: number
  yuborilgan: number[]
}

type Natija = {
  guruh: string
  ustoz: string
  turi: EslatmaTuri
  belgilangan: string
  telegram: 'yetkazildi' | 'ulanmagan' | 'xato' | 'sinov'
  chatlar: number
  push?: number
  xato?: string
}

function kalitTogri(req: NextRequest) {
  const sir = process.env.CRON_SECRET || process.env.CRON_SIR
  return Boolean(sir) && req.headers.get('authorization') === `Bearer ${sir}`
}

function hozirToshkent() {
  return new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Tashkent', hour12: false }).slice(0, 5)
}

function telegramMatn(n: Nomzod) {
  const dars = n.boshlanish ? `${soatMinut(n.boshlanish)}–${soatMinut(n.tugash)}` : `${soatMinut(n.tugash)} gacha`
  return [
    '<b>Davomat qilinmadi</b>',
    '',
    `Guruh: ${html(n.nom)}`,
    `Dars: bugun ${dars}`,
    '',
    'Siz davomat qilmadingiz. Iltimos, davomat qilib qo‘ying.',
  ].join('\n')
}

export async function POST(req: NextRequest) {
  if (!kalitTogri(req)) return NextResponse.json({ ok: false, sabab: 'ruxsat yo‘q' }, { status: 401 })
  const sinov = req.nextUrl.searchParams.get('sinov') === '1'

  const db = createAdminClient()
  const { data, error } = await db.rpc('davomat_eslatma_nomzodlar')
  if (error) return NextResponse.json({ ok: false, sabab: error.message }, { status: 500 })

  const hozir = hozirToshkent()
  const bugun = bugunToshkent()
  const navbat = (data ?? [])
    .map((n) => ({ n, turi: navbatdagiEslatma({ tugash: n.tugash, hozir, yuborilgan: n.yuborilgan ?? [] }) }))
    .filter((x): x is { n: Nomzod; turi: EslatmaTuri } => x.turi !== null)

  const natijalar: Natija[] = []
  for (const { n, turi } of navbat) {
    try {
      natijalar.push(await bittasi(db, n, turi, bugun, sinov))
    } catch (e) {
      console.error('[davomat-eslatma]', n.group_id, (e as Error).message)
      natijalar.push({ guruh: n.group_id, ustoz: n.teacher_id, turi, belgilangan: `${n.belgilangan}/${n.jami}`, telegram: 'xato', chatlar: 0, xato: (e as Error).message })
    }
  }

  const ulanmagan = natijalar.filter((x) => x.telegram === 'ulanmagan').map((x) => x.ustoz)
  if (ulanmagan.length) console.warn('[davomat-eslatma] botga ulanmagan ustozlar:', [...new Set(ulanmagan)].join(', '))

  return NextResponse.json({ ok: true, sinov, hozir, nomzod: (data ?? []).length, yuborildi: natijalar })
}

async function bittasi(
  db: ReturnType<typeof createAdminClient>,
  n: Nomzod,
  turi: EslatmaTuri,
  bugun: string,
  sinov: boolean,
): Promise<Natija> {
  const asos = { guruh: n.group_id, ustoz: n.teacher_id, turi, belgilangan: `${n.belgilangan}/${n.jami}` }
  const { data: chatXom } = await db.rpc('nazorat_chatlar', { p_teacher: n.teacher_id, p_profile: null })
  const chatlar = ((chatXom ?? []) as number[]).filter(Boolean)

  if (sinov) return { ...asos, telegram: 'sinov', chatlar: chatlar.length }

  // 1. Band qilish — shu (guruh, sana, tur) allaqachon bo'lsa, hech narsa yuborilmaydi
  const { data: band } = await db
    .from('davomat_eslatma')
    .upsert(
      { group_id: n.group_id, sana: bugun, turi, teacher_id: n.teacher_id, jami: n.jami, belgilangan: n.belgilangan },
      { onConflict: 'group_id,sana,turi', ignoreDuplicates: true },
    )
    .select('id')
  const id = band?.[0]?.id
  if (!id) return { ...asos, telegram: 'xato', chatlar: 0, xato: 'allaqachon yuborilgan' }

  // 2. Telegram — ustozning har bir chatiga, "Davomat qilish" tugmasi bilan
  const havola = `/crm/davomat/${encodeURIComponent(n.group_id)}`
  let telegram: 'yetkazildi' | 'ulanmagan' | 'xato' = 'ulanmagan'
  let xato: string | undefined
  if (chatlar.length) {
    let yetdi = 0
    for (const chat of chatlar) {
      const r = await xabar(chat, telegramMatn(n), [[{ text: 'Davomat qilish', url: `${saytManzil()}${havola}` }]])
      if (r.ok) yetdi++
      else xato = r.description
    }
    telegram = yetdi ? 'yetkazildi' : 'xato'
  }

  // 3. Sayt + ilova — faqat shu ustozga; kun oxirida yoki davomat to'lganda yopiladi
  const tugash = new Date(`${bugun}T23:59:59+05:00`).toISOString()
  const { data: b } = await db
    .from('bildirishnomalar')
    .insert({
      turi: 'eslatma',
      sarlavha: 'Davomat qilinmadi',
      matn: `${n.nom} — bugungi dars (${soatMinut(n.tugash)} da tugagan). Davomat qilib qo‘ying.`,
      havola,
      havola_matn: 'Davomat qilish',
      kimga: ['ustoz'],
      filtr: { ustoz: n.teacher_id },
      muhim: turi === 2,
      tugash,
      manba: 'davomat',
    })
    .select('id')
    .single()

  // 2-eslatma chiqqanda 1-sining bildirishnomasi takrorlanmasin
  if (turi === 2) {
    const { data: oldingi } = await db.from('davomat_eslatma').select('bildirishnoma_id').eq('group_id', n.group_id).eq('sana', bugun).eq('turi', 1).maybeSingle()
    if (oldingi?.bildirishnoma_id) await db.from('bildirishnomalar').update({ holat: 'yopilgan' }).eq('id', oldingi.bildirishnoma_id)
  }

  await db
    .from('davomat_eslatma')
    .update({ telegram, telegram_xato: xato ?? null, bildirishnoma_id: b?.id ?? null })
    .eq('id', id)

  // 4. Telefon push — ustoz qurilmalariga
  let push = 0
  if (pushYoqilganmi() && n.profile_id) {
    const { data: obunalar } = await db.from('push_obunalar').select('endpoint, p256dh, auth').eq('profile_id', n.profile_id)
    if (obunalar?.length) {
      const r = await pushYubor(obunalar, { sarlavha: 'Davomat qilinmadi', matn: `${n.nom}: davomat qilib qo‘ying`, havola, teg: `dav-${n.group_id}-${bugun}` })
      push = r.yuborildi
      if (r.eskirgan.length) await db.from('push_obunalar').delete().in('endpoint', r.eskirgan)
    }
  }

  return { ...asos, telegram, chatlar: chatlar.length, push, xato }
}

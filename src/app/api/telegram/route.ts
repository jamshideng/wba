import { createHmac } from 'node:crypto'
import { NextResponse, after, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { tg, html, xabar, HISOBOT_GURUH, type Tugma } from '@/lib/telegram'
import { pul, sana, vaqt, davrNomi, bugunToshkent } from '@/lib/format'
import { saytManzil } from '@/lib/markaz'
import { kunlikHisobotMatn } from '@/lib/kunlik-hisobot'
import { bazaBuyrugimi, bazaBuyrugiMatn } from '@/lib/baza-buyruqlar'
import type { TelegramKim } from '@/lib/types'

/**
 * @WBAlcBot webhook'i. Telegram → shu manzil → baza (Sheets emas).
 *
 * ── NEGA BU YERDA service_role ──
 * Telegram so'rovida sayt sessiyasi yo'q, ya'ni RLS "kim" ekanini
 * bilmaydi. Shuning uchun huquq SHU FAYLDA tekshiriladi: har amal
 * oldidan chat qaysi o'quvchi/ustoz/xodimga ulangani telegram_ulanish
 * dan olinadi va so'rov o'sha ID bilan cheklanadi. Tugma ma'lumotiga
 * (callback_data) ishonilmaydi — uni o'zgartirib yuborish mumkin.
 *
 * Kirish: Telegram setWebhook'dagi secret_token sarlavhasi bilan.
 * Javob doim 200 — aks holda Telegram xabarni qayta-qayta yuboradi.
 */

export const dynamic = 'force-dynamic'

type TgUser = { id: number; first_name?: string; last_name?: string; username?: string }
type TgMessage = {
  message_id: number
  chat: { id: number; type: string }
  from?: TgUser
  text?: string
  contact?: { phone_number: string; user_id?: number }
}
type TgUpdate = {
  message?: TgMessage
  callback_query?: { id: string; from: TgUser; data?: string; message?: TgMessage }
}
type Ulanish = { kim: TelegramKim; student_id: string | null; teacher_id: string | null; profile_id: string | null; ism: string }

export async function POST(req: NextRequest) {
  const sir = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!sir || req.headers.get('x-telegram-bot-api-secret-token') !== sir) {
    return new NextResponse('ruxsat yo‘q', { status: 401 })
  }
  const xom = await req.text()
  let update: TgUpdate | null = null
  try { update = JSON.parse(xom) as TgUpdate } catch { update = null }

  /* "WBA Hisobot" guruhidagi buyruqlar:
       /baza_*  — sayt bazasidan, shu yerda (lib/baza-buyruqlar.ts)
       qolgani  — Apps Script'ga (haqiqiy ish hozircha Sheets'da) */
  if (update?.message && guruhBuyrugimi(update.message)) {
    const m = update.message
    // /baza_* hozircha o'chiq (Jamshid, 01.10: "keyinroq") — Vercel'da BAZA_BUYRUQLARI=1 qo'yilsa yoqiladi
    if (process.env.BAZA_BUYRUQLARI === '1' && bazaBuyrugimi(m.text ?? '')) {
      after(async () => {
        try {
          await xabar(m.chat.id, await bazaBuyrugiMatn(m.text ?? ''))
        } catch (e) {
          console.error('[telegram] baza buyrug‘i', e)
          await xabar(m.chat.id, '<b>[BAZA · sayt]</b> hisobotni tuzib bo‘lmadi — sayt jurnalini tekshiring.')
        }
      })
    } else {
      after(() => guruhgaUzat(xom))
    }
    return NextResponse.json({ ok: true })
  }
  const boshi = Date.now()
  const turi = update?.message ? (update.message.contact ? 'kontakt' : (update.message.text ?? '').split(' ')[0] || 'xabar') : update?.callback_query ? `tugma ${update.callback_query.data?.split('|')[0]}` : 'boshqa'
  try {
    if (update?.message) await xabarniIshla(update.message)
    else if (update?.callback_query) await tugmaniIshla(update.callback_query)
  } catch (e) {
    console.error('[telegram] istisno', turi, e)
  }
  console.log('[telegram]', turi, `${Date.now() - boshi}ms`)
  return NextResponse.json({ ok: true })
}

/* ------------------------------------------------------------------ */

/**
 * Hisobot guruhi buyruqlari (/hisobot_bugun, /tushum, /qarzdorlar …).
 * Ma'lumot va hisobot kodi Apps Script'da (wba_bot/BOT_GuruhBuyruq.js),
 * shuning uchun update o'zgarmasdan o'sha yerga uzatiladi. So'rov bot
 * tokeni bilan imzolanadi (HMAC-SHA256, ?imzo=) — Apps Script tekshiradi.
 */
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbzCUCCnuzyDGcmDaJ0xTk_Df5duRMRtR4voroRMMYgpmaXfdausb_-rcGdA3K1gqGTj/exec'

function guruhBuyrugimi(m: TgMessage) {
  return String(m.chat.id) === HISOBOT_GURUH && (m.text ?? '').trim().startsWith('/')
}

async function guruhgaUzat(xom: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  const imzo = createHmac('sha256', token).update(xom).digest('hex')
  try {
    const r = await fetch(`${APPS_SCRIPT_URL}?imzo=${imzo}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: xom,
    })
    const javob = (await r.text()).slice(0, 40)
    if (javob !== 'ok') console.error('[telegram] guruh buyrug‘i uzatilmadi', r.status, javob)
  } catch (e) {
    console.error('[telegram] guruh buyrug‘i uzatilmadi', e)
  }
}

const db = () => createAdminClient()

/** Baza xatosi jimgina "topilmadi" bo'lib ketmasin — jurnalga va odamga */
const TEXNIK = 'Texnik xatolik yuz berdi. Birozdan keyin qayta urinib ko‘ring.'
function bazaXato(joy: string, e: { message: string } | null) {
  if (e) console.error('[telegram] baza', joy, e.message)
  return Boolean(e)
}
const ism = (u?: TgUser) => [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.username || 'Telegram'

const KIM_NOMI: Record<TelegramKim, string> = {
  oquvchi: 'o‘quvchi',
  ota_ona: 'ota-ona',
  ustoz: 'ustoz',
  xodim: 'xodim',
}

async function ulanishlar(chat: number): Promise<Ulanish[]> {
  const { data, error } = await db()
    .from('telegram_ulanish')
    .select('kim, student_id, teacher_id, profile_id, students(fish), teachers(ism), profiles(ism)')
    .eq('chat_id', chat)
    .eq('holat', 'faol')
  bazaXato('ulanishlar', error)
  type Q = Omit<Ulanish, 'ism'> & { students: { fish: string } | null; teachers: { ism: string } | null; profiles: { ism: string } | null }
  return ((data ?? []) as unknown as Q[]).map((u) => ({
    kim: u.kim,
    student_id: u.student_id,
    teacher_id: u.teacher_id,
    profile_id: u.profile_id,
    ism: u.students?.fish ?? u.teachers?.ism ?? u.profiles?.ism ?? '—',
  }))
}

function kontaktSorash(chat: number, matn: string) {
  return tg('sendMessage', {
    chat_id: chat,
    text: matn,
    parse_mode: 'HTML',
    reply_markup: {
      keyboard: [[{ text: 'Telefon raqamimni yuborish', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  })
}

const SALOM =
  '<b>World Bridge Academy</b> botiga xush kelibsiz.\n\n' +
  'Qarz, darslar, davomat va markaz e’lonlarini shu yerda olasiz. ' +
  'Ulanish uchun pastdagi tugma bilan telefon raqamingizni yuboring — ' +
  'u markazdagi o‘quvchi, ota-ona yoki ustoz raqami bilan solishtiriladi.'

/* ------------------------------------------------------------------ */
/*  Xabarlar                                                            */
/* ------------------------------------------------------------------ */

async function xabarniIshla(m: TgMessage) {
  if (m.chat.type !== 'private') return // guruhdagi yozishmalarga javob bermaymiz
  const chat = m.chat.id
  const matn = (m.text ?? '').trim()

  // Telefon raqami (kontakt)
  if (m.contact) {
    if (!m.from || m.contact.user_id !== m.from.id) {
      await kontaktSorash(chat, 'Faqat <b>o‘zingizning</b> raqamingizni yuboring — pastdagi tugma orqali.')
      return
    }
    const { data, error } = await db().rpc('telegram_ula_telefon', { p_tel: m.contact.phone_number, p_chat: chat, p_tg_ism: ism(m.from) })
    if (bazaXato('ula_telefon', error)) {
      await xabar(chat, TEXNIK)
      return
    }
    const topildi = data ?? []
    if (!topildi.length) {
      await tg('sendMessage', {
        chat_id: chat,
        parse_mode: 'HTML',
        text:
          'Bu raqam markaz bazasida topilmadi.\n\n' +
          'Qabulxonaga raqamingizni to‘g‘ri yozib qo‘yishni ayting yoki saytdagi ' +
          '<b>Profil → Telegramga ulash</b> tugmasidan foydalaning.',
        reply_markup: { remove_keyboard: true },
      })
      return
    }
    await tg('sendMessage', {
      chat_id: chat,
      parse_mode: 'HTML',
      text: 'Ulandingiz:\n' + topildi.map((t) => `• ${html(t.ism)} — ${KIM_NOMI[t.kim]}`).join('\n'),
      reply_markup: { remove_keyboard: true },
    })
    await menyu(chat)
    return
  }

  // /start <token> — saytdagi "Telegramga ulash" tugmasidan
  const start = matn.match(/^\/start(?:\s+([a-f0-9]{32}))?$/)
  if (start?.[1]) {
    const { data, error } = await db().rpc('telegram_ula_token', { p_token: start[1], p_chat: chat, p_tg_ism: ism(m.from) })
    if (bazaXato('ula_token', error)) {
      await xabar(chat, TEXNIK)
      return
    }
    if (!data?.length) {
      await xabar(chat, 'Havola eskirgan yoki ishlatilgan. Saytda <b>Profil → Telegramga ulash</b> ni qayta bosing.')
      return
    }
    await xabar(chat, 'Ulandingiz:\n' + data.map((t) => `• ${html(t.ism)} — ${KIM_NOMI[t.kim]}`).join('\n'))
    await menyu(chat)
    return
  }

  const bor = await ulanishlar(chat)
  if (bor.length) {
    await menyu(chat, bor)
    return
  }

  // Ustozning Telegram ID'si bazada bo'lsa (eski botdan) — raqamsiz ulanadi
  if (m.from) {
    const { data: ustoz, error } = await db().from('teachers').select('id').eq('telegram_id', m.from.id).eq('holat', 'faol')
    bazaXato('ustoz telegram_id', error)
    if (ustoz?.length) {
      for (const u of ustoz) {
        await db().rpc('telegram_ula_qator', {
          p_chat: chat, p_kim: 'ustoz', p_student: null, p_teacher: u.id, p_profile: null, p_tel: null, p_tg_ism: ism(m.from),
        })
      }
      await menyu(chat)
      return
    }
  }

  await kontaktSorash(chat, SALOM)
}

/* ------------------------------------------------------------------ */
/*  Menyu                                                               */
/* ------------------------------------------------------------------ */

async function menyu(chat: number, bor?: Ulanish[]) {
  const u = bor ?? (await ulanishlar(chat))
  if (!u.length) {
    await kontaktSorash(chat, SALOM)
    return
  }
  const qatorlar: Tugma[][] = []
  const oquvchilar = u.filter((x) => (x.kim === 'oquvchi' || x.kim === 'ota_ona') && x.student_id)
  const kop = new Set(oquvchilar.map((x) => x.student_id)).size > 1
  const korilgan = new Set<string>()
  for (const o of oquvchilar) {
    if (korilgan.has(o.student_id!)) continue
    korilgan.add(o.student_id!)
    const nom = kop ? ` · ${o.ism.split(' ')[0]}` : ''
    qatorlar.push(
      [{ text: `Qarz${nom}`, callback_data: `q|${o.student_id}` }, { text: `Darslar${nom}`, callback_data: `d|${o.student_id}` }],
      [{ text: `Davomat${nom}`, callback_data: `v|${o.student_id}` }, { text: `Woblar${nom}`, callback_data: `w|${o.student_id}` }],
    )
  }
  if (u.some((x) => x.kim === 'ustoz')) qatorlar.push([{ text: 'Bugungi darslarim', callback_data: 'b' }])
  if (u.some((x) => x.kim === 'xodim')) {
    qatorlar.push([{ text: 'Bugungi hisobot', callback_data: 'h' }, { text: 'Qarzdorlar', callback_data: 'x' }])
  }
  qatorlar.push([{ text: 'Saytni ochish', url: `${saytManzil()}/crm` }])

  const kimlar = [...new Set(u.map((x) => `${html(x.ism)} (${KIM_NOMI[x.kim]})`))].join(', ')
  await xabar(chat, `<b>Menyu</b>\n${kimlar}`, qatorlar)
}

/* ------------------------------------------------------------------ */
/*  Tugmalar                                                            */
/* ------------------------------------------------------------------ */

async function tugmaniIshla(cq: NonNullable<TgUpdate['callback_query']>) {
  await tg('answerCallbackQuery', { callback_query_id: cq.id })
  const chat = cq.message?.chat.id
  if (!chat || cq.message?.chat.type !== 'private') return

  const u = await ulanishlar(chat)
  const [amal, nishon] = (cq.data ?? '').split('|')

  // O'quvchi ma'lumoti — faqat shu chatga ulangan o'quvchi bo'lsa
  if ('qdvw'.includes(amal) && amal.length === 1) {
    const o = u.find((x) => x.student_id === nishon && (x.kim === 'oquvchi' || x.kim === 'ota_ona'))
    if (!o) return menyu(chat, u)
    if (amal === 'q') return qarz(chat, o)
    if (amal === 'd') return darslar(chat, o)
    if (amal === 'v') return davomat(chat, o)
    return woblar(chat, o)
  }
  if (amal === 'b' && u.some((x) => x.kim === 'ustoz')) {
    return ustozBugun(chat, u.filter((x) => x.kim === 'ustoz').map((x) => x.teacher_id!))
  }
  if (amal === 'h' && u.some((x) => x.kim === 'xodim')) return hisobot(chat)
  if (amal === 'x' && u.some((x) => x.kim === 'xodim')) return qarzdorlar(chat)
  return menyu(chat, u)
}

const orqaga: Tugma[][] = [[{ text: '← Menyu', callback_data: 'm' }]]

async function qarz(chat: number, o: Ulanish) {
  const davr = bugunToshkent().slice(0, 7)
  const [{ data: b }, { data: hisob }, { data: tolov }] = await Promise.all([
    db().from('v_student_balance').select('qarz').eq('student_id', o.student_id!).maybeSingle(),
    db().from('invoices').select('summa, chegirma, enrollments!inner(student_id, groups(nom))')
      .eq('davr', davr).neq('holat', 'bekor').eq('enrollments.student_id', o.student_id!),
    db().from('payments').select('sana, davr, summa').eq('student_id', o.student_id!).eq('bekor', false)
      .order('sana', { ascending: false }).limit(3),
  ])
  const q = Number(b?.qarz ?? 0)
  const qatorlar = [`<b>${html(o.ism)}</b>`]
  qatorlar.push(q > 0 ? `Qarz: <b>${pul(q)} so‘m</b>` : q < 0 ? `Oldindan to‘langan: <b>${pul(-q)} so‘m</b>` : 'Qarz yo‘q')
  type H = { summa: number; chegirma: number; enrollments: { groups: { nom: string } | null } | null }
  for (const h of (hisob ?? []) as unknown as H[]) {
    const ch = Number(h.chegirma) > 0 ? ` (chegirma −${pul(h.chegirma)})` : ''
    qatorlar.push(`${davrNomi(davr)} · ${html(h.enrollments?.groups?.nom ?? '')}: ${pul(h.summa)}${ch}`)
  }
  if (tolov?.length) {
    qatorlar.push('', 'Oxirgi to‘lovlar:')
    for (const t of tolov) qatorlar.push(`${sana(t.sana)} — ${pul(t.summa)} (${davrNomi(t.davr).toLowerCase()} uchun)`)
  }
  await xabar(chat, qatorlar.join('\n'), orqaga)
}

async function darslar(chat: number, o: Ulanish) {
  const { data } = await db().rpc('keyingi_darslar', { p_student: o.student_id!, p_soni: 6 })
  const bugun = bugunToshkent()
  const royxat = (data ?? []).map((d) => `${d.sana === bugun ? '<b>bugun</b>' : sana(d.sana)} ${vaqt(d.boshlanish)}–${vaqt(d.tugash)} · ${html(d.nom)}`)
  await xabar(chat, `<b>${html(o.ism)}</b> — keyingi darslar\n` + (royxat.join('\n') || 'Yaqin kunlarda dars yo‘q.'), orqaga)
}

async function davomat(chat: number, o: Ulanish) {
  // View'dan embed ishonchsiz (FK yo'q) — guruh nomlari alohida
  const { data } = await db().from('v_attendance_monthly').select('davr, group_id, darslar, kelgan, foiz')
    .eq('student_id', o.student_id!).order('davr', { ascending: false }).limit(4)
  const d = data ?? []
  const { data: g } = d.length
    ? await db().from('groups').select('id, nom').in('id', [...new Set(d.map((x) => x.group_id))])
    : { data: [] }
  const nomi = new Map((g ?? []).map((x) => [x.id, x.nom]))
  const royxat = d.map((x) => `${davrNomi(x.davr)} · ${html(nomi.get(x.group_id) ?? '')}: ${x.kelgan}/${x.darslar} — <b>${x.foiz}%</b>`)
  await xabar(chat, `<b>${html(o.ism)}</b> — davomat\n` + (royxat.join('\n') || 'Hali davomat belgilanmagan.'), orqaga)
}

async function woblar(chat: number, o: Ulanish) {
  const { data } = await db().from('v_woblr_balance').select('jami_ball, balans').eq('student_id', o.student_id!).maybeSingle()
  await xabar(chat, `<b>${html(o.ism)}</b> — woblar\nBalans: <b>${Number(data?.balans ?? 0)}</b> · jami olingan: ${Number(data?.jami_ball ?? 0)}`, orqaga)
}

async function ustozBugun(chat: number, ustozlar: string[]) {
  const { data } = await db().from('v_bugungi_darslar').select('group_id, nom, boshlanish, tugash, belgilangan, oquvchilar')
    .in('teacher_id', ustozlar).order('boshlanish')
  const sayt = saytManzil()
  const d = data ?? []
  if (!d.length) return xabar(chat, 'Bugun darsingiz yo‘q.', orqaga)
  const tugmalar: Tugma[][] = d.map((x) => [{ text: `${vaqt(x.boshlanish)} davomat`, url: `${sayt}/crm/davomat/${x.group_id}` }])
  const matn = d.map((x) => `${vaqt(x.boshlanish)}–${vaqt(x.tugash)} · ${html(x.nom)} · ${x.oquvchilar} o‘quvchi · ${x.belgilangan ? 'belgilangan' : '<b>belgilanmagan</b>'}`)
  await xabar(chat, `<b>Bugungi darslar</b> · ${sana(bugunToshkent())}\n${matn.join('\n')}\n\nDavomat saytda belgilanadi:`, [...tugmalar, ...orqaga])
}

async function hisobot(chat: number) {
  // Guruhga 19:40 da ketadigan hisobotning o'zi (src/lib/kunlik-hisobot.ts)
  await xabar(chat, await kunlikHisobotMatn(), orqaga)
}

async function qarzdorlar(chat: number) {
  const { data } = await db().from('v_qarzdorlar').select('fish, qarz').order('qarz', { ascending: false }).limit(15)
  const royxat = (data ?? []).map((q, i) => `${i + 1}. ${html(q.fish)} — ${pul(q.qarz)}`)
  await xabar(chat, '<b>Qarzdorlar</b> (eng kattadan)\n' + (royxat.join('\n') || 'Qarzdor yo‘q.'), orqaga)
}

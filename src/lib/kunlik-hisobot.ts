import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { html } from '@/lib/telegram'
import { pul, sana, vaqt, bugunToshkent, haftaKuni, telefon } from '@/lib/format'
import { ketishNomi } from '@/lib/ketish'
import { royxatOl } from '@/lib/royxat'
import type { Hisobot } from '@/lib/types'

/**
 * KUNLIK HISOBOT — bugun uchun, bazadan.
 *
 * Eski botdagi hisobotMatn (BOT_Hisobot.js, bir kunlik) bilan bir xil
 * bo'limlar: davomat, belgilanmagan darslar (ustoz kesimida), probniylar,
 * to'lov, qarz. Faqat endi Sheets emas — baza, ya'ni saytda qo'yilgan
 * davomat va kiritilgan to'lov darhol ko'rinadi.
 *
 * Guruhga 19:40 da (/api/cron/kunlik) va xodimga botdagi "Bugungi
 * hisobot" tugmasida yuboriladi. service_role — sessiyasiz ishlaydi,
 * faqat umumiy raqamlar chiqadi (telefon, ism-sharif yo'q).
 */
export async function kunlikHisobotMatn(kun: string = bugunToshkent()): Promise<string> {
  const db = createAdminClient()
  const ketishRoyxat = await royxatOl(db, 'ketish_sabab')

  const [{ data: qoshimcha }, { data: guruhlar }, { data: darsQatorlari }, { data: yozilishlar }, { data: belgilar }, { data: probniy }, { data: tushum }, { data: qarzlar }, { data: ustozlar }, { data: kechikish }, { data: oyKechikish }] =
    await Promise.all([
      // 0084 — Sheets hisobotidagi bo'limlar (tushum turlari, oylik reja, yozdirilganlar …)
      db.rpc('kunlik_qoshimcha', { p_kun: kun }),
      db.from('groups').select('id, nom, boshlanish, teacher_id, kunlar').eq('holat', 'faol'),
      db.from('lessons').select('group_id, otkazildi').eq('sana', kun),
      db.from('enrollments').select('group_id').neq('holat', 'tugagan').lte('boshlandi', kun),
      db.from('attendance').select('holat, lessons!inner(sana)').eq('lessons.sana', kun),
      db.from('leads').select('holat').eq('sinov_sana', kun),
      db.rpc('tushum_hisobot', { p_dan: kun, p_gacha: kun }),
      db.from('v_qarzdorlar').select('qarz'),
      db.from('teachers').select('id, ism'),
      // 0060 — ustozlar kechikishi: bugungi yozuvlar va shu oy jamlanmasi
      db.from('ustoz_kechikish').select('daqiqa, sabab, teachers(ism), groups(nom)').eq('sana', kun).order('daqiqa', { ascending: false }),
      db.from('v_ustoz_kechikish_oylik').select('ism, soni, daqiqa').eq('davr', kun.slice(0, 7)).order('daqiqa', { ascending: false }),
    ])

  /* O'sha kuni darsi bo'lgan guruhlar (groups.kunlar, 0028) — istalgan kun uchun */
  const hk = haftaKuni(kun)
  const otkazildi = new Map((darsQatorlari ?? []).map((l) => [l.group_id, Boolean(l.otkazildi)]))
  const soni = new Map<string, number>()
  for (const e of yozilishlar ?? []) soni.set(e.group_id, (soni.get(e.group_id) ?? 0) + 1)
  const darslar = ((guruhlar ?? []) as { id: string; nom: string; boshlanish: string; teacher_id: string | null; kunlar: number[] }[])
    .filter((g) => (g.kunlar ?? []).includes(hk) && (soni.get(g.id) ?? 0) > 0)
    .map((g) => ({ nom: g.nom, boshlanish: g.boshlanish, teacher_id: g.teacher_id, belgilangan: otkazildi.get(g.id) ?? false }))
  const b = (belgilar ?? []) as { holat: string }[]
  const keldi = b.filter((x) => x.holat === 'keldi' || x.holat === 'kechikdi').length
  const kelmadi = b.filter((x) => x.holat === 'kelmadi').length
  const sababli = b.filter((x) => x.holat === 'sababli').length
  const foiz = keldi + kelmadi + sababli ? Math.round((keldi * 100) / (keldi + kelmadi + sababli)) : null

  /* Belgilanmagan darslar — ustoz kesimida, "Beginner 08:30" ko'rinishida */
  const ustozIsmi = new Map((ustozlar ?? []).map((u) => [u.id, u.ism]))
  const qilinmagan = new Map<string, string[]>()
  for (const d of darslar.filter((x) => !x.belgilangan)) {
    const u = ustozIsmi.get(d.teacher_id ?? '') ?? '—'
    qilinmagan.set(u, [...(qilinmagan.get(u) ?? []), `${d.nom.split(' · ')[0]} ${vaqt(d.boshlanish)}`])
  }
  const jamiQ = [...qilinmagan.values()].reduce((a, x) => a + x.length, 0)

  const p = (probniy ?? []) as { holat: string }[]
  const ps = (h: string[]) => p.filter((x) => h.includes(x.holat)).length

  const h = tushum as Hisobot | null
  const q = (qarzlar ?? []).map((x) => Number(x.qarz)).filter((x) => x > 0)

  const t: string[] = []
  t.push(`<b>KUNLIK HISOBOT</b>\n${sana(kun)}\n`)

  t.push('<b>DAVOMAT</b>')
  t.push(`Darslar: <b>${darslar.length}</b> ta`)
  t.push(`Keldi: <b>${keldi}</b> · kelmadi: <b>${kelmadi}</b>${sababli ? ` · sababli: <b>${sababli}</b>` : ''}${foiz === null ? '' : `  (${foiz}%)`}\n`)

  t.push('<b>DAVOMAT QO‘YILMAGAN DARSLAR</b>')
  if (!jamiQ) {
    t.push('Yo‘q — hamma dars belgilangan\n')
  } else {
    t.push(`Jami: <b>${jamiQ}</b> ta dars`)
    for (const [u, royxat] of qilinmagan) {
      t.push(`  · ${html(u)} — ${royxat.length} ta: ${html(royxat.slice(0, 6).join(', '))}${royxat.length > 6 ? ' …' : ''}`)
    }
    t.push('')
  }

  t.push('<b>PROBNIYLAR</b> (bugungi sinov darsi)')
  t.push(`Jami: <b>${p.length}</b> · keldi: <b>${ps(['keldi', 'yozildi'])}</b> · kelmadi: <b>${ps(['kelmadi'])}</b>`)
  t.push(`Doimiyga o‘tdi: <b>${ps(['yozildi'])}</b> · rad: <b>${ps(['rad'])}</b>${ps(['yangi', 'qongiroq']) ? ` · kutilmoqda: ${ps(['yangi', 'qongiroq'])}` : ''}\n`)

  const k = qoshimcha as KunlikQoshimcha | null
  t.push('<b>TO‘LOV</b>')
  t.push(`To‘lov: <b>${h?.soni ?? 0}</b> ta · <b>${pul(h?.tushum ?? 0)} so‘m</b>`)
  t.push(`To‘lagan o‘quvchi: <b>${h?.odam ?? 0}</b>`)
  if (k) {
    t.push(`Naqd: ${pul(k.naqd)} · Terminal: ${pul(k.terminal)} · Click: ${pul(k.click)}\n`)
    const qoldi = Math.max(0, Number(k.reja) - Number(k.tushdi))
    const foizReja = Number(k.reja) > 0 ? Math.round((Number(k.tushdi) * 100) / Number(k.reja)) : 0
    t.push(`<b>${oyNomi(kun).toUpperCase()} OYI REJASI</b>`)
    t.push(`To‘lanishi kerak: <b>${pul(k.reja)} so‘m</b> (${k.reja_soni} ta qatnashuv)`)
    t.push(`Tushdi: <b>${pul(k.tushdi)} so‘m</b> (${foizReja}%) · qoldi: ${pul(qoldi)}`)
    t.push(`To‘liq to‘laganlar: <b>${k.toliq}</b> / ${k.reja_soni}\n`)

    t.push('<b>YOZDIRILGANLAR</b> (yangi probniylar)')
    if (!k.yozdirilgan.length) t.push('Bugun yo‘q')
    k.yozdirilgan.forEach((x, i) => t.push(`${i + 1}. ${html(x.ism)} — ${html(x.fan)}${x.tel ? ` · ${telefon(x.tel)}` : ''}`))
    t.push('')

    t.push('<b>PROBNIY DARSGA KIRGANLAR</b>')
    if (!k.probniy_kirgan.length) t.push('Bugun yo‘q')
    k.probniy_kirgan.forEach((x, i) => t.push(`${i + 1}. ${html(x.ism)} — ${html(x.fan)}${x.tel ? ` · ${telefon(x.tel)}` : ''}`))
    t.push('')

    t.push('<b>RASMIY O‘QUVCHILAR</b>')
    t.push(`Fan bo‘yicha: <b>${k.rasmiy}</b> · bola: <b>${k.rasmiy_bola}</b>`)
    if (k.qoshilgan.length) t.push(`Bugun qo‘shildi: ${k.qoshilgan.map((x) => `${html(x.fish)} (${html(x.fan)})`).join(', ')}`)
    t.push('')

    t.push('<b>CHIQIB KETGANLAR</b>')
    if (!k.ketgan.length) t.push('Bugun yo‘q')
    k.ketgan.forEach((x, i) =>
      t.push(
        `${i + 1}. ${html(x.fish)}${x.fan ? ` — ${html(x.fan)}` : ''} · sabab: ${html(x.sabab ? ketishNomi(x.sabab, ketishRoyxat) : (x.izoh ?? 'belgilanmagan'))}${Number(x.qarz) > 0 ? ` · qarz ${pul(x.qarz)}` : ''}`,
      ),
    )
  }
  t.push('')

  t.push('<b>QARZ</b> (bugungi holat)')
  t.push(`Qarzdor: <b>${q.length}</b> ta · <b>${pul(q.reduce((a, x) => a + x, 0))} so‘m</b>`)

  /* 0060 — ustozlar kechikishi (faqat kechikkanlar yoziladi) */
  const kech = (kechikish ?? []) as unknown as { daqiqa: number; sabab: string | null; teachers: { ism: string } | null; groups: { nom: string } | null }[]
  const oyK = (oyKechikish ?? []) as { ism: string; soni: number; daqiqa: number }[]
  t.push('')
  t.push('<b>USTOZLAR KECHIKISHI</b>')
  if (!kech.length) t.push('Bugun kechikkan ustoz yo‘q')
  for (const k of kech) {
    t.push(`  · ${html(k.teachers?.ism ?? '—')} — <b>${k.daqiqa} daqiqa</b>${k.groups ? ` · ${html(k.groups.nom)}` : ''}${k.sabab ? ` · ${html(k.sabab)}` : ''}`)
  }
  if (oyK.length) t.push(`Shu oy: ${oyK.map((x) => `${html(x.ism)} ${x.soni} marta / ${x.daqiqa} daq`).join(' · ')}`)

  return t.join('\n')
}

type KunlikQoshimcha = {
  naqd: number
  terminal: number
  click: number
  soni: number
  reja: number
  reja_soni: number
  tushdi: number
  toliq: number
  yozdirilgan: { ism: string; tel: string | null; fan: string }[]
  probniy_kirgan: { ism: string; tel: string | null; fan: string }[]
  rasmiy: number
  rasmiy_bola: number
  qoshilgan: { fish: string; fan: string }[]
  ketgan: { fish: string; sabab: string | null; izoh: string | null; qarz: number; fan: string | null }[]
}

type ErtangiMaslahat = {
  ertaga: string
  vazifalar: { nom: string; vaqt: string; kim: string | null; tel: string | null; otgan: boolean }[]
  tugilgan: { ism: string; kim: string }[]
  tugilgan_yoq: number
  faol_soni: number
  probniylar: { ism: string; tel: string | null; fan: string; kun: number; kelgan: boolean }[]
  qarzdorlar: { guruh: string; vaqt: string; oquvchilar: { fish: string; qarz: number }[] }[]
}

const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
function oyNomi(kun: string): string {
  return OYLAR[Number(kun.slice(5, 7)) - 1] ?? kun.slice(0, 7)
}
const HAFTA = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']

/**
 * ERTANGI KUN UCHUN MASLAHAT (0084) — Apps Script'dagi BOT_Maslahat.js
 * o'rniga, bazadan: vazifalar (izohdagi va'dalar o'rniga), tug'ilgan
 * kunlar, doimiyga o'tmagan probniylar, ertaga darsi bor qarzdorlar.
 * 19:40 hisobotidan keyin alohida xabar bo'lib ketadi.
 */
export async function ertangiMaslahatMatn(kun: string = bugunToshkent()): Promise<string> {
  const db = createAdminClient()
  const ketishRoyxat = await royxatOl(db, 'ketish_sabab')
  const { data } = await db.rpc('ertangi_maslahat', { p_kun: kun })
  const m = data as unknown as ErtangiMaslahat | null
  if (!m) return '<b>ERTANGI KUN UCHUN MASLAHAT</b>\nMa’lumotni o‘qib bo‘lmadi.'

  const t: string[] = []
  t.push(`<b>ERTANGI KUN UCHUN MASLAHAT</b>\n${sana(m.ertaga)} · ${HAFTA[new Date(`${m.ertaga}T12:00:00Z`).getUTCDay()]}\n`)

  const otgan = m.vazifalar.filter((v) => v.otgan)
  const ertangi = m.vazifalar.filter((v) => !v.otgan)
  t.push('<b>VAZIFALAR</b> (ertangi)')
  if (!ertangi.length) t.push('Ertaga muddatli vazifa yo‘q')
  ertangi
    .slice(0, 20)
    .forEach((v, i) => t.push(`${i + 1}. ${html(v.nom)}${v.kim ? ` — ${html(v.kim)}` : ''}${v.tel ? ` · ${telefon(v.tel)}` : ''} · ${v.vaqt.slice(6)}`))
  if (otgan.length) t.push(`Muddati o‘tgan: <b>${otgan.length}</b> ta — saytda Vazifalar bo‘limida`)
  t.push('')

  t.push('<b>ERTAGA TUG‘ILGAN KUN</b>')
  if (!m.tugilgan.length) t.push('Ertaga tug‘ilgan kun yo‘q')
  m.tugilgan.forEach((x) => t.push(`· ${html(x.ism)} (${html(x.kim)})`))
  if (m.tugilgan_yoq) t.push(`${m.tugilgan_yoq} / ${m.faol_soni} ta o‘quvchining tug‘ilgan sanasi kiritilmagan`)
  t.push('')

  const osilgan = m.probniylar.filter((p) => p.kun >= 7).length
  t.push(`<b>PROBNIYLAR — DOIMIYGA O‘TMAGAN</b> (${m.probniylar.length} ta)`)
  if (!m.probniylar.length) t.push('Hammasi hal qilingan')
  m.probniylar
    .slice(0, 30)
    .forEach((p, i) =>
      t.push(
        `${i + 1}. ${html(p.ism)} — ${html(p.fan)}${p.tel ? ` · ${telefon(p.tel)}` : ''} · ${p.kun >= 7 ? `<b>${p.kun} kun</b>` : `${p.kun} kun`}${p.kelgan ? ' · darsga kelgan' : ''}`,
      ),
    )
  if (osilgan) t.push(`${osilgan} ta probniy 7 kundan beri turibdi — Doimiy / Rad / Kelmadi deb hal qilish kerak`)
  t.push('')

  const jami = m.qarzdorlar.reduce((a, g) => a + g.oquvchilar.length, 0)
  t.push(`<b>ERTAGA DARSI BOR QARZDORLAR</b> (${jami} ta)`)
  if (!jami) t.push('Yo‘q')
  for (const g of m.qarzdorlar) {
    t.push(`· ${html(g.guruh)}`)
    t.push(`   ${g.oquvchilar.map((o) => `${html(o.fish)} ${pul(o.qarz)}`).join(' · ')}`)
  }
  return t.join('\n')
}

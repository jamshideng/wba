'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { summaOqi, matn, xabarliYol, xatoMatni, ichkiYol } from '@/lib/kiritish'
import { nazoratTelegram, html } from '@/lib/nazorat'

const YOL = '/crm/nazorat'

function qaytish(fd: FormData): string {
  const y = ichkiYol(fd.get('qaytish'))
  return y.startsWith(YOL) ? y : YOL
}

/** "u:U01" — ustoz, "p:<uuid>" — xodim */
function kimOqi(v: FormDataEntryValue | null): { teacher: string | null; profile: string | null } | null {
  const s = String(v ?? '')
  if (/^u:[A-Za-z0-9_-]+$/.test(s)) return { teacher: s.slice(2), profile: null }
  if (/^p:[0-9a-f-]{36}$/.test(s)) return { teacher: null, profile: s.slice(2) }
  return null
}

/** Ogohlantirish (0077): yoziladi, saytda va Telegram'da odamning o'ziga boradi. */
export async function ogohlantir(fd: FormData) {
  await talabRol('manager', 'direktor')
  const orqaga = qaytish(fd)
  const kim = kimOqi(fd.get('kim'))
  const m = matn(fd.get('matn'))
  const hodisa = Number(fd.get('hodisa_id')) || null
  if (!kim) redirect(xabarliYol(orqaga, { xato: 'Kimni ogohlantirishni tanlang.' }))
  if (!m) redirect(xabarliYol(orqaga, { xato: 'Ogohlantirish matnini yozing.' }))

  const supabase = await createClient()
  const { data: soni, error } = await supabase.rpc('ogohlantir', {
    p_hodisa: hodisa,
    p_teacher: kim!.teacher,
    p_profile: kim!.profile,
    p_matn: m!,
  })
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))

  const yetdi = await nazoratTelegram(supabase, kim!.teacher, kim!.profile, `<b>Ogohlantirish (${soni}/3)</b>\n${html(m!)}`)
  revalidatePath(YOL)
  redirect(
    xabarliYol(orqaga, {
      ok: `Ogohlantirish yuborildi (shu oy ${soni} ta)${yetdi ? '' : ' — Telegram ulanmagan, faqat saytda'}.${Number(soni) >= 3 ? ' Endi jarima qo‘llash mumkin.' : ''}`,
    }),
  )
}

/** Hodisani ogohlantirishsiz yopish (masalan, sababli) */
export async function hodisaYop(fd: FormData) {
  const profil = await talabRol('manager', 'direktor')
  const orqaga = qaytish(fd)
  const id = Number(fd.get('id'))
  if (!Number.isInteger(id) || id <= 0) redirect(orqaga)

  const supabase = await createClient()
  const { error } = await supabase
    .from('nazorat_hodisalar')
    .update({ holat: 'yopildi', yopdi: profil.id, yopish_izoh: matn(fd.get('izoh')) })
    .eq('id', id)
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(orqaga, { ok: 'Yopildi.' }))
}

/** Jarima — shu oy 3+ ogohlantirishdan keyin; summani manager yozadi, maoshdan ayiriladi */
export async function jarimaQol(fd: FormData) {
  await talabRol('manager', 'direktor')
  const orqaga = qaytish(fd)
  const kim = kimOqi(fd.get('kim'))
  const summa = summaOqi(fd.get('summa'))
  const sabab = matn(fd.get('sabab'))
  if (!kim) redirect(orqaga)
  if (!summa) redirect(xabarliYol(orqaga, { xato: 'Summa noto‘g‘ri. Masalan: 50000 yoki 50 ming.' }))
  if (!sabab) redirect(xabarliYol(orqaga, { xato: 'Jarima sababini yozing.' }))

  const supabase = await createClient()
  const { error } = await supabase.rpc('nazorat_jarima', {
    p_teacher: kim!.teacher,
    p_profile: kim!.profile,
    p_summa: summa!,
    p_sabab: sabab!,
  })
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))

  await nazoratTelegram(supabase, kim!.teacher, kim!.profile, `<b>Jarima</b>\n${html(summa!.toLocaleString('ru-RU'))} so‘m: ${html(sabab!)}`)
  revalidatePath(YOL)
  revalidatePath('/crm/maosh')
  redirect(xabarliYol(orqaga, { ok: 'Jarima yozildi — shu oy maoshidan ayiriladi.' }))
}

/** Hozir tekshirish (cron kutmasdan) */
export async function tekshir(fd: FormData) {
  await talabRol('manager', 'direktor')
  const orqaga = qaytish(fd)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('nazorat_yig')
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(orqaga, { ok: data ? `${data} ta yangi hodisa topildi.` : 'Yangi hodisa yo‘q.' }))
}

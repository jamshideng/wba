'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { summaOqi, matn, davrOqi, sonOqi, xabarliYol, xatoMatni, ichkiYol } from '@/lib/kiritish'

const YOL = '/crm/maosh/sozlamalar'

/** Qaytish faqat maosh sozlamalari ichiga. */
function qaytish(fd: FormData): string {
  const y = ichkiYol(fd.get('qaytish'))
  return y.startsWith(YOL) ? y : YOL
}

function yangila() {
  revalidatePath('/crm/maosh', 'layout')
}

/** Yangi doimiy tur (0118): masalan "Soliq" — ayiriladi. Nomni Jamshid o'zi beradi. */
export async function turQosh(fd: FormData) {
  await talabRol('admin', 'direktor')
  const orqaga = qaytish(fd)
  const nom = matn(fd.get('nom'))
  const ishora = fd.get('ishora') === '1' ? 1 : fd.get('ishora') === '-1' ? -1 : null
  if (!nom || nom.length > 60) redirect(xabarliYol(orqaga, { xato: 'Nomini yozing (60 belgigacha).' }))
  if (!ishora) redirect(xabarliYol(orqaga, { xato: 'Ayiriladimi yoki qo‘shiladimi — tanlang.' }))

  const supabase = await createClient()
  const { error } = await supabase.from('maosh_turlar').insert({ nom: nom!, ishora: ishora! })
  if (error) {
    redirect(xabarliYol(orqaga, { xato: error.code === '23505' ? 'Bunday nomli tur bor.' : xatoMatni(error) }))
  }
  yangila()
  redirect(xabarliYol(orqaga, { ok: `“${nom}” qo‘shildi. Endi ustozlarga summasini kiriting.` }))
}

/** Turni o'chirish/yoqish — o'chirilgan tur hech kimga qo'llanmaydi, summalar saqlanadi. */
export async function turFaol(fd: FormData) {
  await talabRol('admin', 'direktor')
  const orqaga = qaytish(fd)
  const id = sonOqi(fd.get('id'))
  if (!id) redirect(orqaga)
  const faol = fd.get('faol') === '1'

  const supabase = await createClient()
  const { error } = await supabase.from('maosh_turlar').update({ faol }).eq('id', id!)
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))
  yangila()
  redirect(xabarliYol(orqaga, { ok: faol ? 'Tur yoqildi.' : 'Tur o‘chirildi — maoshga qo‘llanmaydi.' }))
}

/** Ustozga doimiy summa: qaysi oydan, ixtiyoriy qaysi oygacha. Bir tur — bitta yozuv (yangilanadi). */
export async function doimiySaqla(fd: FormData) {
  await talabRol('admin', 'direktor')
  const orqaga = qaytish(fd)
  const teacher = matn(fd.get('teacher_id'))
  const tur = sonOqi(fd.get('tur_id'))
  const summa = summaOqi(fd.get('summa'))
  const dan = davrOqi(fd.get('dan'))
  const gacha = matn(fd.get('gacha')) ? davrOqi(fd.get('gacha')) : null
  if (!teacher || !tur) redirect(xabarliYol(orqaga, { xato: 'Turni tanlang.' }))
  if (!summa) redirect(xabarliYol(orqaga, { xato: 'Summa noto‘g‘ri. Masalan: 300000 yoki 300 ming.' }))
  if (!dan) redirect(xabarliYol(orqaga, { xato: 'Qaysi oydan — tanlang.' }))
  if (matn(fd.get('gacha')) && !gacha) redirect(xabarliYol(orqaga, { xato: 'Qaysi oygacha — noto‘g‘ri.' }))
  if (gacha && gacha < dan!) redirect(xabarliYol(orqaga, { xato: '“Gacha” oyi “dan” oyidan oldin bo‘lmasin.' }))

  const supabase = await createClient()
  const { error } = await supabase
    .from('maosh_doimiy')
    .upsert(
      { teacher_id: teacher!, tur_id: tur!, summa: summa!, dan: dan!, gacha, updated_at: new Date().toISOString() },
      { onConflict: 'teacher_id,tur_id' },
    )
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))
  yangila()
  redirect(xabarliYol(orqaga, { ok: 'Saqlandi. Tasdiqlanmagan oylar maoshi qayta hisoblandi.' }))
}

/** Doimiy summani olib tashlash. Tasdiqlangan oylar nusxada qoladi. */
export async function doimiyOchir(fd: FormData) {
  await talabRol('admin', 'direktor')
  const orqaga = qaytish(fd)
  const id = sonOqi(fd.get('id'))
  if (!id) redirect(orqaga)

  const supabase = await createClient()
  const { error } = await supabase.from('maosh_doimiy').delete().eq('id', id!)
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))
  yangila()
  redirect(xabarliYol(orqaga, { ok: 'Olib tashlandi. Tasdiqlangan oylar o‘zgarmaydi.' }))
}

/** Guruh turi stavkalari (0093) — individual / mini / IELTS, bitta o'quvchi uchun. */
export async function guruhTuriSaqla(fd: FormData) {
  const profil = await talabRol('admin', 'direktor')
  const orqaga = qaytish(fd)
  const qiymat: Record<string, number> = {}
  for (const k of ['individual', 'mini', 'ielts']) {
    const s = summaOqi(fd.get(k))
    if (!s) redirect(xabarliYol(orqaga, { xato: 'Uchala stavkani ham kiriting.' }))
    qiymat[k] = s!
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('settings')
    .update({ qiymat, ozgartirdi: profil.id })
    .eq('kalit', 'maosh.guruh_turi')
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))
  yangila()
  redirect(xabarliYol(orqaga, { ok: 'Guruh turi stavkalari saqlandi.' }))
}

/** Kechikish jarimasi (0100) — 1 daqiqa uchun so'm. */
export async function kechikishSaqla(fd: FormData) {
  const profil = await talabRol('admin', 'direktor')
  const orqaga = qaytish(fd)
  const s = summaOqi(fd.get('summa'))
  if (!s) redirect(xabarliYol(orqaga, { xato: 'Summa noto‘g‘ri.' }))
  const supabase = await createClient()
  const { error } = await supabase
    .from('settings')
    .update({ qiymat: s, ozgartirdi: profil.id })
    .eq('kalit', 'maosh.kechikish_jarima')
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))
  yangila()
  redirect(xabarliYol(orqaga, { ok: 'Kechikish jarimasi saqlandi.' }))
}

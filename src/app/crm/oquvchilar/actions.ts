'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, sanaOqi, sonOqi, summaOqi, telefonOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'

/**
 * Chegirma maydonlari — Qatnashuvdagidek ikki bosqich.
 * "Necha oy" bo'sh qolsa bosqich muddatsiz (bazada NULL).
 */
function chegirma(fd: FormData): Record<string, unknown> {
  const c1 = matn(fd.get('chegirma_summa')) ? summaOqi(fd.get('chegirma_summa')) ?? 0 : 0
  const c2 = matn(fd.get('chegirma2_summa')) ? summaOqi(fd.get('chegirma2_summa')) ?? 0 : 0
  return {
    chegirma_summa: c1,
    chegirma_oy: sonOqi(fd.get('chegirma_oy')) ?? '',
    chegirma2_summa: c2,
    chegirma2_oy: sonOqi(fd.get('chegirma2_oy')) ?? '',
    chegirma_sabab: matn(fd.get('chegirma_sabab')) ?? '',
  }
}

/** Uchala telefonni tekshiradi. Noto'g'ri bo'lsa — qaysi biri ekanini aytadi. */
function telefonlar(fd: FormData): { ota_tel: string | null; ona_tel: string | null; shaxsiy_tel: string | null } | string {
  const ota = telefonOqi(fd.get('ota_tel'))
  const ona = telefonOqi(fd.get('ona_tel'))
  const shax = telefonOqi(fd.get('shaxsiy_tel'))
  if (ota === undefined) return 'Ota telefoni noto‘g‘ri. Masalan: 90 123 45 67'
  if (ona === undefined) return 'Ona telefoni noto‘g‘ri. Masalan: 90 123 45 67'
  if (shax === undefined) return 'Shaxsiy telefon noto‘g‘ri. Masalan: 90 123 45 67'
  return { ota_tel: ota, ona_tel: ona, shaxsiy_tel: shax }
}

export async function oquvchiQosh(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const forma = '/crm/oquvchilar/yangi'

  const fish = matn(fd.get('fish'))
  if (!fish) redirect(xabarliYol(forma, { xato: 'Ism familyani yozing.' }))

  const tel = telefonlar(fd)
  if (typeof tel === 'string') redirect(xabarliYol(forma, { xato: tel }))

  const supabase = await createClient()
  const { data: id, error } = await supabase.rpc('oquvchi_qosh', {
    p: {
      fish,
      tugilgan_sana: sanaOqi(fd.get('tugilgan_sana')) ?? '',
      ...tel,
      izoh: matn(fd.get('izoh')) ?? '',
      group_id: matn(fd.get('group_id')) ?? '',
      boshlandi: sanaOqi(fd.get('boshlandi')) ?? '',
      ...chegirma(fd),
    },
  })

  if (error) redirect(xabarliYol(forma, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(`/crm/oquvchilar/${id}`, { ok: `O‘quvchi qo‘shildi: ${id}` }))
}

export async function oquvchiTahrir(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const id = matn(fd.get('id'))
  if (!id) redirect('/crm/oquvchilar')
  const forma = `/crm/oquvchilar/${id}/tahrir`

  const fish = matn(fd.get('fish'))
  if (!fish) redirect(xabarliYol(forma, { xato: 'Ism familyani yozing.' }))

  const tel = telefonlar(fd)
  if (typeof tel === 'string') redirect(xabarliYol(forma, { xato: tel }))

  const holat = (['faol', 'tanaffus', 'ketgan'] as const).find((h) => h === fd.get('holat'))
  if (!holat) redirect(xabarliYol(forma, { xato: 'Holatni tanlang.' }))

  const supabase = await createClient()
  const { error } = await supabase
    .from('students')
    .update({
      fish: fish!,
      tugilgan_sana: sanaOqi(fd.get('tugilgan_sana')),
      ...tel,
      izoh: matn(fd.get('izoh')),
      holat: holat!,
    })
    .eq('id', id!)

  if (error) redirect(xabarliYol(forma, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(`/crm/oquvchilar/${id}`, { ok: 'Ma’lumot saqlandi.' }))
}

export async function guruhgaBiriktir(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const studentId = matn(fd.get('student_id'))
  const groupId = matn(fd.get('group_id'))
  const yol = `/crm/oquvchilar/${studentId}`

  if (!studentId) redirect('/crm/oquvchilar')
  if (!groupId) redirect(xabarliYol(yol, { xato: 'Guruhni tanlang.' }))

  const supabase = await createClient()
  const { error } = await supabase.rpc('guruhga_biriktir', {
    p_student: studentId!,
    p_group: groupId!,
    p_boshlandi: sanaOqi(fd.get('boshlandi')),
    p_chegirma: chegirma(fd),
  })

  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: 'Guruhga biriktirildi. Oylar hisobi yozildi.' }))
}

export async function guruhdanChiqar(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const studentId = matn(fd.get('student_id'))
  const enrollmentId = matn(fd.get('enrollment_id'))
  const yol = `/crm/oquvchilar/${studentId}`
  if (!studentId || !enrollmentId) redirect('/crm/oquvchilar')

  const supabase = await createClient()
  const { error } = await supabase.rpc('guruhdan_chiqar', {
    p_enrollment: enrollmentId!,
    p_sana: sanaOqi(fd.get('sana')),
  })

  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: 'Guruhdan chiqarildi. Keyingi oylar hisobdan olindi.' }))
}

/**
 * Chegirmani istalgan vaqtda o'zgartirish. Hamma oylar qayta
 * hisoblanadi — Sheets formulasi ham shunday qiladi (0014).
 */
export async function chegirmaOzgartir(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const studentId = matn(fd.get('student_id'))
  const enrollmentId = matn(fd.get('enrollment_id'))
  const yol = `/crm/oquvchilar/${studentId}`
  if (!studentId || !enrollmentId) redirect('/crm/oquvchilar')

  const supabase = await createClient()
  const { data: soni, error } = await supabase.rpc('chegirma_ozgartir', {
    p_enrollment: enrollmentId!,
    p: chegirma(fd),
  })

  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: `Chegirma saqlandi. ${soni ?? 0} oyning hisobi qayta hisoblandi.` }))
}

/**
 * Tuzatish — shu oy uchun aniq summani ayirish (Sheets "Tuzatishlar",
 * 0029). Sababli kelmagan darslar yoki oy o'rtasida boshlagan bola.
 * Faqat admin va direktor; bazada ham tekshiriladi.
 */
export async function tuzatishQosh(fd: FormData) {
  await talabRol('admin', 'direktor')
  const studentId = matn(fd.get('student_id'))
  const enrollmentId = matn(fd.get('enrollment_id'))
  const yol = `/crm/oquvchilar/${studentId}`
  if (!studentId || !enrollmentId) redirect('/crm/oquvchilar')

  const davr = matn(fd.get('davr'))
  const summa = summaOqi(fd.get('summa'))
  const sabab = matn(fd.get('sabab'))
  if (!davr || !/^\d{4}-(0[1-9]|1[0-2])$/.test(davr)) redirect(xabarliYol(yol, { xato: 'Oyni tanlang.' }))
  if (!summa) redirect(xabarliYol(yol, { xato: 'Ayiriladigan summani yozing. Masalan: 150000 yoki 150.' }))
  if (!sabab) redirect(xabarliYol(yol, { xato: 'Sababini yozing — masalan: kasal, 3 dars.' }))

  const supabase = await createClient()
  const { error } = await supabase.rpc('tuzatish_qosh', {
    p_enrollment: enrollmentId!,
    p_davr: davr!,
    p_summa: summa!,
    p_sabab: sabab!,
  })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: `Tuzatish yozildi: ${davr} oyidan ${summa!.toLocaleString('ru-RU')} so‘m ayirildi.` }))
}

export async function tuzatishBekor(fd: FormData) {
  await talabRol('admin', 'direktor')
  const studentId = matn(fd.get('student_id'))
  const id = sonOqi(fd.get('id'))
  const yol = `/crm/oquvchilar/${studentId}`
  if (!studentId || !id) redirect('/crm/oquvchilar')

  const supabase = await createClient()
  const { error } = await supabase.rpc('tuzatish_bekor', { p_id: id!, p_sabab: matn(fd.get('sabab')) })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: 'Tuzatish bekor qilindi — o‘sha oy qayta hisoblandi.' }))
}

/** VIP — to'lamaydi, lekin faol hisobda (0030). Faqat admin va direktor. */
export async function vipOzgartir(fd: FormData) {
  await talabRol('admin', 'direktor')
  const studentId = matn(fd.get('student_id'))
  const enrollmentId = matn(fd.get('enrollment_id'))
  const yol = `/crm/oquvchilar/${studentId}`
  if (!studentId || !enrollmentId) redirect('/crm/oquvchilar')

  const vip = fd.get('vip') === '1'
  const dan = matn(fd.get('dan'))
  const supabase = await createClient()
  const { error } = await supabase.rpc('vip_ozgartir', { p_enrollment: enrollmentId!, p_vip: vip, p_dan: vip ? dan : null })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: vip ? `VIP qilindi${dan ? ` (${dan} dan)` : ''} — o‘sha oylardan hisob 0.` : 'VIP olib tashlandi — oylar qayta hisoblandi.' }))
}

/** Arxivga — hamma guruhdan chiqariladi, qarzi saqlanadi, shu ID bilan qaytariladi. */
export async function oquvchiArxivla(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const studentId = matn(fd.get('student_id'))
  const yol = `/crm/oquvchilar/${studentId}`
  if (!studentId) redirect('/crm/oquvchilar')

  const supabase = await createClient()
  const { error } = await supabase.rpc('oquvchi_arxivla', {
    p_student: studentId!,
    p_sana: sanaOqi(fd.get('sana')),
    p_sabab: matn(fd.get('sabab')),
  })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: 'Arxivga o‘tkazildi. Qarzi saqlanadi; qaytarish — shu sahifadan.' }))
}

export async function oquvchiArxivdan(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const studentId = matn(fd.get('student_id'))
  const yol = `/crm/oquvchilar/${studentId}`
  if (!studentId) redirect('/crm/oquvchilar')

  const supabase = await createClient()
  const { error } = await supabase.rpc('oquvchi_arxivdan', { p_student: studentId! })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: 'Arxivdan qaytarildi (shu ID bilan). Endi guruhga biriktiring.' }))
}

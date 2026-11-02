'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, xabarliYol, xatoMatni } from '@/lib/kiritish'

/**
 * Ota-ona ↔ farzand bog'lash (0116). Huquq va qoidalar bazada:
 * ota_ona_biriktir / ota_ona_uzish — admin, manager, direktor.
 * Qaytish yo'li faqat /crm/ ichida (ochiq redirect bo'lmasin).
 */
function qaytishYoli(fd: FormData, zaxira: string): string {
  const q = matn(fd.get('qaytish'))
  return q && q.startsWith('/crm/') && !q.startsWith('//') ? q : zaxira
}

/** "S012 · Ali Valiyev" yoki "S012" — datalist'dan kelgan qiymatdan ID */
function oquvchiId(v: FormDataEntryValue | null): string | null {
  const s = matn(v)
  const m = s?.match(/^\s*(S\d+)\b/i)
  return m ? m[1].toUpperCase() : null
}

export async function farzandBiriktir(fd: FormData) {
  await talabRol('admin', 'direktor', 'manager')
  const otaOna = matn(fd.get('ota_ona'))
  const student = oquvchiId(fd.get('student'))
  const yol = qaytishYoli(fd, otaOna ? `/crm/ota-onalar/${otaOna}` : '/crm/ota-onalar')
  if (!otaOna) redirect(xabarliYol(yol, { xato: 'Ota-onani tanlang.' }))
  if (!student) redirect(xabarliYol(yol, { xato: 'O‘quvchini ro‘yxatdan tanlang (masalan: S012 · Ism Familiya).' }))

  const supabase = await createClient()
  const { error } = await supabase.rpc('ota_ona_biriktir', { p_ota_ona: otaOna!, p_student: student! })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: `${student} ota-onaga biriktirildi.` }))
}

export async function farzandUzish(fd: FormData) {
  await talabRol('admin', 'direktor', 'manager')
  const student = oquvchiId(fd.get('student'))
  const yol = qaytishYoli(fd, '/crm/ota-onalar')
  if (!student) redirect(xabarliYol(yol, { xato: 'O‘quvchi topilmadi.' }))

  const supabase = await createClient()
  const { error } = await supabase.rpc('ota_ona_uzish', { p_student: student! })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: `${student} ota-onadan uzildi.` }))
}

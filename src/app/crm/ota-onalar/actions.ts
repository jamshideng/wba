'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { farzandQiymati } from '@/lib/farzand'

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
  // 0117 — "S:S012" / "L:<uuid>" (farzand tanlash) yoki eski "student" maydoni
  const farzand = farzandQiymati(fd.get('farzand')) ?? (oquvchiId(fd.get('student')) ? { turi: 'oquvchi' as const, id: oquvchiId(fd.get('student'))! } : null)
  const yol = qaytishYoli(fd, otaOna ? `/crm/ota-onalar/${otaOna}` : '/crm/ota-onalar')
  if (!otaOna) redirect(xabarliYol(yol, { xato: 'Ota-onani tanlang.' }))
  if (!farzand) redirect(xabarliYol(yol, { xato: 'Farzandni ro‘yxatdan tanlang.' }))

  const supabase = await createClient()
  const { error } =
    farzand!.turi === 'oquvchi'
      ? await supabase.rpc('ota_ona_biriktir', { p_ota_ona: otaOna!, p_student: farzand!.id })
      : await supabase.rpc('ota_ona_lid_biriktir', { p_ota_ona: otaOna!, p_lead: farzand!.id })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: farzand!.turi === 'oquvchi' ? `${farzand!.id} ota-onaga biriktirildi.` : 'Sinov darsidagi bola ota-onaga biriktirildi.' }))
}

export async function farzandUzish(fd: FormData) {
  await talabRol('admin', 'direktor', 'manager')
  const student = oquvchiId(fd.get('student'))
  const lid = matn(fd.get('lid'))
  const yol = qaytishYoli(fd, '/crm/ota-onalar')
  if (!student && !(lid && /^[0-9a-f-]{36}$/i.test(lid))) redirect(xabarliYol(yol, { xato: 'Farzand topilmadi.' }))

  const supabase = await createClient()
  const { error } = student
    ? await supabase.rpc('ota_ona_uzish', { p_student: student })
    : await supabase.rpc('ota_ona_lid_uzish', { p_lead: lid! })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(yol, { ok: `${student ?? 'Sinov darsidagi bola'} ota-onadan uzildi.` }))
}

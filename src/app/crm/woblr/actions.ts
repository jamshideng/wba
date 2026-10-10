'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabProfil, getUstoz, adminmi } from '@/lib/auth'
import { matn, sonOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'
import type { WoblrReason } from '@/lib/types'
import { woblarXato } from '@/lib/woblar-chegara'

const SABABLAR: WoblrReason[] = ['faollik', 'uy_vazifasi', 'yordam', 'qoida', 'boshqa']

/**
 * Woblar berish — dars tashqarisida ham (masalan davomatdan keyin).
 * Ustoz faqat O'Z o'quvchisiga bera oladi — buni RLS ham tekshiradi
 * (woblr_teacher_insert: app_teaches_student va bergan_profile = auth.uid()).
 */
export async function woblrBer(fd: FormData) {
  const profil = await talabProfil()
  const ustoz = await getUstoz()
  const qaytish = matn(fd.get('qaytish'))
  const yol = qaytish?.startsWith('/crm/woblr')
    ? qaytish
    : `/crm/woblr${matn(fd.get('guruh')) ? `?guruh=${matn(fd.get('guruh'))}` : ''}`

  if (!ustoz && !adminmi(profil.rol)) {
    redirect(xabarliYol(yol, { xato: 'Woblar berish huquqingiz yo‘q.' }))
  }

  const studentId = matn(fd.get('student_id'))
  const ball = sonOqi(fd.get('ball'))
  const sabab = SABABLAR.find((s) => s === fd.get('sabab')) ?? 'faollik'

  if (!studentId) redirect(xabarliYol(yol, { xato: 'O‘quvchini tanlang.' }))
  // Ustozga −10…+10, admin/direktorga chegara yo'q (0057)
  const chegaraXato = ball === null ? 'Woblar sonini yozing.' : woblarXato(ball, adminmi(profil.rol))
  if (chegaraXato) redirect(xabarliYol(yol, { xato: chegaraXato }))

  const supabase = await createClient()
  const { error } = await supabase.from('woblr').insert({
    student_id: studentId!,
    teacher_id: ustoz?.id ?? null,
    bergan_profile: profil.id,
    ball: ball!,
    sabab,
    izoh: matn(fd.get('izoh')),
    lesson_id: null,
  })

  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm/woblr')
  redirect(xabarliYol(yol, { ok: `${ball! > 0 ? '+' : ''}${ball} woblar yozildi.` }))
}

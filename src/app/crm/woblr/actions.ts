'use server'

import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabProfil, getUstoz, adminmi } from '@/lib/auth'
import { matn, sonOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { woblarXato } from '@/lib/woblar-chegara'
import { woblarXabariniYubor } from '@/lib/woblar-xabar'

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
  // Ro'yxatda borligini baza tekshiradi (0108)
  const sabab = matn(fd.get('sabab')) ?? 'faollik'

  if (!studentId) redirect(xabarliYol(yol, { xato: 'O‘quvchini tanlang.' }))
  // Ustozga −10…+10, admin/direktorga chegara yo'q (0057)
  const chegaraXato = ball === null ? 'Woblar sonini yozing.' : woblarXato(ball)
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
    // Qaysi guruh limitidan — formadagi guruh; bo'sh bo'lsa baza o'zi topadi (0064)
    group_id: matn(fd.get('guruh')),
  })

  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  // O'quvchiga telefon va Telegram xabari (sayt bildirishnomasini trigger yozdi, 0071)
  after(() => woblarXabariniYubor(supabase, studentId!))

  revalidatePath('/crm/woblr')
  redirect(xabarliYol(yol, { ok: `${ball! > 0 ? '+' : ''}${ball} woblar yozildi.` }))
}

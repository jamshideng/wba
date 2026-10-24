'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { summaOqi, matn, davrOqi, sanaOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'
import type { PaymentMethod } from '@/lib/types'

const USULLAR: PaymentMethod[] = ['naqd', 'click', 'terminal']

/** Qaytish manzili faqat CRM ichida bo'lsin — tashqi saytga yo'naltirib bo'lmasin. */
function qaytish(fd: FormData, zaxira: string): string {
  const y = String(fd.get('qaytish') ?? '')
  return y.startsWith('/crm/') ? y : zaxira
}

/**
 * To'lov kiritish. Botdagi "+Kamron 550" ning veb ko'rinishi:
 * o'quvchi → guruh → summa → usul. Usul MAJBURIY (bazada ham check bor).
 * Tasdiq berilmaydi — uni faqat direktor qo'yadi.
 */
export async function tolovQosh(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const orqaga = qaytish(fd, '/crm/tolovlar')
  const forma = `/crm/tolovlar/yangi?oquvchi=${encodeURIComponent(String(fd.get('student_id') ?? ''))}`

  const studentId = matn(fd.get('student_id'))
  const summa = summaOqi(fd.get('summa'))
  const usul = USULLAR.find((u) => u === fd.get('usul'))
  const davr = davrOqi(fd.get('davr'))
  const sana = sanaOqi(fd.get('sana'))

  const xato =
    !studentId ? 'O‘quvchi tanlanmagan.' :
    !summa ? 'Summa noto‘g‘ri. Masalan: 650000 yoki 650 (minglarda).' :
    !usul ? 'To‘lov usulini tanlang.' :
    !davr ? 'Qaysi oy uchun ekanini tanlang.' :
    !sana ? 'To‘lov sanasi noto‘g‘ri.' :
    null
  if (xato) redirect(xabarliYol(forma, { xato }))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('payments').insert({
    student_id: studentId!,
    enrollment_id: matn(fd.get('enrollment_id')),
    summa: summa!,
    usul: usul!,
    davr: davr!,
    sana: sana!,
    izoh: matn(fd.get('izoh')),
    qabul_qildi: user?.id ?? null,
    tasdiqlangan: false,
    manba: 'crm',
  })

  if (error) redirect(xabarliYol(forma, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(orqaga, { ok: `To‘lov yozildi: ${summa!.toLocaleString('ru-RU')} so‘m. Direktor tasdig‘i kutilmoqda.` }))
}

/**
 * Tasdiqlash — faqat direktor. Bazadagi trigger ham tekshiradi,
 * kim va qachon tasdiqlaganini o'zi yozadi.
 */
export async function tolovTasdiqla(fd: FormData) {
  await talabRol('direktor')
  const orqaga = qaytish(fd, '/crm/tolovlar?filtr=tasdiqlanmagan')

  const idlar = fd.getAll('id').map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0)
  if (!idlar.length) redirect(xabarliYol(orqaga, { xato: 'Tasdiqlanadigan to‘lov tanlanmagan.' }))

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payments')
    .update({ tasdiqlangan: true })
    .in('id', idlar)
    .eq('bekor', false)
    .eq('tasdiqlangan', false)
    .select('id')

  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(orqaga, { ok: `${data?.length ?? 0} ta to‘lov tasdiqlandi.` }))
}

/**
 * Bekor qilish. To'lov o'chirilmaydi — bekor=true bo'ladi va sababi
 * yoziladi, tarixda qoladi (botdagi /bekor ham shunday bo'lishi kerak edi).
 */
export async function tolovBekor(fd: FormData) {
  await talabRol('admin', 'direktor')
  const orqaga = qaytish(fd, '/crm/tolovlar')

  const id = Number(fd.get('id'))
  const sabab = matn(fd.get('sabab'))
  if (!Number.isInteger(id) || id <= 0) redirect(xabarliYol(orqaga, { xato: 'To‘lov topilmadi.' }))
  if (!sabab) redirect(xabarliYol(orqaga, { xato: 'Bekor qilish sababini yozing.' }))

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payments')
    .update({ bekor: true, bekor_sabab: sabab })
    .eq('id', id)
    .eq('bekor', false)
    .select('id')

  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))
  if (!data?.length) redirect(xabarliYol(orqaga, { xato: 'To‘lov topilmadi yoki allaqachon bekor qilingan.' }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(orqaga, { ok: 'To‘lov bekor qilindi. Yozuv tarixda qoladi.' }))
}

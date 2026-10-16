'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { BOT_NOMI } from '@/lib/telegram'
import { TAKLIF_COOKIE, type Taklif, type TaklifKim as Kim } from '@/lib/telegram-taklif'

const YOL = '/crm/telegram'
const kimOqi = (v: FormDataEntryValue | null): Kim => (v === 'oquvchi' ? 'oquvchi' : 'ota_ona')

async function saqla(royxat: Taklif[], qaytish: string) {
  const kuki = await cookies()
  kuki.set(TAKLIF_COOKIE, JSON.stringify(royxat), { httpOnly: true, sameSite: 'lax', maxAge: 600, path: YOL })
  redirect(qaytish)
}

/** Bitta o'quvchi yoki ota-ona uchun 7 kunlik bir martalik havola */
export async function taklifOl(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const student = matn(fd.get('student_id'))
  const fish = matn(fd.get('fish')) ?? ''
  const kim = kimOqi(fd.get('kim'))
  const qaytish = matn(fd.get('qaytish'))?.startsWith(YOL) ? matn(fd.get('qaytish'))! : YOL
  if (!student) redirect(qaytish)

  const supabase = await createClient()
  const { data: token, error } = await supabase.rpc('telegram_taklif_ol', { p_student: student!, p_kim: kim })
  if (error || !token) redirect(xabarliYol(qaytish, { xato: xatoMatni(error ?? { message: 'Havola yaratilmadi.' }) }))
  await saqla([{ student_id: student!, fish, kim, havola: `https://t.me/${BOT_NOMI}?start=${token}` }], qaytish)
}

/** Ro'yxatdagi (filtrlangan) hamma ulanmaganlar uchun havolalar — bittada nusxalash */
export async function takliflarOl(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const kim = kimOqi(fd.get('kim'))
  const qaytish = matn(fd.get('qaytish'))?.startsWith(YOL) ? matn(fd.get('qaytish'))! : YOL
  const idlar = String(fd.get('idlar') ?? '').split(',').filter(Boolean).slice(0, 25) // cookie 4 KB ga sig'sin
  const nomlar = new Map(String(fd.get('nomlar') ?? '').split('\n').map((q) => q.split('\t') as [string, string]))
  if (!idlar.length) redirect(qaytish)

  const supabase = await createClient()
  const royxat: Taklif[] = []
  for (const id of idlar) {
    const { data: token, error } = await supabase.rpc('telegram_taklif_ol', { p_student: id, p_kim: kim })
    if (error || !token) redirect(xabarliYol(qaytish, { xato: xatoMatni(error ?? { message: 'Havola yaratilmadi.' }) }))
    royxat.push({ student_id: id, fish: nomlar.get(id) ?? id, kim, havola: `https://t.me/${BOT_NOMI}?start=${token}` })
  }
  await saqla(royxat, qaytish)
}

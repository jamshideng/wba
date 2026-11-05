'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { xabarliYol, xatoMatni } from '@/lib/kiritish'
import { elonFormadan } from '@/lib/elon'
import { telegramElon } from '@/lib/elon-yuborish'

const YOL = '/crm/xabarlar'

/**
 * E'lonni bot orqali yuborish.
 *
 * Hammasi admin nomidan, RLS bilan (service_role kerak emas): e'lon va
 * yetkazish qatorlari elonlar_admin_write / elon_yetkazish_admin_write
 * siyosatlari bilan yoziladi, oluvchilar elon_oluvchilar() dan keladi.
 * Telegram'ga faqat server murojaat qiladi (token brauzerga chiqmaydi).
 *
 * Markaz hajmida (bir necha yuz chat) yuborish shu so'rov ichida
 * tugaydi: 25 tadan parallel, sekundiga ~25 xabar (page.tsx: maxDuration).
 */
export async function elonYuborish(fd: FormData) {
  await talabRol('admin', 'direktor')

  const e = elonFormadan(fd)
  if (!e.matn) redirect(xabarliYol(YOL, { xato: 'Xabar matni bo‘sh.' }))
  if (!e.kimga.length) redirect(xabarliYol(YOL, { xato: 'Kimga yuborilishini tanlang.' }))

  const supabase = await createClient()

  const { data: auditoriya, error: xatoAud } = await supabase.rpc('elon_oluvchilar', { p_kimga: e.kimga, p_filtr: e.filtr })
  if (xatoAud) redirect(xabarliYol(YOL, { xato: xatoMatni(xatoAud) }))

  const n = await telegramElon(supabase, e, auditoriya ?? [])
  if (n.xato) redirect(xabarliYol(YOL, { xato: n.xato }))
  if (!n.jami) redirect(xabarliYol(YOL, { xato: 'Tanlanganlardan hech kim botga ulanmagan — xabar yuborilmadi.' }))
  revalidatePath(YOL)
  redirect(
    xabarliYol(YOL, {
      ok: `${n.yetdi} ta chatga yetkazildi${n.yetmadi ? ` · ${n.yetmadi} tasiga yetmadi (botni bloklagan yoki xato)` : ''}.`,
    }),
  )
}

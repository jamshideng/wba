'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { ichkiYol, sanaOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'

/**
 * Reytingni qo'lda hisoblash yoki qayta hisoblash (rahbariyat). Odatda
 * cron qiladi (0141): haftalik — yakshanba kechasi, oylik — N-sana kechasi.
 * Shu davr avval hisoblangan bo'lsa — joriy sozlamalar bilan almashtiriladi.
 */
export async function reytingHisobla(fd: FormData) {
  await talabRol('admin', 'direktor', 'manager')
  const tur = fd.get('tur') === 'oylik' ? 'oylik' : 'haftalik'
  const y = ichkiYol(fd.get('qaytish'))
  const yol = y.startsWith('/crm/reyting') ? y : '/crm/reyting'

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('reyting_hisobla', { p_tur: tur, p_sana: sanaOqi(fd.get('sana')) })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm/reyting', 'layout')
  const asos = yol.split('?')[0]
  redirect(xabarliYol(`${asos}?tur=${tur}&d=${data}`, { ok: `${tur === 'oylik' ? 'Oylik' : 'Haftalik'} reyting hisoblandi.` }))
}

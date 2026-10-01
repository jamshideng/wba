'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { summaOqi, matn, sanaOqi, xabarliYol, xatoMatni, ichkiYol } from '@/lib/kiritish'
import { toifami, type Toifa } from './toifalar'

const YOL = '/crm/xarajatlar'

/** Qaytish faqat shu sahifaga (filtrlar bilan) — boshqa joyga yo'naltirib bo'lmasin. */
function qaytish(fd: FormData): string {
  const y = ichkiYol(fd.get('qaytish'))
  return y.startsWith(YOL) ? y : YOL
}

/** Xarajat kiritish — admin va direktor (RLS ham shuni talab qiladi, 0033). */
export async function xarajatQosh(fd: FormData) {
  await talabRol('admin', 'direktor')
  const orqaga = qaytish(fd)

  const summa = summaOqi(fd.get('summa'))
  const toifa = fd.get('toifa')
  const sana = sanaOqi(fd.get('sana'))

  const xato =
    !toifami(toifa) ? 'Toifani tanlang.' :
    !summa ? 'Summa noto‘g‘ri. Masalan: 3500000, 3500 ming yoki 3.5 mln.' :
    !sana ? 'Sana noto‘g‘ri.' :
    null
  if (xato) redirect(xabarliYol(orqaga, { xato }))

  const supabase = await createClient()
  const { error } = await supabase.from('xarajatlar').insert({
    toifa: toifa as Toifa,
    summa: summa!,
    sana: sana!,
    izoh: matn(fd.get('izoh')),
  })
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))

  revalidatePath(YOL)
  redirect(xabarliYol(orqaga, { ok: 'Xarajat yozildi.' }))
}

/** O'chirilmaydi — sababi bilan bekor qilinadi (audit_log da iz qoladi). */
export async function xarajatBekor(fd: FormData) {
  await talabRol('admin', 'direktor')
  const orqaga = qaytish(fd)
  const id = Number(fd.get('id'))
  const sabab = matn(fd.get('sabab'))
  if (!Number.isInteger(id) || id <= 0) redirect(orqaga)
  if (!sabab) redirect(xabarliYol(orqaga, { xato: 'Bekor qilish sababini yozing.' }))

  const supabase = await createClient()
  const { error } = await supabase.from('xarajatlar').update({ bekor: true, bekor_sabab: sabab! }).eq('id', id)
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))

  revalidatePath(YOL)
  redirect(xabarliYol(orqaga, { ok: `#${id} bekor qilindi.` }))
}

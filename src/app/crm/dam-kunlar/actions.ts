'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, sanaOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { kunlarOraligi } from '@/lib/davomat-umumiy'

const YOL = '/crm/dam-kunlar'

/**
 * Kanikul / bayram — bir kun yoki oraliq (dan–gacha). Shu kunlari butun
 * markazda dars yo'q: davomat so'ralmaydi, jurnalda "dam" bo'ladi (0036).
 * RLS: faqat admin va direktor yoza oladi.
 */
export async function damKunQosh(fd: FormData) {
  await talabRol('admin', 'direktor')
  const dan = sanaOqi(fd.get('dan'))
  const gacha = sanaOqi(fd.get('gacha')) ?? dan
  const sabab = matn(fd.get('sabab'))
  if (!dan) redirect(xabarliYol(YOL, { xato: 'Sanani tanlang.' }))
  if (!sabab) redirect(xabarliYol(YOL, { xato: 'Sababini yozing — masalan: Ustozlar kuni, kuzgi kanikul.' }))
  if (gacha! < dan!) redirect(xabarliYol(YOL, { xato: '“Gacha” sanasi “dan”dan oldin bo‘lmasin.' }))

  const kunlar = kunlarOraligi(dan!, gacha!)
  if (kunlar.length > 60) redirect(xabarliYol(YOL, { xato: 'Bir martada 60 kundan ortiq belgilab bo‘lmaydi.' }))

  const supabase = await createClient()
  const { error } = await supabase
    .from('dam_kunlar')
    .upsert(kunlar.map((sana) => ({ sana, sabab: sabab! })), { onConflict: 'sana' })
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(YOL, { ok: `${kunlar.length} kun dam deb belgilandi: ${sabab}. Bu kunlari davomat so‘ralmaydi.` }))
}

export async function damKunOchir(fd: FormData) {
  await talabRol('admin', 'direktor')
  const sana = sanaOqi(fd.get('sana'))
  if (!sana) redirect(YOL)

  const supabase = await createClient()
  const { error } = await supabase.from('dam_kunlar').delete().eq('sana', sana!)
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(YOL, { ok: `${sana} yana oddiy dars kuni.` }))
}

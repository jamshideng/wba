'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, sanaOqi, sonOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { bugunToshkent } from '@/lib/format'

const XODIM = ['admin', 'direktor', 'qabulxona'] as const

function qaytish(fd: FormData): string {
  const y = String(fd.get('qaytish') ?? '')
  return y.startsWith('/crm/ustoz-davomati') ? y : '/crm/ustoz-davomati'
}

function tekshir(fd: FormData, yol: string) {
  const sana = sanaOqi(fd.get('sana'))
  const daqiqa = sonOqi(fd.get('daqiqa'))
  if (!sana) redirect(xabarliYol(yol, { xato: 'Sanani tanlang.' }))
  if (sana! > bugunToshkent()) redirect(xabarliYol(yol, { xato: 'Kelajakdagi sanaga kechikish yozib bo‘lmaydi.' }))
  if (!daqiqa || daqiqa < 1 || daqiqa > 300) redirect(xabarliYol(yol, { xato: 'Daqiqa 1 dan 300 gacha bo‘lsin.' }))
  return { sana: sana!, daqiqa: daqiqa!, sabab: matn(fd.get('sabab'))?.slice(0, 500) ?? null }
}

function tugat(yol: string, ok: string): never {
  revalidatePath('/crm/ustoz-davomati')
  revalidatePath('/crm/hisobotlar')
  revalidatePath('/crm/ustozlar', 'layout')
  redirect(xabarliYol(yol, { ok }))
}

/** Saytda kiritish: guruh tanlanadi, ustoz — DOIM guruhning ustozi (Jamshid, 06.10). */
export async function kechikishQosh(fd: FormData) {
  await talabRol(...XODIM)
  const yol = qaytish(fd)
  const guruh = matn(fd.get('group_id'))
  if (!guruh) redirect(xabarliYol(yol, { xato: 'Guruhni tanlang.' }))
  const t = tekshir(fd, yol)

  const supabase = await createClient()
  const { data: g } = await supabase.from('groups').select('teacher_id').eq('id', guruh!).maybeSingle()
  const ustoz = (g?.teacher_id as string | null) ?? null
  if (!ustoz) redirect(xabarliYol(yol, { xato: 'Bu guruhga ustoz biriktirilmagan — avval guruhga ustoz biriktiring.' }))

  const { error } = await supabase.from('ustoz_kechikish').insert({ ...t, group_id: guruh!, teacher_id: ustoz! })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  tugat(yol, `Kechikish yozildi: ${t.daqiqa} daqiqa.`)
}

/** Faqat saytda kiritilganlar (Sheets'dagisi Sheets'da tahrirlanadi — sinxron qaytarib yozadi). */
export async function kechikishSaqla(fd: FormData) {
  await talabRol(...XODIM)
  const yol = qaytish(fd)
  const id = matn(fd.get('id'))
  if (!id) redirect(yol)
  const t = tekshir(fd, yol)

  const supabase = await createClient()
  const { data, error } = await supabase.from('ustoz_kechikish').update(t).eq('id', id!).is('sheets_id', null).select('id')
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  if (!data?.length) redirect(xabarliYol(yol, { xato: 'Sheets’dan kelgan yozuvni Sheets’da tahrirlang.' }))
  tugat(yol, 'Saqlandi.')
}

export async function kechikishOchir(fd: FormData) {
  await talabRol(...XODIM)
  const yol = qaytish(fd)
  const id = matn(fd.get('id'))
  if (!id) redirect(yol)

  const supabase = await createClient()
  const { data, error } = await supabase.from('ustoz_kechikish').delete().eq('id', id!).is('sheets_id', null).select('id')
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  if (!data?.length) redirect(xabarliYol(yol, { xato: 'Sheets’dan kelgan yozuvni Sheets’da o‘chiring.' }))
  tugat(yol, 'O‘chirildi.')
}

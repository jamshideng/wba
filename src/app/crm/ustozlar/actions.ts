'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, telefonOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'

const USTOZLAR = '/crm/ustozlar'
const YOL = USTOZLAR

export async function ustozQosh(fd: FormData) {
  await talabRol('admin', 'direktor')

  const ism = matn(fd.get('ism'))
  const telefon = telefonOqi(fd.get('telefon'))
  if (!ism) redirect(xabarliYol(YOL, { xato: 'Ustoz ismini yozing.' }))
  if (telefon === undefined) redirect(xabarliYol(YOL, { xato: 'Telefon noto‘g‘ri. Masalan: 90 123 45 67' }))

  const supabase = await createClient()
  // Sheets bilan bir xil ko'rinish: U01, U02 ...
  const { data: id, error: xatoId } = await supabase.rpc('keyingi_id', {
    p_jadval: 'teachers',
    p_prefiks: 'U',
    p_uzunlik: 2,
  })
  if (xatoId || !id) redirect(xabarliYol(YOL, { xato: xatoMatni(xatoId) }))

  const { error } = await supabase.from('teachers').insert({ id: id!, ism: ism!, telefon: telefon ?? null })
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(YOL, { ok: `Ustoz qo‘shildi: ${ism} (${id}).` }))
}

export async function ustozTahrir(fd: FormData) {
  await talabRol('admin', 'direktor')

  const id = matn(fd.get('id'))
  const ism = matn(fd.get('ism'))
  const telefon = telefonOqi(fd.get('telefon'))
  const holat = fd.get('holat') === 'bloklangan' ? 'bloklangan' : 'faol'
  // Ustoz sahifasidan saqlansa - o'sha sahifaga qaytadi
  const YOL = fd.get('qayt') === 'sahifa' && id ? `/crm/ustozlar/${encodeURIComponent(id)}` : USTOZLAR

  if (!id || !ism) redirect(xabarliYol(YOL, { xato: 'Ustoz ismini yozing.' }))
  if (telefon === undefined) redirect(xabarliYol(YOL, { xato: 'Telefon noto‘g‘ri. Masalan: 90 123 45 67' }))

  const supabase = await createClient()
  const { error } = await supabase
    .from('teachers')
    .update({ ism: ism!, telefon: telefon ?? null, holat })
    .eq('id', id!)
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(YOL, { ok: `${ism} saqlandi.` }))
}

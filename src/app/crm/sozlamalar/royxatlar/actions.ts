'use server'

import { randomUUID } from 'node:crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, xabarliYol } from '@/lib/kiritish'
import { ROYXAT_TURLARI, type RoyxatTur } from '@/lib/royxat'

const YOL = '/crm/sozlamalar/royxatlar'

function turOqi(v: FormDataEntryValue | null): RoyxatTur {
  const tur = ROYXAT_TURLARI.find((t) => t === v)
  if (!tur) redirect(xabarliYol(YOL, { xato: 'Ro‘yxat topilmadi.' }))
  return tur
}

function xatoMatn(e: { code?: string; message?: string }): string {
  return e.code === '23505' ? 'Bunday nomli variant allaqachon bor.' : (e.message ?? 'Saqlanmadi.')
}

export async function variantQosh(fd: FormData) {
  await talabRol('admin', 'direktor', 'manager')
  const tur = turOqi(fd.get('tur'))
  const nom = matn(fd.get('nom'))
  if (!nom) redirect(xabarliYol(YOL, { xato: 'Variant nomini yozing.' }))

  const supabase = await createClient()
  // "Boshqa" (tartib 1000) doim oxirida qoladi
  const { data: oxirgi } = await supabase
    .from('royxatlar')
    .select('tartib')
    .eq('tur', tur)
    .lt('tartib', 1000)
    .order('tartib', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('royxatlar').insert({
    tur,
    kalit: `k_${randomUUID().replace(/-/g, '').slice(0, 10)}`,
    nom: nom!,
    tartib: (oxirgi?.tartib ?? 0) + 10,
  })
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatn(error) }))
  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(YOL, { ok: `“${nom}” qo‘shildi.` }))
}

export async function variantNomi(fd: FormData) {
  await talabRol('admin', 'direktor', 'manager')
  const tur = turOqi(fd.get('tur'))
  const kalit = matn(fd.get('kalit'))
  const nom = matn(fd.get('nom'))
  if (!kalit || !nom) redirect(xabarliYol(YOL, { xato: 'Variant nomini yozing.' }))

  const supabase = await createClient()
  const { error } = await supabase.from('royxatlar').update({ nom: nom! }).eq('tur', tur).eq('kalit', kalit!)
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatn(error) }))
  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(YOL, { ok: 'Nom saqlandi. Eski yozuvlarda ham yangi nom ko‘rinadi.' }))
}

export async function variantHolat(fd: FormData) {
  await talabRol('admin', 'direktor', 'manager')
  const tur = turOqi(fd.get('tur'))
  const kalit = matn(fd.get('kalit'))
  const faol = fd.get('faol') === '1'
  if (!kalit) redirect(YOL)

  const supabase = await createClient()
  const { error } = await supabase.from('royxatlar').update({ faol }).eq('tur', tur).eq('kalit', kalit!)
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatn(error) }))
  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(YOL, { ok: faol ? 'Variant qaytarildi.' : 'Yashirildi. Eski yozuvlarda ko‘rinib turadi.' }))
}

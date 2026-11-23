'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabProfil, adminmi } from '@/lib/auth'
import { matn, sanaOqi, sonOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'

/*
 * 0142 — kitoblar hisobi. Huquq bazada (RLS + funksiyalar):
 * katalog/kirim/berish — direktor, admin, manager; buyurtma — ustoz.
 * Bu yerdagi rol tekshiruvi faqat tushunarli xabar uchun.
 */

const YOL = '/crm/kitoblar'

function kodNormal(v: FormDataEntryValue | null): string | null {
  const k = String(v ?? '').trim().toUpperCase().replace(/\s+/g, '')
  if (!k) return null
  return k.startsWith('KT-') ? k : `KT-${k.replace(/^KT/, '')}`
}

async function rahbariyat(yol: string) {
  const profil = await talabProfil()
  if (!adminmi(profil.asl_rol ?? profil.rol)) redirect(xabarliYol(yol, { xato: 'Bu amal direktor, admin yoki manager uchun.' }))
  return profil
}

export async function kitobQosh(fd: FormData) {
  const yol = `${YOL}?tab=katalog`
  await rahbariyat(yol)
  const nom = matn(fd.get('nom'))
  if (!nom) redirect(xabarliYol(yol, { xato: 'Kitob nomini yozing.' }))
  const supabase = await createClient()
  const { error } = await supabase.from('kitoblar').insert({ nom, subject_id: matn(fd.get('fan')) })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(yol, { ok: `«${nom}» katalogga qo‘shildi.` }))
}

export async function kitobHolati(fd: FormData) {
  const yol = `${YOL}?tab=katalog`
  await rahbariyat(yol)
  const id = matn(fd.get('id'))
  const holat = fd.get('holat') === 'arxiv' ? 'arxiv' : 'faol'
  if (!id) redirect(yol)
  const supabase = await createClient()
  const { error } = await supabase.from('kitoblar').update({ holat, updated_at: new Date().toISOString() }).eq('id', id!)
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(yol, { ok: holat === 'arxiv' ? 'Kitob arxivga o‘tdi.' : 'Kitob yana faol.' }))
}

export async function kirimQosh(fd: FormData) {
  const yol = `${YOL}?tab=kirim`
  await rahbariyat(yol)
  const kitob = matn(fd.get('kitob'))
  const soni = sonOqi(fd.get('soni'))
  const sana = sanaOqi(fd.get('sana'))
  if (!kitob) redirect(xabarliYol(yol, { xato: 'Kitobni tanlang.' }))
  if (!soni || soni < 1) redirect(xabarliYol(yol, { xato: 'Sonini to‘g‘ri yozing (1 va undan ko‘p).' }))
  const supabase = await createClient()
  const { error } = await supabase.from('kitob_kirim').insert({
    kitob_id: kitob,
    soni,
    ...(sana ? { sana } : {}),
    izoh: matn(fd.get('izoh')),
  })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(yol, { ok: `Kirim yozildi: ${soni} ta.` }))
}

export async function kitobBuyurtmaBer(fd: FormData) {
  const guruh = matn(fd.get('guruh'))
  const yol = `${YOL}?tab=buyurtma${guruh ? `&guruh=${encodeURIComponent(guruh)}` : ''}`
  const kitob = matn(fd.get('kitob'))
  const oquvchilar = fd.getAll('oquvchi').map(String).filter(Boolean)
  if (!guruh || !kitob) redirect(xabarliYol(yol, { xato: 'Guruh va kitobni tanlang.' }))
  if (oquvchilar.length === 0) redirect(xabarliYol(yol, { xato: 'Kamida bitta o‘quvchini belgilang.' }))
  const supabase = await createClient()
  const { data: kod, error } = await supabase.rpc('kitob_buyurtma', {
    p_kitob: kitob!,
    p_group: guruh!,
    p_oquvchilar: oquvchilar,
  })
  if (error || !kod) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(`${YOL}?tab=mening`, { ok: `Buyurtma qabul qilindi: ${kod} (${oquvchilar.length} ta). Kodni adminga ayting.` }))
}

export async function kitobBerildi(fd: FormData) {
  const yol = `${YOL}?tab=buyurtmalar`
  await rahbariyat(yol)
  const kod = kodNormal(fd.get('kod'))
  if (!kod) redirect(xabarliYol(yol, { xato: 'Kodni yozing. Masalan: KT-7K4P2X' }))
  const supabase = await createClient()
  const { error } = await supabase.rpc('kitob_berildi', { p_kod: kod! })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(yol, { ok: `${kod} — berildi, ombordan ayirildi.` }))
}

export async function kitobBekor(fd: FormData) {
  const qaytish = matn(fd.get('qaytish')) === 'mening' ? 'mening' : 'buyurtmalar'
  const yol = `${YOL}?tab=${qaytish}`
  const kod = kodNormal(fd.get('kod'))
  const sabab = matn(fd.get('sabab'))
  if (!kod) redirect(yol)
  if (!sabab) redirect(xabarliYol(yol, { xato: 'Bekor qilish sababini yozing.' }))
  const supabase = await createClient()
  const { error } = await supabase.rpc('kitob_bekor', { p_kod: kod!, p_sabab: sabab! })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(yol, { ok: `${kod} bekor qilindi.` }))
}

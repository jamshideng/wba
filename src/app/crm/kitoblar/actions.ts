'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabProfil, adminmi } from '@/lib/auth'
import { matn, sanaOqi, sonOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'

/*
 * 0142/0143 — kitoblar hisobi. Huquq bazada (RLS + funksiyalar):
 * katalog/kirim/berish/qaytarish — direktor, admin, manager; buyurtma — ustoz.
 * Bu yerdagi rol tekshiruvi faqat tushunarli xabar uchun.
 */

const YOL = '/crm/kitoblar'

function kodNormal(v: FormDataEntryValue | null): string | null {
  const k = String(v ?? '').trim().toUpperCase().replace(/\s+/g, '')
  if (!k) return null
  return k.startsWith('KT-') ? k : `KT-${k.replace(/^KT/, '')}`
}

/** Qaytish manzili: faqat shu sahifa ichida (ochiq yo'naltirish bo'lmasin) */
function qaytishYoli(v: FormDataEntryValue | null, standart: string): string {
  const y = String(v ?? '')
  return y.startsWith(`${YOL}?`) || y === YOL ? y : standart
}

async function rahbariyat(yol: string) {
  const profil = await talabProfil()
  if (!adminmi(profil.asl_rol ?? profil.rol)) redirect(xabarliYol(yol, { xato: 'Bu amal direktor, admin yoki manager uchun.' }))
  return profil
}

/* ---------------- Katalog ---------------- */

export async function kitobQosh(fd: FormData) {
  const yol = `${YOL}?tab=katalog`
  await rahbariyat(yol)
  const nom = matn(fd.get('nom'))
  if (!nom) redirect(xabarliYol(yol, { xato: 'Kitob nomini yozing.' }))
  const supabase = await createClient()
  const { error } = await supabase.from('kitoblar').insert({ nom, subject_id: matn(fd.get('fan')), izoh: matn(fd.get('izoh')) })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(yol, { ok: `«${nom}» katalogga qo‘shildi.` }))
}

export async function kitobTahrir(fd: FormData) {
  const yol = `${YOL}?tab=katalog`
  await rahbariyat(yol)
  const id = matn(fd.get('id'))
  const nom = matn(fd.get('nom'))
  if (!id) redirect(yol)
  if (!nom) redirect(xabarliYol(yol, { xato: 'Kitob nomi bo‘sh bo‘lmasin.' }))
  const supabase = await createClient()
  const { error } = await supabase
    .from('kitoblar')
    .update({ nom, subject_id: matn(fd.get('fan')), izoh: matn(fd.get('izoh')), updated_at: new Date().toISOString() })
    .eq('id', id!)
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(yol, { ok: `«${nom}» saqlandi.` }))
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

/** Kirimi/buyurtmasi yo'q kitob — o'chadi; bori — baza rad etadi (0143 trigger) */
export async function kitobOchir(fd: FormData) {
  const yol = `${YOL}?tab=katalog`
  await rahbariyat(yol)
  const id = matn(fd.get('id'))
  if (!id) redirect(yol)
  const supabase = await createClient()
  const { data, error } = await supabase.from('kitoblar').delete().eq('id', id!).select('nom')
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  if (!data?.length) redirect(xabarliYol(yol, { xato: 'Kitob topilmadi.' }))
  revalidatePath(YOL)
  redirect(xabarliYol(yol, { ok: `«${data![0].nom}» katalogdan o‘chirildi.` }))
}

/* ---------------- Kirim ---------------- */

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
    kitob_id: kitob!,
    soni: soni!,
    ...(sana ? { sana } : {}),
    izoh: matn(fd.get('izoh')),
  })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(yol, { ok: `Kirim yozildi: ${soni} ta.` }))
}

export async function kirimTahrir(fd: FormData) {
  const yol = `${YOL}?tab=kirim`
  await rahbariyat(yol)
  const id = matn(fd.get('id'))
  const soni = sonOqi(fd.get('soni'))
  if (!id) redirect(yol)
  if (!soni || soni < 1) redirect(xabarliYol(yol, { xato: 'Sonini to‘g‘ri yozing (1 va undan ko‘p).' }))
  const supabase = await createClient()
  const { error } = await supabase.rpc('kitob_kirim_tahrir', {
    p_kirim: id!,
    p_soni: soni!,
    p_sana: sanaOqi(fd.get('sana')),
    p_izoh: matn(fd.get('izoh')),
  })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(yol, { ok: 'Kirim tuzatildi.' }))
}

export async function kirimBekor(fd: FormData) {
  const yol = `${YOL}?tab=kirim`
  await rahbariyat(yol)
  const id = matn(fd.get('id'))
  const sabab = matn(fd.get('sabab'))
  if (!id) redirect(yol)
  if (!sabab) redirect(xabarliYol(yol, { xato: 'Bekor qilish sababini yozing.' }))
  const supabase = await createClient()
  const { error } = await supabase.rpc('kitob_kirim_bekor', { p_kirim: id!, p_sabab: sabab! })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(yol, { ok: 'Kirim bekor qilindi — qoldiqdan ayirildi.' }))
}

/* ---------------- Buyurtma ---------------- */

export async function kitobBuyurtmaBer(fd: FormData) {
  const guruh = matn(fd.get('guruh'))
  const kitob = matn(fd.get('kitob'))
  const yol = `${YOL}?tab=buyurtma${guruh ? `&guruh=${encodeURIComponent(guruh)}` : ''}${kitob ? `&kitob=${encodeURIComponent(kitob)}` : ''}`
  const oquvchilar = fd.getAll('oquvchi').map(String).filter(Boolean)
  if (!guruh || !kitob) redirect(xabarliYol(yol, { xato: 'Guruh va kitobni tanlang.' }))
  if (oquvchilar.length === 0) redirect(xabarliYol(yol, { xato: 'Kamida bitta o‘quvchini belgilang.' }))
  const supabase = await createClient()

  // Takroriy berish — taqiq emas, ogohlantirish (buyurtmadan OLDIN tekshiriladi)
  const { data: takror } = await supabase.rpc('kitob_takroriy', { p_kitob: kitob!, p_oquvchilar: oquvchilar })
  const takrorSoni = new Set((takror ?? []).map((t) => t.student_id)).size

  const { data: kod, error } = await supabase.rpc('kitob_buyurtma', {
    p_kitob: kitob!,
    p_group: guruh!,
    p_oquvchilar: oquvchilar,
  })
  if (error || !kod) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  const ogoh = takrorSoni ? ` Diqqat: ${takrorSoni} ta o‘quvchi bu kitobni avval olgan yoki kutmoqda.` : ''
  redirect(xabarliYol(`${YOL}?tab=mening&kod=${kod}`, { ok: `Buyurtma qabul qilindi: ${kod} (${oquvchilar.length} ta).${ogoh}` }))
}

export async function kitobBuyurtmaOzgartir(fd: FormData) {
  const kod = kodNormal(fd.get('kod'))
  const yol = qaytishYoli(fd.get('qaytish'), `${YOL}?tab=mening`)
  const oquvchilar = fd.getAll('oquvchi').map(String).filter(Boolean)
  if (!kod) redirect(yol)
  if (oquvchilar.length === 0) redirect(xabarliYol(yol, { xato: 'Hech kim qolmasa — buyurtmani bekor qiling.' }))
  const supabase = await createClient()
  const { error } = await supabase.rpc('kitob_buyurtma_ozgartir', { p_kod: kod!, p_oquvchilar: oquvchilar })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(yol, { ok: `${kod}: ro‘yxat yangilandi (${oquvchilar.length} ta).` }))
}

export async function kitobBerildi(fd: FormData) {
  const kod = kodNormal(fd.get('kod'))
  const yol = qaytishYoli(fd.get('qaytish'), `${YOL}?tab=buyurtmalar`)
  await rahbariyat(yol)
  if (!kod) redirect(xabarliYol(yol, { xato: 'Kodni yozing. Masalan: KT-7K4P2X' }))
  const supabase = await createClient()
  const { error } = await supabase.rpc('kitob_berildi', { p_kod: kod! })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(yol, { ok: `${kod} — berildi, ombordan ayirildi.` }))
}

export async function kitobBekor(fd: FormData) {
  const kod = kodNormal(fd.get('kod'))
  const yol = qaytishYoli(fd.get('qaytish'), `${YOL}?tab=buyurtmalar`)
  const sabab = matn(fd.get('sabab'))
  if (!kod) redirect(yol)
  if (!sabab) redirect(xabarliYol(yol, { xato: 'Bekor qilish sababini yozing.' }))
  const supabase = await createClient()
  const { error } = await supabase.rpc('kitob_bekor', { p_kod: kod!, p_sabab: sabab! })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(yol, { ok: `${kod} bekor qilindi.` }))
}

/** Berildidan keyin: hammasi yoki belgilangan o'quvchilar omborga qaytadi */
export async function kitobQaytar(fd: FormData) {
  const kod = kodNormal(fd.get('kod'))
  const yol = qaytishYoli(fd.get('qaytish'), `${YOL}?tab=buyurtmalar`)
  await rahbariyat(yol)
  const sabab = matn(fd.get('sabab'))
  const oquvchilar = fd.getAll('oquvchi').map(String).filter(Boolean)
  if (!kod) redirect(yol)
  if (!sabab) redirect(xabarliYol(yol, { xato: 'Qaytarish sababini yozing.' }))
  if (oquvchilar.length === 0) redirect(xabarliYol(yol, { xato: 'Kimning kitobi qaytayotganini belgilang.' }))
  const supabase = await createClient()
  const { data: n, error } = await supabase.rpc('kitob_qaytar', { p_kod: kod!, p_oquvchilar: oquvchilar, p_sabab: sabab! })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(yol, { ok: `${kod}: ${n} ta kitob omborga qaytdi.` }))
}

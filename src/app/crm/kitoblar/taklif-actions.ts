'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { talabProfil, adminmi } from '@/lib/auth'
import { matn, sanaOqi, sonOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { ustozProfilTgYubor } from '@/lib/ustoz-profil-xabar'

/*
 * 0144 — ustoz kitob taklifi. Huquq va tekshiruv bazada (RLS + funksiyalar):
 * ustoz — o'z takliflari ("yangi"da tahrir/bekor); rahbariyat — holat va "Keldi".
 * Holat o'zgarganda sayt bildirishnomasini baza yozadi, Telegram'ni bu yer
 * after() ichida yuboradi (xato bo'lsa jim — holat baribir saqlangan).
 */

const YOL = '/crm/kitoblar'
const MENING = `${YOL}?tab=takliflarim`
const RAHBAR = `${YOL}?tab=takliflar`

/** Muqova faqat o'z bucketimizdan: kitoblar/takliflar/<uid>/… */
function rasmOqi(v: FormDataEntryValue | null, uid: string): string | null {
  const url = String(v ?? '').trim()
  if (!url) return null
  const boshi = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/storage/v1/object/public/kitoblar/takliflar/${uid}/`
  return url.startsWith(boshi) && /^[\w.-]+$/.test(url.slice(boshi.length)) ? url : null
}

function havolaOqi(v: FormDataEntryValue | null): string | null | false {
  const h = matn(v)
  if (!h) return null
  return /^https?:\/\//i.test(h) && h.length <= 500 ? h : false
}

function idlarOqi(fd: FormData): string[] {
  return fd.getAll('id').map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x))
}

/* ---------------- Ustoz ---------------- */

export async function taklifYubor(fd: FormData) {
  const profil = await talabProfil()
  const nom = matn(fd.get('nom'))
  const fan = matn(fd.get('fan'))
  const soni = sonOqi(fd.get('soni'))
  const sabab = matn(fd.get('sabab'))
  const rasm = rasmOqi(fd.get('rasm_url'), profil.id)
  const havola = havolaOqi(fd.get('havola'))
  if (!nom || !fan || !soni || !sabab) redirect(xabarliYol(MENING, { xato: 'Nom, fan, kerakli soni va sababni to‘ldiring.' }))
  if (!rasm) redirect(xabarliYol(MENING, { xato: 'Muqova rasmini yuklang (majburiy).' }))
  if (havola === false) redirect(xabarliYol(MENING, { xato: 'Havola http:// yoki https:// bilan boshlansin.' }))

  const supabase = await createClient()
  const { error } = await supabase.rpc('kitob_taklif_yubor', {
    p_nom: nom!, p_fan: fan!, p_soni: soni!, p_sabab: sabab!, p_rasm: rasm!, p_havola: havola || null,
  })
  if (error) redirect(xabarliYol(MENING, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(MENING, { ok: `«${nom}» taklifi yuborildi.` }))
}

export async function taklifTahrir(fd: FormData) {
  const profil = await talabProfil()
  const id = idlarOqi(fd)[0]
  const nom = matn(fd.get('nom'))
  const fan = matn(fd.get('fan'))
  const soni = sonOqi(fd.get('soni'))
  const sabab = matn(fd.get('sabab'))
  const havola = havolaOqi(fd.get('havola'))
  // Yangi rasm yuklanmagan bo'lsa — null: eskisi qoladi
  const xomRasm = matn(fd.get('rasm_url'))
  const rasm = xomRasm && xomRasm !== matn(fd.get('eski_rasm')) ? rasmOqi(xomRasm, profil.id) : null
  if (!id) redirect(MENING)
  if (!nom || !fan || !soni || !sabab) redirect(xabarliYol(MENING, { xato: 'Nom, fan, kerakli soni va sababni to‘ldiring.' }))
  if (xomRasm && xomRasm !== matn(fd.get('eski_rasm')) && !rasm) redirect(xabarliYol(MENING, { xato: 'Rasm noto‘g‘ri — qayta yuklang.' }))
  if (havola === false) redirect(xabarliYol(MENING, { xato: 'Havola http:// yoki https:// bilan boshlansin.' }))

  const supabase = await createClient()
  const { error } = await supabase.rpc('kitob_taklif_tahrir', {
    p_id: id!, p_nom: nom!, p_fan: fan!, p_soni: soni!, p_sabab: sabab!, p_rasm: rasm, p_havola: havola || null,
  })
  if (error) redirect(xabarliYol(MENING, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(MENING, { ok: 'Taklif saqlandi.' }))
}

export async function taklifBekor(fd: FormData) {
  const id = idlarOqi(fd)[0]
  if (!id) redirect(MENING)
  const supabase = await createClient()
  const { error } = await supabase.rpc('kitob_taklif_bekor', { p_id: id!, p_sabab: matn(fd.get('sabab')) })
  if (error) redirect(xabarliYol(MENING, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(MENING, { ok: 'Taklif bekor qilindi.' }))
}

/* ---------------- Rahbariyat ---------------- */

async function rahbariyat() {
  const profil = await talabProfil()
  if (!adminmi(profil.asl_rol ?? profil.rol)) redirect(xabarliYol(RAHBAR, { xato: 'Bu amal direktor, admin yoki manager uchun.' }))
}

/** "Buyurtma qilindi" yoki "Rad etildi" — bitta taklifga yoki bir xil kitob guruhiga */
export async function taklifHolati(fd: FormData) {
  await rahbariyat()
  const idlar = idlarOqi(fd)
  const holat = fd.get('holat') === 'rad_etildi' ? 'rad_etildi' : 'buyurtma_qilindi'
  const javob = matn(fd.get('javob'))
  if (!idlar.length) redirect(RAHBAR)
  if (holat === 'rad_etildi' && !javob) redirect(xabarliYol(RAHBAR, { xato: 'Rad etish sababini yozing.' }))

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('kitob_taklif_holat', { p_idlar: idlar, p_holat: holat, p_javob: javob })
  if (error || !data) redirect(xabarliYol(RAHBAR, { xato: xatoMatni(error) }))
  if (data!.tg?.length) after(() => ustozProfilTgYubor(data!.tg))
  revalidatePath(YOL)
  redirect(xabarliYol(RAHBAR, { ok: `${data!.soni} ta taklif: ${holat === 'rad_etildi' ? 'rad etildi' : 'buyurtma qilindi'}. Ustozlarga xabar ketdi.` }))
}

/** "Keldi": katalogga (yangi yoki mavjud kitob) + xohlasa darhol kirim */
export async function taklifKeldi(fd: FormData) {
  await rahbariyat()
  const idlar = idlarOqi(fd)
  if (!idlar.length) redirect(RAHBAR)
  const mavjud = matn(fd.get('kitob'))
  const kirimQil = fd.get('kirim') === 'ha'
  const kirimSoni = kirimQil ? sonOqi(fd.get('kirim_soni')) : null
  if (kirimQil && (!kirimSoni || kirimSoni < 1)) redirect(xabarliYol(RAHBAR, { xato: 'Kirim sonini yozing yoki "kirim ham qilish"ni olib tashlang.' }))

  // Muqova — guruhdagi birinchi taklifniki (bazadan, foydalanuvchi formasidan emas)
  const supabase = await createClient()
  const { data: birinchi } = await supabase.from('kitob_takliflar').select('rasm_url').in('id', idlar).order('created_at').limit(1).maybeSingle()

  const { data, error } = await supabase.rpc('kitob_taklif_keldi', {
    p_idlar: idlar,
    p_kitob: mavjud && /^[0-9a-f-]{36}$/i.test(mavjud) ? mavjud : null,
    p_nom: matn(fd.get('nom')),
    p_fan: matn(fd.get('fan')),
    p_rasm: birinchi?.rasm_url ?? null,
    p_kirim_soni: kirimSoni,
    p_kirim_sana: kirimQil ? sanaOqi(fd.get('kirim_sana')) : null,
    p_javob: matn(fd.get('javob')),
  })
  if (error || !data) redirect(xabarliYol(RAHBAR, { xato: xatoMatni(error) }))
  if (data!.tg?.length) after(() => ustozProfilTgYubor(data!.tg))
  revalidatePath(YOL)
  redirect(xabarliYol(RAHBAR, {
    ok: `Keldi: ${data!.soni} ta taklif, kitob katalogda${kirimSoni ? `, kirim +${kirimSoni}` : ''}. Ustozlarga xabar ketdi.`,
  }))
}

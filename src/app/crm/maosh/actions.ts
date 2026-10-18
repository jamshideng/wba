'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { summaOqi, matn, xabarliYol, xatoMatni, ichkiYol } from '@/lib/kiritish'

const YOL = '/crm/maosh'
const DAVR = /^\d{4}-(0[1-9]|1[0-2])$/
const TURLAR = {
  avans: 'Avans',
  bonus: 'Bonus',
  jarima: 'Jarima',
  tuzatish_plus: 'Tuzatish (+)',
  tuzatish_minus: 'Tuzatish (−)',
} as const
type Turi = keyof typeof TURLAR

/** Qaytish faqat shu sahifaga (oy bilan) — boshqa joyga yo'naltirib bo'lmasin. */
function qaytish(fd: FormData): string {
  const y = ichkiYol(fd.get('qaytish'))
  return y.startsWith(YOL) ? y : YOL
}

/** Ustoz stavkasi — bitta o'quvchi uchun summa (0066). Bo'sh qoldirilsa — o'chadi ("aniqlanmagan"). */
export async function stavkaSaqla(fd: FormData) {
  await talabRol('admin', 'direktor')
  const orqaga = qaytish(fd)
  const teacher = matn(fd.get('teacher_id'))
  if (!teacher) redirect(orqaga)

  const supabase = await createClient()
  const xom = matn(fd.get('qiymati'))
  if (!xom) {
    const { error } = await supabase.from('teacher_salaries').delete().eq('teacher_id', teacher!)
    if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))
    revalidatePath(YOL)
    redirect(xabarliYol(orqaga, { ok: 'Stavka olib tashlandi — maosh hisoblanmaydi.' }))
  }

  const qiymati = summaOqi(xom)
  if (!qiymati) redirect(xabarliYol(orqaga, { xato: 'Stavka noto‘g‘ri. Masalan: 50000 yoki 50 ming.' }))

  const { error } = await supabase
    .from('teacher_salaries')
    .upsert({ teacher_id: teacher!, turi: 'oquvchi_soni', qiymati: qiymati!, updated_at: new Date().toISOString() })
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))

  revalidatePath(YOL)
  redirect(xabarliYol(orqaga, { ok: 'Stavka saqlandi.' }))
}

/** Avans / bonus / jarima / tuzatish — admin va direktor (RLS ham shuni talab qiladi).
 *  Tuzatish — hisob xato chiqsa (0075): + yoki −, sababi majburiy. */
export async function harakatQosh(fd: FormData) {
  await talabRol('admin', 'direktor')
  const orqaga = qaytish(fd)

  // "p:<uuid>" — xodim (admin) yozuvi (0077, faqat manager/direktor — RLS), aks holda ustoz ID
  const kim = matn(fd.get('teacher_id'))
  const xodim = kim?.startsWith('p:') ? kim.slice(2) : null
  const teacher = xodim ? null : kim
  const davr = matn(fd.get('davr'))
  const turi = fd.get('turi')
  const summa = summaOqi(fd.get('summa'))

  const xato =
    !teacher && !xodim ? 'Kimligini tanlang.' :
    !davr || !DAVR.test(davr) ? 'Oy noto‘g‘ri.' :
    typeof turi !== 'string' || !(turi in TURLAR) ? 'Turini tanlang.' :
    !summa ? 'Summa noto‘g‘ri. Masalan: 300000 yoki 300 ming.' :
    String(turi).startsWith('tuzatish') && !matn(fd.get('izoh')) ? 'Tuzatish sababini izohga yozing.' :
    null
  if (xato) redirect(xabarliYol(orqaga, { xato }))

  const supabase = await createClient()
  const { error } = await supabase.from('maosh_harakatlar').insert({
    teacher_id: teacher,
    profile_id: xodim,
    davr: davr!,
    turi: String(turi).startsWith('tuzatish') ? 'tuzatish' : (turi as 'avans' | 'bonus' | 'jarima'),
    summa: turi === 'tuzatish_minus' ? -summa! : summa!,
    izoh: matn(fd.get('izoh')),
  })
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))

  revalidatePath(YOL)
  redirect(xabarliYol(orqaga, { ok: `${TURLAR[turi as Turi]} yozildi.` }))
}

/** O'chirilmaydi — sababi bilan bekor qilinadi (audit_log da iz qoladi). */
export async function harakatBekor(fd: FormData) {
  await talabRol('admin', 'direktor')
  const orqaga = qaytish(fd)
  const id = Number(fd.get('id'))
  const sabab = matn(fd.get('sabab'))
  if (!Number.isInteger(id) || id <= 0) redirect(orqaga)
  if (!sabab) redirect(xabarliYol(orqaga, { xato: 'Bekor qilish sababini yozing.' }))

  const supabase = await createClient()
  const { error } = await supabase.from('maosh_harakatlar').update({ bekor: true, bekor_sabab: sabab! }).eq('id', id)
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))

  revalidatePath(YOL)
  redirect(xabarliYol(orqaga, { ok: `#${id} bekor qilindi.` }))
}

/** Direktor tasdig'i (0075): oy qulflanadi, har ustoz maoshi xarajatlarga tushadi. */
export async function oyTasdiqla(fd: FormData) {
  await talabRol('direktor')
  const orqaga = qaytish(fd)
  const davr = matn(fd.get('davr'))
  if (!davr || !DAVR.test(davr)) redirect(orqaga)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('maosh_tasdiqla', { p_davr: davr! })
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))

  revalidatePath(YOL)
  revalidatePath('/crm/xarajatlar')
  redirect(xabarliYol(orqaga, { ok: `Tasdiqlandi: ${data ?? 0} ustoz maoshi xarajatlarga yozildi.` }))
}

/** Tasdiqlangan oyni qayta ochish — faqat direktor, sababi bilan; xarajatlar bekor bo'ladi. */
export async function oyQaytaOch(fd: FormData) {
  await talabRol('direktor')
  const orqaga = qaytish(fd)
  const davr = matn(fd.get('davr'))
  const sabab = matn(fd.get('sabab'))
  if (!davr || !DAVR.test(davr)) redirect(orqaga)
  if (!sabab) redirect(xabarliYol(orqaga, { xato: 'Qayta ochish sababini yozing.' }))

  const supabase = await createClient()
  const { error } = await supabase.rpc('maosh_qayta_och', { p_davr: davr!, p_sabab: sabab! })
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))

  revalidatePath(YOL)
  revalidatePath('/crm/xarajatlar')
  redirect(xabarliYol(orqaga, { ok: 'Oy qayta ochildi — maosh xarajatlari bekor qilindi.' }))
}

/** Xodim (admin, qabulxona, manager) oyligi — faqat manager va direktor (0077). Bo'sh — olib tashlanadi. */
export async function xodimOylikSaqla(fd: FormData) {
  await talabRol('manager', 'direktor')
  const orqaga = qaytish(fd)
  const profil = matn(fd.get('profile_id'))
  if (!profil) redirect(orqaga)

  const supabase = await createClient()
  const xom = matn(fd.get('summa'))
  if (!xom) {
    const { error } = await supabase.from('xodim_oylik').delete().eq('profile_id', profil!)
    if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))
    revalidatePath(YOL)
    redirect(xabarliYol(orqaga, { ok: 'Oylik olib tashlandi.' }))
  }
  const summa = summaOqi(xom)
  if (!summa) redirect(xabarliYol(orqaga, { xato: 'Oylik noto‘g‘ri. Masalan: 3000000 yoki 3 mln.' }))

  const { error } = await supabase
    .from('xodim_oylik')
    .upsert({ profile_id: profil!, summa: summa!, updated_at: new Date().toISOString() })
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))
  revalidatePath(YOL)
  redirect(xabarliYol(orqaga, { ok: 'Oylik saqlandi.' }))
}

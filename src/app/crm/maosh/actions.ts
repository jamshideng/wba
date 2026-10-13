'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { summaOqi, matn, xabarliYol, xatoMatni, ichkiYol } from '@/lib/kiritish'

const YOL = '/crm/maosh'
const DAVR = /^\d{4}-(0[1-9]|1[0-2])$/
const TURLAR = { avans: 'Avans', bonus: 'Bonus', jarima: 'Jarima' } as const
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

/** Avans / bonus / jarima — admin va direktor (RLS ham shuni talab qiladi). */
export async function harakatQosh(fd: FormData) {
  await talabRol('admin', 'direktor')
  const orqaga = qaytish(fd)

  const teacher = matn(fd.get('teacher_id'))
  const davr = matn(fd.get('davr'))
  const turi = fd.get('turi')
  const summa = summaOqi(fd.get('summa'))

  const xato =
    !teacher ? 'Ustozni tanlang.' :
    !davr || !DAVR.test(davr) ? 'Oy noto‘g‘ri.' :
    typeof turi !== 'string' || !(turi in TURLAR) ? 'Turini tanlang.' :
    !summa ? 'Summa noto‘g‘ri. Masalan: 300000 yoki 300 ming.' :
    null
  if (xato) redirect(xabarliYol(orqaga, { xato }))

  const supabase = await createClient()
  const { error } = await supabase.from('maosh_harakatlar').insert({
    teacher_id: teacher!,
    davr: davr!,
    turi: turi as Turi,
    summa: summa!,
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

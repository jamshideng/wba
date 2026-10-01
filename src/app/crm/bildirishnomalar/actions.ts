'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabProfil, talabRol } from '@/lib/auth'
import { matn, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { filtrOqi, KIMLAR } from '@/lib/elon'
import { BTURLAR, havolaToza, variantlarniOqi, type BildirishnomaTuri, type SorovnomaNatija } from '@/lib/bildirishnoma'
import type { TelegramKim } from '@/lib/types'

/**
 * Sayt ichidagi bildirishnomalar (0047).
 * Admin yaratadi/yopadi; har kim o'zinikini "ko'rdi/yopdi" qiladi va
 * so'rovnomaga javob beradi — faqat bazadagi funksiyalar orqali.
 */

const YOL = '/crm/bildirishnomalar'

/** "2026-10-05T09:30" (Toshkent vaqti) → ISO */
function toshkentVaqt(xom: FormDataEntryValue | null): string | null {
  const s = String(xom ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(s)) return null
  return `${s.length === 10 ? `${s}T00:00` : s}:00+05:00`
}

/* ── Admin ── */

export async function bildirishnomaYarat(fd: FormData) {
  await talabRol('admin', 'direktor')

  const turi = (BTURLAR.find((t) => t.qiymat === fd.get('turi'))?.qiymat ?? 'eslatma') as BildirishnomaTuri
  const sarlavha = matn(fd.get('sarlavha'))?.slice(0, 120)
  const kimga = fd.getAll('k').map(String).filter((k): k is TelegramKim => KIMLAR.some((x) => x.qiymat === k))
  const variantlar = turi === 'sorovnoma' ? variantlarniOqi(String(fd.get('variantlar') ?? '')) : []
  const tugash = toshkentVaqt(fd.get('tugash'))
  const boshlanish = toshkentVaqt(fd.get('boshlanish'))

  if (!sarlavha) redirect(xabarliYol(YOL, { xato: 'Sarlavhani yozing.' }))
  if (!kimga.length) redirect(xabarliYol(YOL, { xato: 'Kimga ko‘rinishini tanlang.' }))
  if (turi === 'sorovnoma' && variantlar.length < 2) redirect(xabarliYol(YOL, { xato: 'So‘rovnomaga kamida 2 ta variant yozing (har qatorga bittadan).' }))

  const supabase = await createClient()
  const { data: b, error } = await supabase
    .from('bildirishnomalar')
    .insert({
      turi,
      sarlavha: sarlavha!,
      matn: matn(fd.get('matn'))?.slice(0, 2000) ?? null,
      havola: havolaToza(matn(fd.get('havola'))),
      havola_matn: matn(fd.get('havola_matn'))?.slice(0, 40) ?? null,
      kimga,
      filtr: filtrOqi(String(fd.get('f') ?? 'hammasi')),
      muhim: fd.get('muhim') === '1',
      kop_tanlov: fd.get('kop_tanlov') === '1',
      natija_ochiq: fd.get('natija_ochiq') === '1',
      ...(boshlanish ? { boshlanish } : {}),
      tugash,
    })
    .select('id')
    .single()
  if (error || !b) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))

  if (variantlar.length) {
    const { error: e2 } = await supabase
      .from('bildirishnoma_variantlar')
      .insert(variantlar.map((v, i) => ({ bildirishnoma_id: b!.id, matn: v, tartib: i })))
    if (e2) {
      await supabase.from('bildirishnomalar').delete().eq('id', b!.id)
      redirect(xabarliYol(YOL, { xato: xatoMatni(e2) }))
    }
  }

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(YOL, { ok: `“${sarlavha}” e’lon qilindi — kirganlarga tepada chiqadi.` }))
}

export async function bildirishnomaHolat(fd: FormData) {
  await talabRol('admin', 'direktor')
  const id = Number(fd.get('id'))
  const holat = fd.get('holat') === 'faol' ? 'faol' : 'yopilgan'
  if (!id) redirect(YOL)
  const supabase = await createClient()
  const { error } = await supabase.from('bildirishnomalar').update({ holat }).eq('id', id)
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))
  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(YOL, { ok: holat === 'faol' ? 'Qayta ochildi.' : 'Yopildi — endi hech kimga chiqmaydi.' }))
}

export async function bildirishnomaOchir(fd: FormData) {
  await talabRol('admin', 'direktor')
  const id = Number(fd.get('id'))
  if (!id) redirect(YOL)
  const supabase = await createClient()
  const { error } = await supabase.from('bildirishnomalar').delete().eq('id', id)
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))
  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(YOL, { ok: 'O‘chirildi (javoblari bilan).' }))
}

/* ── Har kim: ko'rdi / yopdi / javob (sahifadan, qayta yuklamasdan) ── */

export async function bildirishnomaBelgila(id: number, yopildi: boolean): Promise<void> {
  await talabProfil()
  if (!Number.isInteger(id) || id <= 0) return
  const supabase = await createClient()
  await supabase.rpc('bildirishnoma_belgila', { p_id: id, p_yopildi: yopildi })
}

export async function sorovnomagaJavob(
  id: number,
  variantlar: number[],
): Promise<{ xato?: string; natija?: SorovnomaNatija[] }> {
  await talabProfil()
  const toza = [...new Set(variantlar.filter((v) => Number.isInteger(v) && v > 0))].slice(0, 10)
  const supabase = await createClient()
  const { error } = await supabase.rpc('sorovnomaga_javob', { p_id: id, p_variantlar: toza })
  if (error) return { xato: xatoMatni(error) }
  const { data } = await supabase.rpc('sorovnoma_natija', { p_id: id })
  return { natija: (data ?? []) as SorovnomaNatija[] }
}

'use server'

import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabProfil, talabRol } from '@/lib/auth'
import { matn, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { KIMLAR } from '@/lib/elon'
import { BTURLAR, bildirishnomaFiltri, havolaToza, savollarniOqi, type BildirishnomaTuri, type SorovnomaNatija } from '@/lib/bildirishnoma'
import type { TelegramKim } from '@/lib/types'
import { pushYoqilganmi, pushYubor } from '@/lib/push'

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
  const savollar = turi === 'sorovnoma' ? savollarniOqi(String(fd.get('savollar') ?? '[]'), sarlavha ?? '') : []
  const tugash = toshkentVaqt(fd.get('tugash'))
  const boshlanish = toshkentVaqt(fd.get('boshlanish'))

  if (!sarlavha) redirect(xabarliYol(YOL, { xato: 'Sarlavhani yozing.' }))
  if (!kimga.length) redirect(xabarliYol(YOL, { xato: 'Kimga ko‘rinishini tanlang.' }))
  if (turi === 'sorovnoma' && !savollar.length) redirect(xabarliYol(YOL, { xato: 'So‘rovnomaga kamida bitta savol va unga 2 ta variant yozing (har qatorga bittadan).' }))

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
      filtr: bildirishnomaFiltri(String(fd.get('f') ?? 'hammasi')),
      muhim: fd.get('muhim') === '1',
      kop_tanlov: savollar.some((q) => q.kop_tanlov),
      natija_ochiq: fd.get('natija_ochiq') === '1',
      ...(boshlanish ? { boshlanish } : {}),
      tugash,
    })
    .select('id')
    .single()
  if (error || !b) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))

  if (savollar.length) {
    // Savollar → variantlar; biror qadam o'xshamasa — bildirishnoma butunlay o'chiriladi
    const bekor = async (e: { message?: string; code?: string } | null) => {
      await supabase.from('bildirishnomalar').delete().eq('id', b!.id)
      redirect(xabarliYol(YOL, { xato: xatoMatni(e) }))
    }
    const { data: sq, error: e2 } = await supabase
      .from('bildirishnoma_savollar')
      .insert(savollar.map((q, i) => ({ bildirishnoma_id: b!.id, matn: q.matn, kop_tanlov: q.kop_tanlov, tartib: i })))
      .select('id, tartib')
    if (e2 || !sq) return bekor(e2)
    const idlar = new Map(sq.map((x) => [x.tartib as number, x.id as number]))
    const { error: e3 } = await supabase.from('bildirishnoma_variantlar').insert(
      savollar.flatMap((q, i) => q.variantlar.map((v, j) => ({ bildirishnoma_id: b!.id, savol_id: idlar.get(i)!, matn: v, tartib: j }))),
    )
    if (e3) return bekor(e3)
  }

  /* Telefon xabarnomasi (0055) — hozir boshlanadiganlarga darhol. Kelajakka
     rejalashtirilgani push'siz: u vaqtida saytda chiqadi. Oluvchilar ro'yxati
     admin nomidan (RLS/definer), yuborish javobdan keyin — admin kutmaydi. */
  let pushSoni = 0
  if (pushYoqilganmi() && (!boshlanish || new Date(boshlanish) <= new Date())) {
    const { data: oluvchilar } = await supabase.rpc('push_oluvchilar', { p_bildirishnoma: b!.id })
    pushSoni = oluvchilar?.length ?? 0
    if (pushSoni) {
      const id = b!.id
      const matnQism = matn(fd.get('matn'))
      after(async () => {
        const { eskirgan } = await pushYubor(oluvchilar!, {
          sarlavha: sarlavha!,
          matn: matnQism,
          havola: havolaToza(matn(fd.get('havola'))) ?? '/crm',
          teg: `b${id}`,
        })
        for (const e of eskirgan) await supabase.rpc('push_eskirgan', { p_endpoint: e })
      })
    }
  }

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(YOL, { ok: `“${sarlavha}” e’lon qilindi — kirganlarga tepada chiqadi${pushSoni ? `, ${pushSoni} ta telefonga xabarnoma ketdi` : ''}.` }))
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
  const toza = [...new Set(variantlar.filter((v) => Number.isInteger(v) && v > 0))].slice(0, 100)
  const supabase = await createClient()
  const { error } = await supabase.rpc('sorovnomaga_javob', { p_id: id, p_variantlar: toza })
  if (error) return { xato: xatoMatni(error) }
  const { data } = await supabase.rpc('sorovnoma_natija', { p_id: id })
  return { natija: (data ?? []) as SorovnomaNatija[] }
}

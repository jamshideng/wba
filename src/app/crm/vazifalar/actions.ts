'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, xabarliYol, xatoMatni } from '@/lib/kiritish'
import type { VazifaHolat, VazifaMuhimlik, VazifaTuri } from '@/lib/types'

const XODIM = ['admin', 'direktor', 'qabulxona'] as const
const TURLAR: VazifaTuri[] = ['qongiroq', 'tolov_eslatish', 'sinov_chaqirish', 'boshqa']
const MUHIM: VazifaMuhimlik[] = ['past', 'orta', 'yuqori']
const HOLATLAR: VazifaHolat[] = ['yangi', 'jarayonda', 'bajarildi', 'bekor']

function qaytish(fd: FormData): string {
  const y = String(fd.get('qaytish') ?? '')
  return y.startsWith('/crm/') && !y.startsWith('//') ? y : '/crm/vazifalar'
}

/** input type=datetime-local ("2026-10-06T15:00") — Toshkent vaqti deb olinadi. */
function muddatOqi(v: FormDataEntryValue | null): string | null {
  const s = matn(v)
  if (!s || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null
  return `${s}:00+05:00`
}

export async function vazifaQosh(fd: FormData) {
  await talabRol(...XODIM)
  const yol = qaytish(fd)

  const nom = matn(fd.get('nom'))
  const muddat = muddatOqi(fd.get('muddat'))
  if (!nom) redirect(xabarliYol(yol, { xato: 'Vazifa nomini yozing.' }))
  if (!muddat) redirect(xabarliYol(yol, { xato: 'Muddatni tanlang.' }))

  // Bog'lash: "lead:<uuid>" yoki "student:<S001>"
  const bog = matn(fd.get('bogliq'))
  const lead_id = bog?.startsWith('lead:') ? bog.slice(5) : null
  const student_id = bog?.startsWith('student:') ? bog.slice(8) : null

  const supabase = await createClient()
  const { error } = await supabase.from('crm_vazifalar').insert({
    nom: nom!.slice(0, 200),
    turi: TURLAR.find((t) => t === fd.get('turi')) ?? 'qongiroq',
    muhimlik: MUHIM.find((m) => m === fd.get('muhimlik')) ?? 'orta',
    muddat: muddat!,
    lead_id,
    student_id,
    masul: matn(fd.get('masul')),
    izoh: matn(fd.get('izoh')),
  })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm/vazifalar')
  revalidatePath('/crm/dashboard')
  redirect(xabarliYol(yol, { ok: 'Vazifa qo‘shildi.' }))
}

export async function vazifaHolat(fd: FormData) {
  await talabRol(...XODIM)
  const yol = qaytish(fd)
  const id = matn(fd.get('id'))
  const holat = HOLATLAR.find((h) => h === fd.get('holat'))
  if (!id || !holat) redirect(xabarliYol(yol, { xato: 'Holat noto‘g‘ri.' }))

  const supabase = await createClient()
  const { error } = await supabase.from('crm_vazifalar').update({ holat: holat! }).eq('id', id!)
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm/vazifalar')
  revalidatePath('/crm/dashboard')
  redirect(
    xabarliYol(yol, {
      ok: holat === 'bajarildi' ? 'Bajarildi.' : holat === 'bekor' ? 'Bekor qilindi.' : 'Holat o‘zgardi.',
    }),
  )
}

/** Muddatni ertaga shu vaqtga surish. */
export async function vazifaSur(fd: FormData) {
  await talabRol(...XODIM)
  const yol = qaytish(fd)
  const id = matn(fd.get('id'))
  const muddat = muddatOqi(fd.get('muddat'))
  if (!id || !muddat) redirect(xabarliYol(yol, { xato: 'Yangi muddatni tanlang.' }))

  const supabase = await createClient()
  const { error } = await supabase.from('crm_vazifalar').update({ muddat: muddat! }).eq('id', id!)
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm/vazifalar')
  redirect(xabarliYol(yol, { ok: 'Muddat surildi.' }))
}

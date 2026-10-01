'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import type { AttendanceStatus } from '@/lib/types'

export type AmalNatijasi<T> = { ok: true; natija: T } | { ok: false; xato: string }

const ROLLAR = ['admin', 'direktor', 'qabulxona', 'ustoz']

/* Kirmagan odam bu amallarni bajara olmaydi. Asosiy tekshiruv bazada
   (davomat_belgila, woblar_ber — o'z guruhi yoki admin, Q5), lekin kodda
   ham to'sib qo'yamiz: bo'sh sessiya bilan RPC'ni bezovta qilmasin. */
async function ruxsat(): Promise<string | null> {
  const profil = await getProfile()
  if (!profil) return 'Avval tizimga kiring.'
  if (!ROLLAR.includes(profil.rol)) return 'Davomat qo‘yish huquqingiz yo‘q.'
  return null
}

/**
 * Jurnal katagi (yoki bir kunning bir nechta katagi). null — belgini
 * olib tashlash. Woblarga tegmaydi. Hammasi bazadagi bitta funksiyada:
 * dars ochiladi, belgi yoziladi, huquq tekshiriladi.
 */
export async function davomatBelgila(
  guruhId: string,
  sana: string,
  belgilar: Record<string, AttendanceStatus | null>,
): Promise<AmalNatijasi<number>> {
  const xato = await ruxsat()
  if (xato) return { ok: false, xato }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('davomat_belgila', {
    p_group: guruhId,
    p_sana: sana,
    p_belgilar: belgilar,
  })
  if (error) return { ok: false, xato: error.message }

  revalidatePath('/crm/davomat')
  return { ok: true, natija: Number(data) || 0 }
}

/** Probniy katagi — pulsiz davomat (0030). Doimiy bo'lganda o'quvchiga ko'chadi. */
export async function probniyBelgila(
  guruhId: string,
  sana: string,
  leadId: string,
  holat: AttendanceStatus | null,
): Promise<AmalNatijasi<null>> {
  const xato = await ruxsat()
  if (xato) return { ok: false, xato }

  const supabase = await createClient()
  const { error } = await supabase.rpc('probniy_belgila', {
    p_group: guruhId,
    p_sana: sana,
    p_lead: leadId,
    p_holat: holat,
  })
  if (error) return { ok: false, xato: error.message }
  return { ok: true, natija: null }
}

/** Bugungi darsga woblar. Qaytaradi — o'quvchining bugungi jami woblari. */
export async function woblarBer(guruhId: string, studentId: string, ball: number): Promise<AmalNatijasi<number>> {
  const xato = await ruxsat()
  if (xato) return { ok: false, xato }
  if (!Number.isInteger(ball) || ball === 0 || ball < -10 || ball > 10) {
    return { ok: false, xato: 'Woblar −10 dan +10 gacha bo‘lsin, 0 emas.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('woblar_ber', {
    p_group: guruhId,
    p_student: studentId,
    p_ball: ball,
  })
  if (error) return { ok: false, xato: error.message }

  revalidatePath('/crm/woblr')
  return { ok: true, natija: Number(data) || 0 }
}

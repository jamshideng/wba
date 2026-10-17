'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { matn, xabarliYol, xatoMatni, ichkiYol } from '@/lib/kiritish'
import { woblarXabariniYubor } from '@/lib/woblar-xabar'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { woblarXato } from '@/lib/woblar-chegara'
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
  const chegaraXato = woblarXato(ball)
  if (chegaraXato) return { ok: false, xato: chegaraXato }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('woblar_ber', {
    p_group: guruhId,
    p_student: studentId,
    p_ball: ball,
  })
  if (error) return { ok: false, xato: error.message }

  // O'quvchiga telefon va Telegram xabari (sayt bildirishnomasini trigger yozdi, 0071)
  after(() => woblarXabariniYubor(supabase, studentId))

  revalidatePath('/crm/woblr')
  revalidatePath(`/crm/davomat/${guruhId}`) // oylik limit soni yangilansin (0064)
  return { ok: true, natija: Number(data) || 0 }
}

/**
 * Probniyga woblar (0073) — lid'ga yoziladi, guruh limitidan ketadi.
 * Doimiy bo'lsa o'quvchiga ko'chadi, yo'qotilsa lid bilan arxivda qoladi.
 */
export async function probniyWoblarBer(guruhId: string, leadId: string, ball: number): Promise<AmalNatijasi<number>> {
  const xato = await ruxsat()
  if (xato) return { ok: false, xato }
  const chegaraXato = woblarXato(ball)
  if (chegaraXato) return { ok: false, xato: chegaraXato }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('probniy_woblar_ber', {
    p_group: guruhId,
    p_lead: leadId,
    p_ball: ball,
  })
  if (error) return { ok: false, xato: error.message }

  revalidatePath(`/crm/davomat/${guruhId}`)
  return { ok: true, natija: Number(data) || 0 }
}

/**
 * Zamena (0075). Ustoz bo'sh — olib tashlash. Huquq bazada: guruh ustozi
 * bugungi/keyingi darsga, admin istalgan kunga; oy maoshi tasdiqlangan bo'lsa yopiq.
 */
export async function zamenaSaqla(fd: FormData) {
  const guruh = matn(fd.get('group_id'))
  const sana = matn(fd.get('sana'))
  const y = ichkiYol(fd.get('qaytish'))
  const orqaga = guruh && y.startsWith(`/crm/davomat/${guruh}`) ? y : '/crm/davomat'

  const xato = await ruxsat()
  if (xato) redirect(xabarliYol(orqaga, { xato }))
  if (!guruh || !sana || !/^\d{4}-\d{2}-\d{2}$/.test(sana)) redirect(xabarliYol(orqaga, { xato: 'Dars kunini tanlang.' }))

  const ustoz = matn(fd.get('ustoz'))
  const supabase = await createClient()
  const { error } = await supabase.rpc('zamena_belgila', {
    p_group: guruh!,
    p_sana: sana!,
    p_ustoz: ustoz,
    p_sabab: matn(fd.get('sabab')),
  })
  if (error) redirect(xabarliYol(orqaga, { xato: xatoMatni(error) }))

  revalidatePath('/crm/davomat')
  revalidatePath('/crm/maosh')
  redirect(xabarliYol(orqaga, { ok: ustoz ? 'Zamena belgilandi.' : 'Zamena olib tashlandi.' }))
}

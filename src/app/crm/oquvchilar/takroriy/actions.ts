'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, xabarliYol, xatoMatni } from '@/lib/kiritish'

const YOL = '/crm/oquvchilar/takroriy'

/**
 * Ikkinchi ID'ning hamma yozuvlari asosiyga o'tadi, ikkinchisi arxivga
 * tushadi (0067, oquvchi_birlashtir). O'chirilmaydi — izi qoladi.
 */
export async function birlashtir(fd: FormData) {
  await talabRol('admin', 'direktor')
  const asosiy = matn(fd.get('asosiy'))
  const ikkinchi = matn(fd.get('ikkinchi'))
  if (!asosiy || !ikkinchi) redirect(YOL)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('oquvchi_birlashtir', { p_asosiy: asosiy!, p_ikkinchi: ikkinchi! })
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))

  const n = data as { qatnashuv: number; tolov: number; davomat: number; davomat_qoldi: number }
  revalidatePath('/crm', 'layout')
  redirect(
    xabarliYol(YOL, {
      ok:
        `${ikkinchi} → ${asosiy} birlashtirildi: ${n.qatnashuv} ta guruh, ${n.tolov} ta to‘lov, ${n.davomat} ta davomat ko‘chdi.` +
        (n.davomat_qoldi ? ` ${n.davomat_qoldi} ta davomat bir xil darsda bo‘lgani uchun ${ikkinchi} da qoldi.` : ''),
    }),
  )
}

/** "Bu boshqa odam" — juftlik ro'yxatda qayta chiqmaydi. */
export async function boshqaOdam(fd: FormData) {
  await talabRol('admin', 'direktor')
  const x = matn(fd.get('a'))
  const y = matn(fd.get('b'))
  if (!x || !y || x === y) redirect(YOL)
  const [a, b] = x! < y! ? [x!, y!] : [y!, x!]

  const supabase = await createClient()
  const { error } = await supabase.from('oquvchi_takror_emas').upsert({ a, b }, { ignoreDuplicates: true })
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))

  revalidatePath(YOL)
  redirect(xabarliYol(YOL, { ok: `${a} va ${b} — boshqa-boshqa odam deb belgilandi.` }))
}

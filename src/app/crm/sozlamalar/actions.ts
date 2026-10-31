'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, xabarliYol, xatoMatni } from '@/lib/kiritish'

const YOL = '/crm/sozlamalar'

/**
 * Formadagi matnni JSON qiymatga aylantiradi. Bo'sh — null, ya'ni
 * [ANIQLANMAGAN]: bilinmagan raqam o'rniga taxmin yozilmaydi.
 */
function qiymatOqi(xom: string): unknown {
  const s = xom.trim()
  if (s === '' || s === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(s.replace(/\s/g, ''))) return Number(s.replace(/\s/g, ''))
  if (s === 'true' || s === 'false') return s === 'true'
  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      return JSON.parse(s)
    } catch {
      return s
    }
  }
  return s
}

export async function sozlamaSaqla(fd: FormData) {
  const profil = await talabRol('admin', 'direktor')

  const kalit = matn(fd.get('kalit'))
  if (!kalit) redirect(YOL)

  const supabase = await createClient()
  const { error } = await supabase
    .from('settings')
    .update({ qiymat: qiymatOqi(String(fd.get('qiymat') ?? '')), ozgartirdi: profil.id })
    .eq('kalit', kalit!)
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(YOL, { ok: `${kalit} saqlandi.` }))
}

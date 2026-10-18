'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { sheetsniMuzlat } from '@/lib/sheets-muzlat'

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

/**
 * Sheets integratsiyasini muzlatish / qaytarish (0084). Avval jadvalga himoya
 * (yoki olib tashlash) — muvaffaqiyatli bo'lsagina bayroq o'zgaradi, ya'ni
 * jadval va sayt holati doim bir xil.
 */
export async function sheetsMuzlat(fd: FormData) {
  await talabRol('admin', 'direktor')
  const muzlat = fd.get('muzlat') === '1'

  let natija
  try {
    natija = await sheetsniMuzlat(muzlat)
  } catch (e) {
    redirect(xabarliYol(YOL, { xato: `Sheets’ga ulanib bo‘lmadi: ${(e as Error).message}` }))
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('sheets_muzlat', { p_muzlat: muzlat })
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))

  revalidatePath(YOL)
  redirect(
    xabarliYol(YOL, {
      ok: muzlat
        ? `Muzlatildi: ${natija!.himoyalangan} ta varaq himoyaga olindi. Sinxron va Apps Script hisobotlari to‘xtaydi.`
        : `Qaytarildi: ${natija!.olingan} ta himoya olindi. Sinxron va Apps Script hisobotlari yana ishlaydi.`,
    }),
  )
}

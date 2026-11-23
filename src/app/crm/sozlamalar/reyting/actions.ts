'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { sanaOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { VAZN_GURUHLARI, vaznXatosi, type ReytingSozlama } from '@/lib/reyting'

const YOL = '/crm/sozlamalar/reyting'

function son(fd: FormData, nom: string): number {
  const s = String(fd.get(nom) ?? '').trim().replace(',', '.').replace(/\s/g, '')
  return s === '' ? Number.NaN : Number(s)
}

/** Reyting sozlamalari (0138). Vaznlar yig'indisi 100 bo'lmasa saqlanmaydi — bazada ham tekshiriladi. */
export async function reytingSozlamaSaqla(fd: FormData) {
  await talabRol('admin', 'direktor', 'manager')

  const vaznlar: Record<string, Record<string, number>> = {}
  for (const g of VAZN_GURUHLARI) {
    const v: Record<string, number> = {}
    for (const o of g.omillar) v[o.kalit] = son(fd, `${g.kalit}.${o.kalit}`)
    const xato = vaznXatosi(g.nom, v)
    if (xato) redirect(xabarliYol(YOL, { xato }))
    vaznlar[g.kalit] = v
  }

  const butun = ['oylik_sana', 'test_muddati_kun', 'min_dars_oylik', 'min_dars_haftalik', 'min_qatnashgan_dars'] as const
  const kasr = ['woblar_100', 'bogliq_emas_koef', 'kechikish_k', 'intizom_n'] as const
  const qolgan: Record<string, number> = {}
  for (const k of [...butun, ...kasr]) {
    const x = son(fd, k)
    if (!Number.isFinite(x)) redirect(xabarliYol(YOL, { xato: 'Hamma maydonga son yozing.' }))
    qolgan[k] = (butun as readonly string[]).includes(k) ? Math.round(x) : x
  }

  const boshlanish = sanaOqi(fd.get('boshlanish_sana'))
  const qiymat = { ...vaznlar, ...qolgan, boshlanish_sana: boshlanish } as unknown as ReytingSozlama

  const supabase = await createClient()
  const { error } = await supabase.rpc('reyting_sozlama_saqla', { p_qiymat: qiymat })
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))

  revalidatePath(YOL)
  redirect(xabarliYol(YOL, { ok: 'Reyting sozlamalari saqlandi. Keyingi hisoblashdan boshlab amal qiladi.' }))
}

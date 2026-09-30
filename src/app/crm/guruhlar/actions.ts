'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, sonOqi, summaOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'

type GuruhMaydonlari = {
  nom: string
  subject_id: string | null
  level_id: number | null
  teacher_id: string | null
  boshlanish: string
  tugash: string
  /** ISO hafta kunlari, 1 = dushanba … 7 = yakshanba */
  kunlar: number[]
  oylik_narx: number
  sigim: number
}

/**
 * Formani tekshiradi. Nom bo'sh qolsa Sheets'dagi formula bo'yicha
 * yasaladi: "Yo'nalish · O'qituvchi · Dars vaqti".
 */
async function oqi(fd: FormData): Promise<GuruhMaydonlari | string> {
  const boshlanish = matn(fd.get('boshlanish'))
  const tugash = matn(fd.get('tugash'))
  const kunlar = [...new Set(fd.getAll('kunlar').map(Number))]
    .filter((k) => Number.isInteger(k) && k >= 1 && k <= 7)
    .sort((a, b) => a - b)
  const narx = summaOqi(fd.get('oylik_narx'))
  const sigim = sonOqi(fd.get('sigim')) ?? 12

  if (!boshlanish || !tugash) return 'Dars boshlanish va tugash vaqtini kiriting.'
  if (tugash <= boshlanish) return 'Dars tugash vaqti boshlanishidan keyin bo‘lishi kerak.'
  if (!kunlar.length) return 'Dars kunlarini tanlang — kamida bitta kun.'
  if (!narx) return 'Oylik narx noto‘g‘ri. Masalan: 650000 yoki 650.'
  if (sigim < 1 || sigim > 12) return 'Guruh sig‘imi 1 dan 12 gacha (markaz qoidasi).'

  const subjectId = matn(fd.get('subject_id'))
  const levelId = sonOqi(fd.get('level_id'))
  const teacherId = matn(fd.get('teacher_id'))

  let nom = matn(fd.get('nom'))
  if (!nom) {
    const supabase = await createClient()
    const [{ data: bosqich }, { data: fan }, { data: ustoz }] = await Promise.all([
      levelId ? supabase.from('levels').select('nom').eq('id', levelId).maybeSingle() : Promise.resolve({ data: null }),
      subjectId ? supabase.from('subjects').select('nom').eq('id', subjectId).maybeSingle() : Promise.resolve({ data: null }),
      teacherId ? supabase.from('teachers').select('ism').eq('id', teacherId).maybeSingle() : Promise.resolve({ data: null }),
    ])
    const yonalish = bosqich?.nom ?? fan?.nom
    if (!yonalish) return 'Guruh nomini yozing yoki yo‘nalishni tanlang.'
    nom = [yonalish, ustoz?.ism, `${boshlanish}-${tugash}`].filter(Boolean).join(' · ')
  }

  return {
    nom,
    subject_id: subjectId,
    level_id: levelId,
    teacher_id: teacherId,
    boshlanish,
    tugash,
    kunlar,
    oylik_narx: narx,
    sigim,
  }
}

export async function guruhQosh(fd: FormData) {
  await talabRol('admin', 'direktor')
  const forma = '/crm/guruhlar/yangi'

  const g = await oqi(fd)
  if (typeof g === 'string') redirect(xabarliYol(forma, { xato: g }))

  const supabase = await createClient()
  const { data: id, error: xatoId } = await supabase.rpc('keyingi_id', {
    p_jadval: 'groups',
    p_prefiks: 'G',
    p_uzunlik: 2,
  })
  if (xatoId || !id) redirect(xabarliYol(forma, { xato: xatoMatni(xatoId) }))

  const { error } = await supabase.from('groups').insert({ id: id!, ...(g as GuruhMaydonlari) })
  if (error) redirect(xabarliYol(forma, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(`/crm/guruhlar/${id}`, { ok: `Guruh ochildi: ${id}` }))
}

export async function guruhTahrir(fd: FormData) {
  await talabRol('admin', 'direktor')
  const id = matn(fd.get('id'))
  if (!id) redirect('/crm/guruhlar')
  const forma = `/crm/guruhlar/${id}/tahrir`

  const g = await oqi(fd)
  if (typeof g === 'string') redirect(xabarliYol(forma, { xato: g }))

  const holat = fd.get('holat') === 'yopilgan' ? 'yopilgan' : 'faol'

  const supabase = await createClient()
  const { error } = await supabase
    .from('groups')
    .update({ ...(g as GuruhMaydonlari), holat })
    .eq('id', id!)

  if (error) redirect(xabarliYol(forma, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(`/crm/guruhlar/${id}`, { ok: 'Guruh saqlandi.' }))
}

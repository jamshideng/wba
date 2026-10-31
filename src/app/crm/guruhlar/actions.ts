'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, sonOqi, sanaOqi, summaOqi, xabarliYol, xatoMatni, ichkiYol } from '@/lib/kiritish'
import { bugunToshkent } from '@/lib/format'

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
  /** 0093 — maosh stavkasi shunga qarab */
  turi: GuruhTuri
}

const TURLAR = ['umumiy', 'individual', 'mini', 'ielts'] as const
type GuruhTuri = (typeof TURLAR)[number]

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
  const turi = TURLAR.find((t) => t === fd.get('turi'))

  if (!boshlanish || !tugash) return 'Dars boshlanish va tugash vaqtini kiriting.'
  if (tugash <= boshlanish) return 'Dars tugash vaqti boshlanishidan keyin bo‘lishi kerak.'
  if (!kunlar.length) return 'Dars kunlarini tanlang — kamida bitta kun.'
  if (!narx) return 'Oylik narx noto‘g‘ri. Masalan: 650000 yoki 650.'
  if (!turi) return 'Guruh turini tanlang.'

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
    turi,
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
  // Avval dars kunlari (0110): eski darslar belgilanmagan bo'lsa, hech narsa saqlanmaydi
  const { kunlar, ...qolgani } = g as GuruhMaydonlari
  const { error: jadvalXato } = await supabase.rpc('guruh_jadval_ozgartir', {
    p_group: id!,
    p_kunlar: kunlar,
    p_dan: sanaOqi(fd.get('kunlar_dan')) ?? bugunToshkent(),
  })
  if (jadvalXato) redirect(xabarliYol(forma, { xato: xatoMatni(jadvalXato) }))

  const { error } = await supabase
    .from('groups')
    .update({ ...qolgani, holat })
    .eq('id', id!)

  if (error) redirect(xabarliYol(forma, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(`/crm/guruhlar/${id}`, { ok: 'Guruh saqlandi.' }))
}

/* Umumiy bosqichlar (admin). Nomi o'zgarsa, mavjud guruh nomlari o'zgarmaydi. */
export async function bosqichQosh(fd: FormData) {
  await talabRol('admin', 'direktor')
  const yol = ichkiYol(fd.get('yol'))
  const subjectId = matn(fd.get('subject_id'))
  const nom = matn(fd.get('nom'))
  if (!subjectId || !nom) redirect(xabarliYol(yol, { xato: 'Yo‘nalish va bosqich nomini kiriting.' }))

  const supabase = await createClient()
  const { error } = await supabase.from('levels').insert({ subject_id: subjectId!, nom: nom!, tartib: 500 })
  if (error) redirect(xabarliYol(yol, { xato: error.code === '23505' ? 'Bu bosqich ro‘yxatda bor.' : xatoMatni(error) }))

  revalidatePath(yol)
  redirect(yol)
}

export async function bosqichSaqla(fd: FormData) {
  await talabRol('admin', 'direktor')
  const yol = ichkiYol(fd.get('yol'))
  const id = sonOqi(fd.get('level_id'))
  const nom = matn(fd.get('nom'))
  if (!id || !nom) redirect(xabarliYol(yol, { xato: 'Bosqich nomini yozing.' }))

  const supabase = await createClient()
  const { error } = await supabase.from('levels').update({ nom: nom! }).eq('id', id!).is('group_id', null)
  if (error) redirect(xabarliYol(yol, { xato: error.code === '23505' ? 'Bu bosqich ro‘yxatda bor.' : xatoMatni(error) }))

  revalidatePath(yol)
  redirect(yol)
}

export async function bosqichOchir(fd: FormData) {
  await talabRol('admin', 'direktor')
  const yol = ichkiYol(fd.get('yol'))
  const id = sonOqi(fd.get('level_id'))
  if (!id) redirect(yol)

  const supabase = await createClient()
  const { count } = await supabase.from('groups').select('id', { count: 'exact', head: true }).eq('level_id', id!)
  if (count) redirect(xabarliYol(yol, { xato: `Bu bosqich ${count} ta guruhda ishlatilgan, o‘chirib bo‘lmaydi.` }))

  const { error } = await supabase.from('levels').delete().eq('id', id!).is('group_id', null)
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath(yol)
  redirect(yol)
}

/* Ustoz: o'z guruhining faqat nomi va bosqichi. Huquq bazada tekshiriladi (0110). */
const USTOZ_ROLLARI = ['admin', 'direktor', 'qabulxona', 'ustoz'] as const

export async function guruhUstozTahrir(fd: FormData) {
  await talabRol(...USTOZ_ROLLARI)
  const id = matn(fd.get('id'))
  if (!id) redirect('/crm/guruhlar')
  const forma = `/crm/guruhlar/${id}/ustoz-tahrir`

  const supabase = await createClient()
  const { error } = await supabase.rpc('guruh_ustoz_tahrir', {
    p_group: id!,
    p_nom: matn(fd.get('nom')) ?? '',
    p_level: sonOqi(fd.get('level_id')),
  })
  if (error) redirect(xabarliYol(forma, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(`/crm/guruhlar/${id}`, { ok: 'Guruh saqlandi.' }))
}

export async function ustozBosqichQosh(fd: FormData) {
  await talabRol(...USTOZ_ROLLARI)
  const id = matn(fd.get('id'))
  if (!id) redirect('/crm/guruhlar')
  const forma = `/crm/guruhlar/${id}/ustoz-tahrir`

  const supabase = await createClient()
  const { error } = await supabase.rpc('ustoz_bosqich_qosh', { p_group: id!, p_nom: matn(fd.get('nom')) ?? '' })
  if (error) redirect(xabarliYol(forma, { xato: xatoMatni(error) }))

  revalidatePath(forma)
  redirect(xabarliYol(forma, { ok: 'Bosqich qo‘shildi. Endi uni ro‘yxatdan tanlang.' }))
}

export async function ustozBosqichTahrir(fd: FormData) {
  await talabRol(...USTOZ_ROLLARI)
  const id = matn(fd.get('id'))
  if (!id) redirect('/crm/guruhlar')
  const forma = `/crm/guruhlar/${id}/ustoz-tahrir`

  const supabase = await createClient()
  const { error } = await supabase.rpc('ustoz_bosqich_tahrir', {
    p_level: sonOqi(fd.get('level_id')) ?? 0,
    p_nom: matn(fd.get('nom')) ?? '',
  })
  if (error) redirect(xabarliYol(forma, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(forma, { ok: 'Bosqich saqlandi.' }))
}

export async function ustozBosqichOchir(fd: FormData) {
  await talabRol(...USTOZ_ROLLARI)
  const id = matn(fd.get('id'))
  if (!id) redirect('/crm/guruhlar')
  const forma = `/crm/guruhlar/${id}/ustoz-tahrir`

  const supabase = await createClient()
  const { error } = await supabase.rpc('ustoz_bosqich_ochir', { p_level: sonOqi(fd.get('level_id')) ?? 0 })
  if (error) redirect(xabarliYol(forma, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(forma, { ok: 'Bosqich o‘chirildi.' }))
}

'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, sanaOqi, telefonOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { MANBALAR, type Bosqich } from '@/lib/lidlar'
import type { Lead, LeadSource } from '@/lib/types'

const XODIM = ['admin', 'direktor', 'qabulxona'] as const

function qaytish(fd: FormData): string {
  const y = String(fd.get('qaytish') ?? '')
  return y.startsWith('/crm/lidlar') ? y : '/crm/lidlar'
}

function manbaOqi(v: FormDataEntryValue | null): LeadSource {
  return MANBALAR.find((m) => m === v) ?? 'boshqa'
}

/** "issiq, chegirma , telegram" → ['issiq','chegirma','telegram'] (10 tagacha). */
function teglarOqi(v: FormDataEntryValue | null): string[] {
  return [...new Set(String(v ?? '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))]
    .map((t) => t.slice(0, 30))
    .slice(0, 10)
}

function tugat(yol: string, ok: string): never {
  revalidatePath('/crm/lidlar')
  revalidatePath('/crm/probniylar')
  revalidatePath('/crm/vazifalar')
  redirect(xabarliYol(yol, { ok }))
}

export async function lidQosh(fd: FormData) {
  await talabRol(...XODIM)
  const yol = qaytish(fd)

  const ism = matn(fd.get('ism'))
  const telefon = telefonOqi(fd.get('telefon'))
  if (!ism) redirect(xabarliYol(yol, { xato: 'Ismini yozing.' }))
  if (!telefon) redirect(xabarliYol(yol, { xato: 'Telefon kerak. Masalan: 90 123 45 67' }))

  const supabase = await createClient()
  const { error } = await supabase.from('leads').insert({
    ism: ism!,
    telefon: telefon!,
    manba: manbaOqi(fd.get('manba')),
    izoh: matn(fd.get('izoh')),
    teglar: teglarOqi(fd.get('teglar')),
    keyingi_aloqa: sanaOqi(fd.get('keyingi_aloqa')),
    holat: 'yangi',
  })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  tugat(yol, `${ism} lidlarga qo‘shildi.`)
}

export async function lidSaqla(fd: FormData) {
  await talabRol(...XODIM)
  const yol = qaytish(fd)
  const id = matn(fd.get('id'))
  const ism = matn(fd.get('ism'))
  const telefon = telefonOqi(fd.get('telefon'))
  if (!id) redirect(yol)
  if (!ism) redirect(xabarliYol(yol, { xato: 'Ismini yozing.' }))
  if (!telefon) redirect(xabarliYol(yol, { xato: 'Telefon noto‘g‘ri.' }))

  const supabase = await createClient()
  const { error } = await supabase
    .from('leads')
    .update({
      ism: ism!,
      telefon: telefon!,
      manba: manbaOqi(fd.get('manba')),
      izoh: matn(fd.get('izoh')),
      teglar: teglarOqi(fd.get('teglar')),
      keyingi_aloqa: sanaOqi(fd.get('keyingi_aloqa')),
    })
    .eq('id', id!)
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  tugat(yol, 'Lid saqlandi.')
}

/**
 * Kanbanda boshqa ustunga o'tkazish. "O'quvchi bo'ldi" — alohida amal
 * (lidOquvchi), chunki guruh va boshlanish sanasi kerak.
 */
export async function lidBosqich(fd: FormData) {
  await talabRol(...XODIM)
  const yol = qaytish(fd)
  const id = matn(fd.get('id'))
  const bosqich = matn(fd.get('bosqich')) as Bosqich | null
  if (!id || !bosqich) redirect(yol)

  const sabab = matn(fd.get('sabab'))
  let ozgarish: Partial<Lead>

  switch (bosqich) {
    case 'yangi':
      ozgarish = { holat: 'yangi', sinov_sana: null }
      break
    case 'boglanildi':
      ozgarish = { holat: 'qongiroq', sinov_sana: null }
      break
    case 'sinov': {
      const sinov = sanaOqi(fd.get('sinov_sana'))
      if (!sinov) redirect(xabarliYol(yol, { xato: 'Sinov darsi kunini tanlang.' }))
      ozgarish = {
        holat: 'qongiroq',
        sinov_sana: sinov,
        group_id: matn(fd.get('group_id')),
        // Sinov kuni — shu kuni eslatma ham
        keyingi_aloqa: sinov,
      }
      break
    }
    case 'yoqotildi': {
      const h = fd.get('holat') === 'kelmadi' ? 'kelmadi' : 'rad'
      if (!sabab) redirect(xabarliYol(yol, { xato: 'Sababini yozing — keyin tahlil uchun kerak.' }))
      ozgarish = { holat: h, keyingi_aloqa: null }
      break
    }
    default:
      redirect(xabarliYol(yol, { xato: 'Bu bosqichga o‘tkazib bo‘lmaydi.' }))
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('leads')
    .update({ ...ozgarish!, sabab: sabab ?? 'Kanban orqali o‘tkazildi' })
    .eq('id', id!)
    .is('student_id', null)
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  tugat(yol, 'Bosqich o‘zgardi.')
}

/** Kartadagi "Bog'lanildi" tugmasi — aloqa soni +1, keyingi aloqa sanasi. */
export async function lidBoglanildi(fd: FormData) {
  await talabRol(...XODIM)
  const yol = qaytish(fd)
  const id = matn(fd.get('id'))
  if (!id) redirect(yol)

  const kanal = fd.get('kanal') === 'telegram' ? 'Telegram' : 'Telefon'
  const izoh = matn(fd.get('izoh'))

  const supabase = await createClient()
  const { error } = await supabase.rpc('lid_boglanildi', {
    p_lead: id!,
    p_keyingi: sanaOqi(fd.get('keyingi_aloqa')),
    p_izoh: izoh ? `${kanal}: ${izoh}` : `${kanal} orqali bog‘lanildi`,
  })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  tugat(yol, 'Aloqa yozildi.')
}

/** O'quvchi qilish — Probniylardagi bilan bir xil qoida (probniy_doimiy, 0030). */
export async function lidOquvchi(fd: FormData) {
  await talabRol(...XODIM)
  const yol = qaytish(fd)
  const id = matn(fd.get('id'))
  const guruh = matn(fd.get('group_id'))
  if (!id) redirect(yol)
  if (!guruh) redirect(xabarliYol(yol, { xato: 'Guruhni tanlang.' }))

  const supabase = await createClient()
  const { error: e1 } = await supabase.from('leads').update({ group_id: guruh! }).eq('id', id!).is('student_id', null)
  if (e1) redirect(xabarliYol(yol, { xato: xatoMatni(e1) }))

  const { data: studentId, error } = await supabase.rpc('probniy_doimiy', {
    p_lead: id!,
    p_boshlandi: sanaOqi(fd.get('boshlandi')),
  })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(`/crm/oquvchilar/${studentId}`, { ok: `O‘quvchi bo‘ldi: ${studentId}` }))
}

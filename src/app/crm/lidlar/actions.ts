'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, sanaOqi, telefonOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { aloqaVaqtga, bosqichi, type Bosqich } from '@/lib/lidlar'
import { bugunToshkent } from '@/lib/format'
import type { Lead, LeadSource } from '@/lib/types'

const XODIM = ['admin', 'direktor', 'manager', 'qabulxona'] as const

function qaytish(fd: FormData): string {
  const y = String(fd.get('qaytish') ?? '')
  return y.startsWith('/crm/lidlar') ? y : '/crm/lidlar'
}

function manbaOqi(v: FormDataEntryValue | null): LeadSource {
  // Ro'yxatda borligini baza tekshiradi (0108)
  return typeof v === 'string' && v ? v : 'boshqa'
}

/** "issiq, chegirma , telegram" → ['issiq','chegirma','telegram'] (10 tagacha). */
function teglarOqi(v: FormDataEntryValue | null): string[] {
  return [...new Set(String(v ?? '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))]
    .map((t) => t.slice(0, 30))
    .slice(0, 10)
}

function tugat(yol: string, ok: string): never {
  revalidatePath('/crm/lidlar')
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
    keyingi_aloqa: aloqaVaqtga(sanaOqi(fd.get('keyingi_aloqa'))),
    sinov_sana: sanaOqi(fd.get('sinov_sana')),
    group_id: matn(fd.get('group_id')),
    tugilgan_sana: sanaOqi(fd.get('tugilgan_sana')),
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
      keyingi_aloqa: aloqaVaqtga(sanaOqi(fd.get('keyingi_aloqa'))),
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
      const guruh = matn(fd.get('group_id'))

      // 0119 — sinovdagi bola boshqa guruhga: sana o'tgan kun ham bo'ladi,
      // eski guruh jurnalidagi belgilar o'chadi, yangi jurnalda shu kundan
      const supabase = await createClient()
      const { data: eski } = await supabase
        .from('leads')
        .select('group_id, holat, sinov_sana, student_id, sinov_otkazildi, guruh_dan')
        .eq('id', id!)
        .maybeSingle()
      const bugun = bugunToshkent()
      // Guruh almashsa yoki o'sha guruhda boshlanish kuni o'tgan kunga surilsa
      // Jurnaldagi hozirgi boshlanish (jurnal_probniylar bilan bir xil)
      const boshi = eski
        ? (eski.guruh_dan ?? [eski.sinov_otkazildi, eski.sinov_sana].filter(Boolean).sort()[0] ?? null)
        : null
      if (eski && guruh && bosqichi(eski) === 'sinov' && (eski.group_id !== guruh || (boshi && sinov! < boshi))) {
        const { error } = await supabase.rpc('sinov_guruh_almashtir', {
          p_lead: id!,
          p_group: guruh,
          p_sana: sinov! > bugun ? bugun : sinov!,
        })
        if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
        const { error: e2 } = await supabase
          .from('leads')
          .update({
            sinov_sana: sinov!,
            ...(sinov! > bugun ? { keyingi_aloqa: aloqaVaqtga(sinov) } : {}),
            sabab: sabab ?? 'Sinovda guruh almashtirildi',
          })
          .eq('id', id!)
          .is('student_id', null)
        if (e2) redirect(xabarliYol(yol, { xato: xatoMatni(e2) }))
        tugat(yol, eski.group_id !== guruh
          ? `Guruh almashtirildi: ${sinov! > bugun ? 'bugundan' : sinov!.split('-').reverse().join('.') + ' dan'} yangi jurnalda, eski jurnaldan chiqdi.`
          : `Jurnalda ${sinov!.split('-').reverse().join('.')} dan ochildi.`)
      }

      ozgarish = {
        holat: 'qongiroq',
        sinov_sana: sinov,
        group_id: matn(fd.get('group_id')),
        // Sinov kuni — shu kuni eslatma ham (o'tgan kun bo'lsa — eslatma o'zgarmaydi)
        ...(sinov! >= bugunToshkent() ? { keyingi_aloqa: aloqaVaqtga(sinov) } : {}),
      }
      break
    }
    case 'yoqotildi': {
      const h = fd.get('holat') === 'kelmadi' ? 'kelmadi' : 'rad'
      if (!sabab) redirect(xabarliYol(yol, { xato: 'Sababini yozing — keyin tahlil uchun kerak.' }))
      if (fd.get('holat') === 'xato') {
        await talabRol('admin', 'direktor')
        const { error } = await (await createClient()).rpc('lid_xato_belgila', { p_lid: id!, p_sabab: sabab! })
        if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
        tugat(yol, 'Xato kiritilgan deb belgilandi, konversiyaga kirmaydi.')
      }
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

/** O'quvchi qilish — botdagi probniy → doimiy qoidasi (probniy_doimiy, 0030). */
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

/** Xato kiritilgan lid: konversiyadan chiqadi, /crm/lidlar/xato da turadi (0114). */
export async function lidXatoQaytar(fd: FormData) {
  await talabRol('admin', 'direktor')
  const yol = qaytish(fd)
  const { error } = await (await createClient()).rpc('lid_xato_qaytar', { p_lid: String(fd.get('id') ?? '') })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  tugat(yol, 'Lid qaytarildi.')
}

export async function lidXatoOchir(fd: FormData) {
  await talabRol('manager', 'direktor')
  const yol = qaytish(fd)
  const { error } = await (await createClient()).rpc('lid_xato_ochir', { p_lid: String(fd.get('id') ?? '') })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  tugat(yol, 'Lid butunlay o‘chirildi.')
}

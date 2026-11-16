'use server'

/**
 * Ustoz profili amallari (0126). Ustozning o'zi ("Ma'lumotlarim") ham,
 * admin/manager/direktor (ustoz sahifasi) ham shu amallarni ishlatadi —
 * kim nimaga tegishi RLS va triggerlarda. Saqlangach ikkinchi tomonga
 * xabar (ustoz_profil_xabar, 30 daq ichida bir marta).
 */
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { ustozProfilTgYubor } from '@/lib/ustoz-profil-xabar'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabProfil } from '@/lib/auth'
import { matn, sanaOqi, sonOqi, xabarliYol, xatoMatni, ichkiYol } from '@/lib/kiritish'
import { royxatOqi } from '@/lib/ustoz-profil'

type Natija = { error: { message?: string; code?: string } | null }

function yol(fd: FormData): string {
  const y = ichkiYol(fd.get('qaytish'))
  return y.startsWith('/crm/') ? y : '/crm/malumotlarim'
}

function oqi(fd: FormData) {
  const teacherId = matn(fd.get('teacher_id'))
  const qaytish = yol(fd)
  if (!teacherId) redirect(xabarliYol(qaytish, { xato: 'Ustoz aniqlanmadi.' }))
  return { teacherId: teacherId!, qaytish }
}

async function tugat(
  supabase: Awaited<ReturnType<typeof createClient>>,
  r: Natija,
  teacherId: string,
  qaytish: string,
  bolim: string,
  ok: string,
) {
  if (r.error) redirect(xabarliYol(qaytish, { xato: xatoMatni(r.error) }))
  const { data: x } = await supabase.rpc('ustoz_profil_xabar', { p_teacher: teacherId, p_bolim: bolim })
  if (x?.tg?.length) after(() => ustozProfilTgYubor(x.tg))
  revalidatePath('/crm/malumotlarim')
  revalidatePath(`/crm/ustozlar/${teacherId}/profil`)
  redirect(xabarliYol(qaytish, { ok }))
}

const bosh = (v: FormDataEntryValue | null) => matn(v)

/* ---------- CV: asosiy ---------- */
export async function asosiySaqla(fd: FormData) {
  await talabProfil()
  const { teacherId, qaytish } = oqi(fd)
  const supabase = await createClient()
  const yil = sonOqi(fd.get('dars_boshlagan_yil'))
  const r = await supabase
    .from('teacher_profil')
    .update({
      rasm_yol: bosh(fd.get('rasm_yol')),
      tavsif: bosh(fd.get('tavsif')),
      fanlar: royxatOqi(fd.get('fanlar')),
      tillar: royxatOqi(fd.get('tillar')),
      dars_boshlagan_yil: yil,
    })
    .eq('teacher_id', teacherId)
  await tugat(supabase, r, teacherId, qaytish, 'CV', 'Saqlandi. Saytga chiqishi uchun manager tasdiqlaydi.')
}

/* ---------- Sertifikat ---------- */
export async function sertifikatSaqla(fd: FormData) {
  await talabProfil()
  const { teacherId, qaytish } = oqi(fd)
  const id = sonOqi(fd.get('id'))
  const turi = bosh(fd.get('turi'))
  if (!turi) redirect(xabarliYol(qaytish, { xato: 'Sertifikat turini tanlang.' }))
  const supabase = await createClient()
  const qator = {
    turi: turi!,
    ball: bosh(fd.get('ball')),
    qayerda: bosh(fd.get('qayerda')),
    sana: sanaOqi(fd.get('sana')),
    muddat: sanaOqi(fd.get('muddat')),
    fayl_yol: bosh(fd.get('fayl_yol')),
  }
  const r = id
    ? await supabase.from('teacher_sertifikat').update(qator).eq('id', id).eq('teacher_id', teacherId)
    : await supabase.from('teacher_sertifikat').insert({ ...qator, teacher_id: teacherId })
  await tugat(supabase, r, teacherId, qaytish, 'sertifikat', id ? 'Sertifikat saqlandi.' : 'Sertifikat qo‘shildi.')
}

/* ---------- Yutuq ---------- */
export async function yutuqSaqla(fd: FormData) {
  await talabProfil()
  const { teacherId, qaytish } = oqi(fd)
  const id = sonOqi(fd.get('id'))
  const nomi = bosh(fd.get('nomi'))
  if (!nomi) redirect(xabarliYol(qaytish, { xato: 'Yutuq nomini yozing.' }))
  const supabase = await createClient()
  const qator = { nomi: nomi!, sana: sanaOqi(fd.get('sana')), izoh: bosh(fd.get('izoh')), fayl_yol: bosh(fd.get('fayl_yol')) }
  const r = id
    ? await supabase.from('teacher_yutuq').update(qator).eq('id', id).eq('teacher_id', teacherId)
    : await supabase.from('teacher_yutuq').insert({ ...qator, teacher_id: teacherId })
  await tugat(supabase, r, teacherId, qaytish, 'yutuq', id ? 'Yutuq saqlandi.' : 'Yutuq qo‘shildi.')
}

/* ---------- Ta'lim ---------- */
export async function talimSaqla(fd: FormData) {
  await talabProfil()
  const { teacherId, qaytish } = oqi(fd)
  const id = sonOqi(fd.get('id'))
  const otm = bosh(fd.get('otm'))
  if (!otm) redirect(xabarliYol(qaytish, { xato: 'O‘quv yurti nomini yozing.' }))
  const supabase = await createClient()
  const oqiyapti = fd.get('oqiyapti') === '1'
  const qator = {
    otm: otm!,
    yonalish: bosh(fd.get('yonalish')),
    daraja: bosh(fd.get('daraja')),
    dan_yil: sonOqi(fd.get('dan_yil')),
    gacha_yil: oqiyapti ? null : sonOqi(fd.get('gacha_yil')),
    oqiyapti,
    diplom_yol: bosh(fd.get('diplom_yol')),
  }
  const r = id
    ? await supabase.from('teacher_talim').update(qator).eq('id', id).eq('teacher_id', teacherId)
    : await supabase.from('teacher_talim').insert({ ...qator, teacher_id: teacherId })
  await tugat(supabase, r, teacherId, qaytish, 'ta’lim', id ? 'Ta’lim saqlandi.' : 'Ta’lim qo‘shildi.')
}

/* ---------- Mehnat faoliyati (obyektivka) ---------- */
export async function mehnatSaqla(fd: FormData) {
  await talabProfil()
  const { teacherId, qaytish } = oqi(fd)
  const id = sonOqi(fd.get('id'))
  const ish = bosh(fd.get('ish_joyi'))
  const dan = sonOqi(fd.get('dan_yil'))
  if (!ish || !dan) redirect(xabarliYol(qaytish, { xato: 'Ish joyi va boshlangan yilni yozing.' }))
  const supabase = await createClient()
  const qator = { ish_joyi: ish!, dan_yil: dan!, gacha_yil: sonOqi(fd.get('gacha_yil')), lavozim: bosh(fd.get('lavozim')) }
  const r = id
    ? await supabase.from('teacher_mehnat').update(qator).eq('id', id).eq('teacher_id', teacherId)
    : await supabase.from('teacher_mehnat').insert({ ...qator, teacher_id: teacherId })
  await tugat(supabase, r, teacherId, qaytish, 'mehnat', id ? 'Saqlandi.' : 'Qo‘shildi.')
}

/* ---------- Obyektivka (shaxsiy) — darhol, tasdiqsiz ---------- */
export async function shaxsiySaqla(fd: FormData) {
  await talabProfil()
  const { teacherId, qaytish } = oqi(fd)
  const supabase = await createClient()
  const r = await supabase.from('teacher_shaxsiy').upsert({
    teacher_id: teacherId,
    tugilgan_sana: sanaOqi(fd.get('tugilgan_sana')),
    tugilgan_joy: bosh(fd.get('tugilgan_joy')),
    millati: bosh(fd.get('millati')),
    malumoti: bosh(fd.get('malumoti')),
    mutaxassisligi: bosh(fd.get('mutaxassisligi')),
    ilmiy_daraja: bosh(fd.get('ilmiy_daraja')),
    ilmiy_unvon: bosh(fd.get('ilmiy_unvon')),
    chet_tillari: bosh(fd.get('chet_tillari')),
    mukofotlar: bosh(fd.get('mukofotlar')),
    // Pasport, JSHSHIR va pasport nusxasi kiritilmaydi (16.11) — upsert'da yo'q, bazadagisi o'zgarmaydi
    manzil: bosh(fd.get('manzil')),
    updated_at: new Date().toISOString(),
  })
  await tugat(supabase, r, teacherId, qaytish, 'obyektivka', 'Obyektivka saqlandi.')
}

/* ---------- O'chirish (sertifikat, yutuq, ta'lim, mehnat) ---------- */
const JADVAL = { sertifikat: 'teacher_sertifikat', yutuq: 'teacher_yutuq', talim: 'teacher_talim', mehnat: 'teacher_mehnat' } as const

export async function qatorOchir(fd: FormData) {
  await talabProfil()
  const { teacherId, qaytish } = oqi(fd)
  const tur = matn(fd.get('tur')) as keyof typeof JADVAL | null
  const id = sonOqi(fd.get('id'))
  if (!tur || !(tur in JADVAL) || !id) redirect(xabarliYol(qaytish, { xato: 'Noto‘g‘ri so‘rov.' }))
  const supabase = await createClient()
  const r = await supabase.from(JADVAL[tur!]).delete().eq('id', id!).eq('teacher_id', teacherId)
  await tugat(supabase, r, teacherId, qaytish, tur === 'mehnat' ? 'mehnat' : tur!, 'O‘chirildi.')
}

/* ---------- Admin: saytda ko'rsatish ---------- */
export async function korinishSaqla(fd: FormData) {
  await talabProfil()
  const { teacherId, qaytish } = oqi(fd)
  const supabase = await createClient()
  const korinish: Record<string, boolean> = {}
  for (const k of ['rasm', 'tavsif', 'fanlar', 'tajriba', 'tillar', 'sertifikatlar', 'yutuqlar', 'talim']) korinish[k] = fd.get(`k_${k}`) === '1'
  const r = await supabase
    .from('teacher_profil')
    .update({ saytda: fd.get('saytda') === '1', korinish, sayt_tartib: sonOqi(fd.get('sayt_tartib')) ?? 100 })
    .eq('teacher_id', teacherId)
  if (r.error) redirect(xabarliYol(qaytish, { xato: xatoMatni(r.error) }))

  // Har sertifikat/yutuq: saytda va fayli saytda
  for (const [tur, jadval] of [['s', 'teacher_sertifikat'], ['y', 'teacher_yutuq']] as const) {
    const idlar = fd.getAll(`${tur}_id`).map((x) => Number(x)).filter(Boolean)
    for (const id of idlar) {
      const q = await supabase
        .from(jadval)
        .update({ saytda: fd.get(`${tur}_saytda_${id}`) === '1', fayl_saytda: fd.get(`${tur}_fayl_${id}`) === '1' })
        .eq('id', id)
        .eq('teacher_id', teacherId)
      if (q.error) redirect(xabarliYol(qaytish, { xato: xatoMatni(q.error) }))
    }
  }
  revalidatePath('/')
  revalidatePath(`/crm/ustozlar/${teacherId}/profil`)
  redirect(xabarliYol(qaytish, { ok: 'Saytda ko‘rsatish sozlamalari saqlandi.' }))
}

/* ---------- Manager: tasdiqlash / qaytarish ---------- */
export async function cvTasdiqla(fd: FormData) {
  await talabProfil()
  const { teacherId, qaytish } = oqi(fd)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('ustoz_cv_tasdiqla', { p_teacher: teacherId })
  if (error) redirect(xabarliYol(qaytish, { xato: xatoMatni(error) }))
  if (data?.tg?.length) after(() => ustozProfilTgYubor(data.tg))
  revalidatePath('/')
  revalidatePath('/crm/malumotlarim')
  revalidatePath(`/crm/ustozlar/${teacherId}/profil`)
  redirect(xabarliYol(qaytish, { ok: 'Tasdiqlandi. Saytda yangi nusxa ko‘rinadi (agar saytda ko‘rsatish yoqilgan bo‘lsa).' }))
}

export async function cvQaytar(fd: FormData) {
  await talabProfil()
  const { teacherId, qaytish } = oqi(fd)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('ustoz_cv_qaytar', { p_teacher: teacherId, p_izoh: matn(fd.get('izoh')) ?? '' })
  if (error) redirect(xabarliYol(qaytish, { xato: xatoMatni(error) }))
  if (data?.tg?.length) after(() => ustozProfilTgYubor(data.tg))
  revalidatePath('/crm/malumotlarim')
  revalidatePath(`/crm/ustozlar/${teacherId}/profil`)
  redirect(xabarliYol(qaytish, { ok: 'Ustozga qaytarildi.' }))
}

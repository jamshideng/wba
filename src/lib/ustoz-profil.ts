/**
 * Ustoz profili (0126): CV + obyektivka. Bitta yuklovchi — ustozning
 * "Ma'lumotlarim" sahifasi ham, admin sahifasi ham shuni ishlatadi.
 * Huquq bazada (RLS): ustozning o'zi yoki admin/manager/direktor.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const RASM_BUCKET = 'ustoz-rasm'
export const HUJJAT_BUCKET = 'ustoz-hujjat'

export const SERTIFIKAT_TURLARI = ['IELTS', 'CEFR', 'TOEFL', 'SAT', 'Duolingo', 'Milliy sertifikat', 'TKT', 'CELTA', 'Boshqa'] as const

export const DARAJA_NOMI: Record<string, string> = {
  bakalavr: 'Bakalavr',
  magistr: 'Magistr',
  phd: 'PhD / DSc',
  orta_maxsus: 'O‘rta maxsus',
  kurs: 'Kurs / trening',
  boshqa: 'Boshqa',
}

export const MALUMOTI_NOMI: Record<string, string> = {
  oliy: 'Oliy',
  tugallanmagan_oliy: 'Tugallanmagan oliy',
  orta_maxsus: 'O‘rta maxsus',
  orta: 'O‘rta',
}

export const HOLAT_NOMI: Record<string, string> = {
  qoralama: 'To‘ldirilmoqda',
  kutilmoqda: 'Tasdiq kutilmoqda',
  tasdiqlangan: 'Tasdiqlangan',
  qaytarildi: 'Qaytarildi',
}

/** v_ustoz_toldirish dagi qolgan bo'limlar nomi */
export const QOLGAN_NOMI: Record<string, string> = {
  rasm: 'rasm',
  tavsif: 'tavsif',
  fanlar: 'fanlar',
  tajriba: 'tajriba (yil)',
  tugilgan_sana: 'tug‘ilgan sana',
  talim: 'ta’lim',
  mehnat: 'mehnat faoliyati',
  manzil: 'yashash manzili',
}

export const KORINISH_MAYDONLARI = [
  ['rasm', 'Rasm'],
  ['tavsif', 'Tavsif'],
  ['fanlar', 'Fanlar'],
  ['tajriba', 'Tajriba'],
  ['tillar', 'Tillar'],
  ['sertifikatlar', 'Sertifikatlar'],
  ['yutuqlar', 'Yutuqlar'],
  ['talim', 'Ta’lim'],
] as const

export type Profil = {
  teacher_id: string
  rasm_yol: string | null
  tavsif: string | null
  fanlar: string[]
  dars_boshlagan_yil: number | null
  tillar: string[]
  slug: string | null
  saytda: boolean
  sayt_tartib: number
  korinish: Record<string, boolean>
  holat: 'qoralama' | 'kutilmoqda' | 'tasdiqlangan' | 'qaytarildi'
  qaytarish_izoh: string | null
  ommaviy: Record<string, unknown> | null
  ozgardi_vaqt: string | null
  tasdiqlandi_vaqt: string | null
}
export type Sertifikat = {
  id: number
  turi: string
  ball: string | null
  qayerda: string | null
  sana: string | null
  muddat: string | null
  fayl_yol: string | null
  saytda: boolean
  fayl_saytda: boolean
}
export type Yutuq = { id: number; nomi: string; sana: string | null; izoh: string | null; fayl_yol: string | null; saytda: boolean; fayl_saytda: boolean }
export type Talim = {
  id: number
  otm: string
  yonalish: string | null
  daraja: string | null
  dan_yil: number | null
  gacha_yil: number | null
  oqiyapti: boolean
  diplom_yol: string | null
}
export type Mehnat = { id: number; dan_yil: number; gacha_yil: number | null; ish_joyi: string; lavozim: string | null }
export type Shaxsiy = {
  tugilgan_sana: string | null
  tugilgan_joy: string | null
  millati: string | null
  malumoti: string | null
  mutaxassisligi: string | null
  ilmiy_daraja: string | null
  ilmiy_unvon: string | null
  chet_tillari: string | null
  mukofotlar: string | null
  pasport: string | null
  pasport_yol: string | null
  jshshir: string | null
  manzil: string | null
}
export type Tarix = {
  id: number
  jadval: string
  amal: 'qoshildi' | 'ozgardi' | 'ochirildi'
  maydon: string | null
  eski: string | null
  yangi: string | null
  kim_ustoz: boolean
  vaqt: string
  profiles: { ism: string } | null
}
export type Toldirish = { foiz: number; qolgan: string[]; majburiy_qolgan: string[] | null }

export type UstozProfilMalumot = {
  ustoz: { id: string; ism: string; ismi: string; familiya: string | null; telefon: string | null }
  profil: Profil
  sertifikatlar: Sertifikat[]
  yutuqlar: Yutuq[]
  talim: Talim[]
  mehnat: Mehnat[]
  shaxsiy: Shaxsiy | null
  tarix: Tarix[]
  toldirish: Toldirish | null
  /** Fayl yo'li → ko'rish havolasi (rasm — ochiq, hujjat — 1 soatlik imzoli) */
  havola: Record<string, string>
}

/** Bitta yuklovchi. RLS ruxsat bermasa — null. */
export async function ustozProfilOl(supabase: SupabaseClient, teacherId: string): Promise<UstozProfilMalumot | null> {
  const [u, p, s, y, t, m, sh, tx, td] = await Promise.all([
    supabase.from('teachers').select('id, ism, ismi, familiya, telefon').eq('id', teacherId).maybeSingle(),
    supabase.from('teacher_profil').select('*').eq('teacher_id', teacherId).maybeSingle(),
    supabase.from('teacher_sertifikat').select('*').eq('teacher_id', teacherId).order('tartib').order('sana', { ascending: false, nullsFirst: false }).order('id'),
    supabase.from('teacher_yutuq').select('*').eq('teacher_id', teacherId).order('tartib').order('sana', { ascending: false, nullsFirst: false }).order('id'),
    supabase.from('teacher_talim').select('*').eq('teacher_id', teacherId).order('dan_yil', { ascending: false, nullsFirst: false }).order('id'),
    supabase.from('teacher_mehnat').select('*').eq('teacher_id', teacherId).order('dan_yil', { ascending: false }).order('id'),
    supabase.from('teacher_shaxsiy').select('*').eq('teacher_id', teacherId).maybeSingle(),
    supabase
      .from('teacher_profil_tarix')
      .select('id, jadval, amal, maydon, eski, yangi, kim_ustoz, vaqt, profiles(ism)')
      .eq('teacher_id', teacherId)
      .order('vaqt', { ascending: false })
      .limit(60),
    supabase.from('v_ustoz_toldirish').select('foiz, qolgan, majburiy_qolgan').eq('teacher_id', teacherId).maybeSingle(),
  ])
  if (!u.data || !p.data) return null

  const sertifikatlar = (s.data ?? []) as Sertifikat[]
  const yutuqlar = (y.data ?? []) as Yutuq[]
  const talim = (t.data ?? []) as Talim[]
  const shaxsiy = (sh.data ?? null) as Shaxsiy | null
  const profil = p.data as Profil

  const havola: Record<string, string> = {}
  if (profil.rasm_yol) havola[profil.rasm_yol] = supabase.storage.from(RASM_BUCKET).getPublicUrl(profil.rasm_yol).data.publicUrl
  const hujjatlar = [
    ...sertifikatlar.map((x) => x.fayl_yol),
    ...yutuqlar.map((x) => x.fayl_yol),
    ...talim.map((x) => x.diplom_yol),
  ].filter((x): x is string => Boolean(x))
  if (hujjatlar.length) {
    const { data } = await supabase.storage.from(HUJJAT_BUCKET).createSignedUrls(hujjatlar, 3600)
    for (const d of data ?? []) if (d.path && d.signedUrl) havola[d.path] = d.signedUrl
  }

  return {
    ustoz: u.data as UstozProfilMalumot['ustoz'],
    profil,
    sertifikatlar,
    yutuqlar,
    talim,
    mehnat: (m.data ?? []) as Mehnat[],
    shaxsiy,
    tarix: (tx.data ?? []) as unknown as Tarix[],
    toldirish: (td.data ?? null) as Toldirish | null,
    havola,
  }
}

/** Tarixdagi maydon nomi — odam o'qiydigan */
export const MAYDON_NOMI: Record<string, string> = {
  rasm_yol: 'rasm',
  tavsif: 'tavsif',
  fanlar: 'fanlar',
  dars_boshlagan_yil: 'dars boshlagan yil',
  tillar: 'tillar',
  saytda: 'saytda ko‘rsatish',
  sayt_tartib: 'saytdagi tartib',
  korinish: 'ko‘rinadigan maydonlar',
  slug: 'sayt manzili',
  turi: 'turi',
  ball: 'ball',
  qayerda: 'qayerda',
  sana: 'sana',
  muddat: 'amal qilish muddati',
  fayl_yol: 'fayl',
  fayl_saytda: 'fayl saytda',
  nomi: 'nomi',
  izoh: 'izoh',
  otm: 'OTM',
  yonalish: 'yo‘nalish',
  daraja: 'daraja',
  dan_yil: 'boshlangan yil',
  gacha_yil: 'tugagan yil',
  oqiyapti: 'o‘qiyapti',
  diplom_yol: 'diplom',
  ish_joyi: 'ish joyi',
  lavozim: 'lavozim',
  tugilgan_sana: 'tug‘ilgan sana',
  tugilgan_joy: 'tug‘ilgan joy',
  millati: 'millati',
  malumoti: 'ma’lumoti',
  mutaxassisligi: 'mutaxassisligi',
  ilmiy_daraja: 'ilmiy daraja',
  ilmiy_unvon: 'ilmiy unvon',
  chet_tillari: 'chet tillari',
  mukofotlar: 'mukofotlar',
  pasport: 'pasport',
  pasport_yol: 'pasport nusxasi',
  jshshir: 'JSHSHIR',
  manzil: 'manzil',
}

export const JADVAL_BOLIM: Record<string, string> = {
  teacher_profil: 'CV',
  teacher_sertifikat: 'Sertifikat',
  teacher_yutuq: 'Yutuq',
  teacher_talim: 'Ta’lim',
  teacher_mehnat: 'Mehnat faoliyati',
  teacher_shaxsiy: 'Obyektivka',
}

/** Vergul bilan yozilgan ro'yxat → massiv (bo'shlar tashlanadi, takrorlar olib tashlanadi) */
export function royxatOqi(v: FormDataEntryValue | null): string[] {
  const s = typeof v === 'string' ? v : ''
  return [...new Set(s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean))].slice(0, 12)
}

/** ommaviy_ustozlar() — saytdagi ko'rinish (faqat ruxsat berilgan maydonlar) */
export type OmmaviyUstoz = {
  slug: string
  tartib: number
  ism: string
  rasm_yol?: string
  tavsif?: string
  fanlar?: string[]
  dars_boshlagan_yil?: number
  tillar?: string[]
  talim?: { id: number; otm: string; yonalish: string | null; daraja: string | null; dan_yil: number | null; gacha_yil: number | null; oqiyapti: boolean }[]
  sertifikatlar?: { id: number; turi: string; ball: string | null; qayerda: string | null; sana: string | null; muddat: string | null; fayl_yol?: string }[]
  yutuqlar?: { id: number; nomi: string; sana: string | null; izoh: string | null; fayl_yol?: string }[]
}

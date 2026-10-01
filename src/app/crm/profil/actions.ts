'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient as supabaseKlient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { talabProfil } from '@/lib/auth'
import { matn, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { loginEmail, loginNomi, LOGIN_QOIDASI } from '@/lib/login'
import { BOT_NOMI } from '@/lib/telegram'

const YOL = '/crm/profil'

/** O'quvchi va ota-ona ism, login, parolni o'zi o'zgartirmaydi (0032) — faqat admin orqali. */
const YOPIQ_ROLLAR = ['oquvchi', 'ota_ona']
const OQUVCHIGA_YOPIQ = 'Ism va loginni markaz admini o‘zgartiradi — unga murojaat qiling.'

/**
 * Joriy parolni tekshiradi — foydalanuvchining o'z sessiyasiga tegmasdan,
 * alohida bir martalik klient bilan. Login yoki parol almashtirishdan
 * oldin shart: kompyuter ochiq qolib ketsa ham begona odam hisobni
 * o'zlashtirib ololmasin.
 */
async function parolTogri(email: string, parol: string): Promise<boolean> {
  if (!email || !parol) return false
  const bir = supabaseKlient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await bir.auth.signInWithPassword({ email, password: parol })
  if (error) return false
  await bir.auth.signOut({ scope: 'local' })
  return true
}

/** Iz qoldirish: kim o'z hisobida nimani o'zgartirdi (parolning o'zi yozilmaydi). */
async function iz(profileId: string, amal: string, yangi: Record<string, unknown>) {
  await createAdminClient().from('audit_log').insert({
    profile_id: profileId,
    amal,
    jadval: 'profiles',
    obyekt_id: profileId,
    yangi,
  })
}

export async function ismOzgartir(fd: FormData) {
  const men = await talabProfil()
  if (YOPIQ_ROLLAR.includes(men.rol)) redirect(xabarliYol(YOL, { xato: OQUVCHIGA_YOPIQ }))
  const ism = matn(fd.get('ism'))
  if (!ism || ism.length < 3) redirect(xabarliYol(YOL, { xato: 'Ism kamida 3 harf bo‘lsin.' }))

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ ism: ism! }).eq('id', men.id)
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(YOL, { ok: 'Ism saqlandi.' }))
}

/**
 * Login almashtirish.
 *
 * service_role bu yerda — ikkinchi TOR istisno (CLAUDE.md): email
 * almashtirishni Supabase odatda eski va yangi pochtaga xat yuborib
 * tasdiqlatadi, bizning loginlar esa haqiqiy pochta emas. Shuning
 * uchun tasdiqni biz o'zimiz qilamiz — joriy parol bilan — va faqat
 * O'Z hisobini (men.id) o'zgartiramiz.
 */
export async function loginOzgartir(fd: FormData) {
  const men = await talabProfil()
  if (YOPIQ_ROLLAR.includes(men.rol)) redirect(xabarliYol(YOL, { xato: OQUVCHIGA_YOPIQ }))
  const yangi = loginEmail(fd.get('login'))
  const parol = String(fd.get('joriy_parol') ?? '')

  if (!yangi) redirect(xabarliYol(YOL, { xato: `Login noto‘g‘ri. ${LOGIN_QOIDASI}` }))
  if (yangi === men.email) redirect(xabarliYol(YOL, { xato: 'Bu sizning hozirgi loginingiz.' }))
  if (!men.email || !(await parolTogri(men.email, parol))) {
    redirect(xabarliYol(YOL, { xato: 'Joriy parol noto‘g‘ri.' }))
  }

  const { error } = await createAdminClient().auth.admin.updateUserById(men.id, {
    email: yangi!,
    email_confirm: true,
  })
  if (error) {
    const band = /already|registered|exists/i.test(error.message)
    redirect(xabarliYol(YOL, { xato: band ? 'Bu login band — boshqasini tanlang.' : xatoMatni(error) }))
  }

  const supabase = await createClient()
  await supabase.from('profiles').update({ email: yangi! }).eq('id', men.id)
  await iz(men.id, 'LOGIN_OZGARDI', { eski: men.email, yangi })

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(YOL, { ok: `Login o‘zgardi. Endi “${loginNomi(yangi)}” bilan kirasiz.` }))
}

/**
 * Parol — hamma o'zi almashtiradi (o'quvchi va ota-ona ham, Jamshid 01.10:
 * berilgan tasodifiy parolni yodlash qiyin). Ism va login esa ularga yopiq (0032).
 * Joriy parol so'raladi — telefonni olgan begona odam almashtira olmaydi.
 */
export async function parolOzgartir(fd: FormData) {
  const men = await talabProfil()
  const joriy = String(fd.get('joriy_parol') ?? '')
  const yangi = String(fd.get('yangi_parol') ?? '')
  const takror = String(fd.get('takror_parol') ?? '')
  // O'quvchiga yodlash oson bo'lsin — 6 belgi; xodimda pul bor — 8
  const eng = YOPIQ_ROLLAR.includes(men.rol) ? 6 : 8

  if (yangi.length < eng) redirect(xabarliYol(YOL, { xato: `Yangi parol kamida ${eng} belgidan bo‘lsin.` }))
  if (yangi !== takror) redirect(xabarliYol(YOL, { xato: 'Yangi parol va takrori bir xil emas.' }))
  if (yangi === joriy) redirect(xabarliYol(YOL, { xato: 'Yangi parol eskisidan farq qilsin.' }))
  if (!men.email || !(await parolTogri(men.email, joriy))) {
    redirect(xabarliYol(YOL, { xato: 'Joriy parol noto‘g‘ri.' }))
  }

  // Parolni o'z sessiyasi bilan almashtiradi — admin kaliti kerak emas
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: yangi })
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))

  await iz(men.id, 'PAROL_OZGARDI', {})
  redirect(xabarliYol(YOL, { ok: 'Parol o‘zgardi. Keyingi safar yangi parol bilan kirasiz.' }))
}

/**
 * "Telegramga ulash": 15 daqiqalik bir martalik token (telegram_token_ol,
 * 0021) va to'g'ridan-to'g'ri botga — t.me/<bot>?start=<token>. Bot tokenni
 * ko'rib, shu hisobni (o'quvchi / ota-ona / ustoz / xodim) ulaydi.
 */
export async function telegramUlash() {
  await talabProfil()
  const supabase = await createClient()
  const { data: token, error } = await supabase.rpc('telegram_token_ol')
  if (error || !token) redirect(xabarliYol(YOL, { xato: xatoMatni(error ?? { message: 'Havola yaratilmadi.' }) }))
  redirect(`https://t.me/${BOT_NOMI}?start=${token}`)
}

'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { talabRol } from '@/lib/auth'
import { matn, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { loginEmail, loginNomi, LOGIN_QOIDASI } from '@/lib/login'

/**
 * XODIM HISOBLARI — ustoz bo'lmagan xodimlar (qabulxona, admin, direktor).
 *
 * Hisob ochish (/crm/hisoblar) qoidasining o'zi: avval oddiy (RLS) klient
 * bilan talabRol('admin','direktor'); service_role FAQAT auth
 * foydalanuvchisini yaratish, parolini va app_metadata dagi rolini
 * yozish uchun; rol profiles'ga oddiy klient bilan yoziladi — bazadagi
 * 0011 triggeri direktor rolini faqat direktorga berdiradi va hech kim
 * o'z rolini o'zgartira olmaydi.
 */

const YOL = '/crm/xodimlar'
const ROLLAR = ['qabulxona', 'admin', 'direktor'] as const
type XodimRol = (typeof ROLLAR)[number]

function rolOqi(fd: FormData): XodimRol | null {
  return ROLLAR.find((r) => r === fd.get('rol')) ?? null
}

/** login bo'yicha auth foydalanuvchisi (listUsers sahifalab beradi) */
async function hisobTop(email: string) {
  const admin = createAdminClient()
  for (let sahifa = 1; ; sahifa++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: sahifa, perPage: 1000 })
    if (error) return { xato: xatoMatni(error) } as const
    const bor = data.users.find((u) => u.email?.toLowerCase() === email)
    if (bor || data.users.length < 1000) return { bor } as const
  }
}

export async function xodimQosh(fd: FormData) {
  await talabRol('admin', 'direktor')

  const ism = matn(fd.get('ism'))
  const email = loginEmail(fd.get('login'))
  const rol = rolOqi(fd)
  const parol = String(fd.get('parol') ?? '')
  if (!ism) redirect(xabarliYol(YOL, { xato: 'Ismini yozing.' }))
  if (!email) redirect(xabarliYol(YOL, { xato: `Login noto‘g‘ri. ${LOGIN_QOIDASI}` }))
  if (!rol) redirect(xabarliYol(YOL, { xato: 'Lavozimni tanlang.' }))
  if (parol.length < 8) redirect(xabarliYol(YOL, { xato: 'Parol kamida 8 belgidan bo‘lsin.' }))

  const topildi = await hisobTop(email!)
  if ('xato' in topildi) redirect(xabarliYol(YOL, { xato: topildi.xato }))
  if (topildi.bor) {
    redirect(xabarliYol(YOL, { xato: `“${loginNomi(email)}” logini band. Boshqa login tanlang yoki ro‘yxatdan o‘sha odamning parolini almashtiring.` }))
  }

  /* ── Faqat shu qadam admin kaliti bilan ── */
  const { data, error } = await createAdminClient().auth.admin.createUser({
    email: email!,
    password: parol,
    email_confirm: true,
    user_metadata: { ism },
    app_metadata: { rol },
  })
  if (error || !data.user) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))

  /* ── Rol va ism oddiy huquq bilan (0011 triggeri tekshiradi) ── */
  const supabase = await createClient()
  const { error: xatoProfil } = await supabase.from('profiles').update({ ism: ism!, rol: rol! }).eq('id', data.user!.id)
  if (xatoProfil) redirect(xabarliYol(YOL, { xato: xatoMatni(xatoProfil) }))

  revalidatePath(YOL)
  redirect(xabarliYol(YOL, { ok: `${ism} uchun hisob ochildi — login: ${loginNomi(email)}. Parolni o‘ziga yetkazing — u boshqa ko‘rinmaydi.` }))
}

/** Parolni almashtirish — xodim, ustoz, kim bo'lsa ham (o'zidan boshqa). */
export async function xodimParol(fd: FormData) {
  const men = await talabRol('admin', 'direktor')
  const id = matn(fd.get('id'))
  const parol = String(fd.get('parol') ?? '')
  if (!id) redirect(YOL)
  if (parol.length < 8) redirect(xabarliYol(YOL, { xato: 'Parol kamida 8 belgidan bo‘lsin.' }))
  if (id === men.id) redirect(xabarliYol(YOL, { xato: 'O‘z parolingizni “Profil” sahifasida almashtiring.' }))

  // Kimligini RLS bilan o'qiymiz — faqat xodim ro'yxatidagilar
  const supabase = await createClient()
  const { data: p } = await supabase.from('profiles').select('ism, rol').eq('id', id!).maybeSingle()
  if (!p || !ROLLAR.includes(p.rol as XodimRol)) redirect(xabarliYol(YOL, { xato: 'Xodim topilmadi.' }))

  const { error } = await createAdminClient().auth.admin.updateUserById(id!, { password: parol })
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))

  redirect(xabarliYol(YOL, { ok: `${p!.ism} uchun yangi parol o‘rnatildi. Parolni o‘ziga yetkazing.` }))
}

/** Lavozimni o'zgartirish. Direktor rolini faqat direktor beradi/oladi (0011). */
export async function xodimRol(fd: FormData) {
  await talabRol('admin', 'direktor')
  const id = matn(fd.get('id'))
  const rol = rolOqi(fd)
  if (!id || !rol) redirect(xabarliYol(YOL, { xato: 'Lavozim noto‘g‘ri.' }))

  const supabase = await createClient()
  const { data: p, error } = await supabase.from('profiles').update({ rol: rol! }).eq('id', id!).select('ism').maybeSingle()
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))
  if (!p) redirect(xabarliYol(YOL, { xato: 'Xodim topilmadi.' }))

  // Rol app_metadata da ham (0008) — faqat shu qadam admin kaliti bilan
  const { error: xatoAuth } = await createAdminClient().auth.admin.updateUserById(id!, { app_metadata: { rol } })
  if (xatoAuth) redirect(xabarliYol(YOL, { xato: xatoMatni(xatoAuth) }))

  revalidatePath('/crm', 'layout')
  redirect(xabarliYol(YOL, { ok: `${p!.ism} — endi ${rol}.` }))
}

/** Bloklash / qayta ochish — bloklangan xodim tizimga kira olmaydi. */
export async function xodimHolat(fd: FormData) {
  const men = await talabRol('admin', 'direktor')
  const id = matn(fd.get('id'))
  const holat = fd.get('holat') === 'bloklangan' ? 'bloklangan' : 'faol'
  if (!id) redirect(YOL)
  if (id === men.id) redirect(xabarliYol(YOL, { xato: 'O‘zingizni bloklab bo‘lmaydi.' }))

  const supabase = await createClient()
  const { data: p, error } = await supabase.from('profiles').update({ holat }).eq('id', id!).select('ism').maybeSingle()
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))
  if (!p) redirect(xabarliYol(YOL, { xato: 'Xodim topilmadi.' }))

  revalidatePath(YOL)
  redirect(xabarliYol(YOL, { ok: holat === 'bloklangan' ? `${p!.ism} bloklandi — kira olmaydi.` : `${p!.ism} qayta ochildi.` }))
}

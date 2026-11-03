'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { talabRol } from '@/lib/auth'
import { matn, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { loginEmail, loginNomi, LOGIN_QOIDASI } from '@/lib/login'
import { telefonNormal } from '@/lib/format'
import { farzandQiymati } from '@/lib/farzand'

/**
 * O'QUVCHI VA USTOZ UCHUN HISOB OCHISH.
 *
 * ── NEGA BU YERDA service_role ISHLATILADI ──
 * Auth foydalanuvchisini yaratish faqat admin kaliti bilan mumkin —
 * RLS bilan bo'lmaydi. Shuning uchun qoidaga TOR istisno qilinadi va
 * u shu funksiyada quyidagicha chegaralangan:
 *
 *   1. Avval oddiy (RLS) klient bilan talabRol('admin','direktor') —
 *      ya'ni chaqiruvchining huquqi bazaning o'z qoidalari bilan
 *      tekshiriladi.
 *   2. Kim uchun hisob ochilayotgani ham RLS klienti bilan o'qiladi.
 *   3. service_role FAQAT bitta ish uchun: auth foydalanuvchisini
 *      yaratish yoki parolini almashtirish.
 *   4. Rol app_metadata ga yoziladi (0008): foydalanuvchi o'zi
 *      o'zgartira olmaydi. Direktor roli bu yerdan berilmaydi.
 *   5. Har hisob audit_log ga yozib qo'yiladi — kim kimga ochgani
 *      keyin ham ko'rinadi.
 *
 * Parol admin ko'rib turgan formadan keladi (manzilga tushmaydi,
 * jurnalga ham yozilmaydi) — shuning uchun uni o'quvchiga aytish
 * adminning o'z qo'lida.
 */
export async function hisobOch(fd: FormData) {
  const men = await talabRol('admin', 'direktor')

  const ustozmi = fd.get('turi') === 'ustoz'
  const otaOnami = fd.get('turi') === 'ota_ona'
  // 0102 — probniy kabineti: nishon = lid uuid
  const probniymi = fd.get('turi') === 'probniy'
  const rol: 'ustoz' | 'oquvchi' | 'ota_ona' | 'probniy' = probniymi ? 'probniy' : otaOnami ? 'ota_ona' : ustozmi ? 'ustoz' : 'oquvchi'
  const nishon = matn(fd.get('nishon'))
  const email = loginEmail(fd.get('email'))
  const parol = String(fd.get('parol') ?? '')
  const yol = probniymi ? '/crm/lidlar' : ustozmi ? '/crm/ustozlar' : `/crm/oquvchilar/${nishon}`

  if (!nishon) redirect(xabarliYol(yol, { xato: 'Kim uchun ekani ko‘rsatilmagan.' }))
  if (!email) {
    redirect(xabarliYol(yol, { xato: `Login noto‘g‘ri. ${LOGIN_QOIDASI}` }))
  }
  if (parol.length < 8) {
    redirect(xabarliYol(yol, { xato: 'Parol kamida 8 belgidan bo‘lsin.' }))
  }

  const supabase = await createClient()

  const { data: kim } = probniymi
    ? await supabase.from('leads').select('id, ism, student_id').eq('id', nishon!).is('student_id', null).maybeSingle()
    : ustozmi
      ? await supabase.from('teachers').select('id, ism, profile_id').eq('id', nishon!).maybeSingle()
      : await supabase.from('students').select('id, fish, profile_id').eq('id', nishon!).maybeSingle()

  if (!kim) redirect(xabarliYol(yol, { xato: `${nishon} topilmadi.` }))

  // Ota-ona ismini admin kiritadi (o'quvchining ismi emas)
  const otaOnaIsm = matn(fd.get('ism'))
  if (otaOnami && !otaOnaIsm) redirect(xabarliYol(yol, { xato: 'Ota-ona ismini kiriting.' }))

  const ism = otaOnami
    ? otaOnaIsm!
    : ustozmi || probniymi
      ? (kim as { ism: string }).ism
      : (kim as { fish: string }).fish

  /* ── Faqat shu qadam admin kaliti bilan ── */
  const admin = createAdminClient()

  // Shu login bilan hisob bormi. listUsers sahifalab beradi (bir sahifa
  // 1000 gacha), shuning uchun topilmaguncha yoki tugamaguncha aylanamiz —
  // aks holda 1000-chi foydalanuvchidan keyin "yo'q" deb aldardi.
  let bor: { id: string } | undefined
  for (let sahifa = 1; !bor; sahifa++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: sahifa, perPage: 1000 })
    if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
    bor = data.users.find((u) => u.email?.toLowerCase() === email)
    if (data.users.length < 1000) break
  }
  let userId: string

  // Probniy: band login boshqa odamniki bo'lsa — uning parolini almashtirib yubormaymiz
  if (bor && probniymi) {
    const { data: egasi } = await supabase.from('profiles').select('rol, lead_id').eq('id', bor.id).maybeSingle()
    if (!egasi || egasi.rol !== 'probniy' || egasi.lead_id !== nishon) {
      redirect(xabarliYol(yol, { xato: 'Bu login band — boshqa login tanlang.' }))
    }
  }

  /* 0116 — ota-ona: o'quvchida boshqa ota-ona bo'lsa — yangi hisob ochilmaydi
     (bitta o'quvchi — bitta ota-ona); band login ota-onaniki bo'lmasa — tegilmaydi */
  if (otaOnami) {
    const { data: hozirgi } = await supabase.from('students').select('ota_ona_id').eq('id', nishon!).maybeSingle()
    if (hozirgi?.ota_ona_id && hozirgi.ota_ona_id !== bor?.id) {
      redirect(xabarliYol(yol, { xato: 'Bu o‘quvchiga boshqa ota-ona biriktirilgan. Avval uni uzing yoki “Ota-onalar” bo‘limida mavjud hisobga biriktiring.' }))
    }
    if (bor) {
      const { data: egasi } = await supabase.from('profiles').select('rol').eq('id', bor.id).maybeSingle()
      if (egasi?.rol !== 'ota_ona') redirect(xabarliYol(yol, { xato: 'Bu login band — boshqa login tanlang.' }))
    }
  }

  if (bor) {
    const { error } = await admin.auth.admin.updateUserById(bor.id, {
      password: parol,
      user_metadata: { ism },
      app_metadata: { rol },
    })
    if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
    userId = bor.id
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: email!,
      password: parol,
      email_confirm: true,
      user_metadata: { ism },
      app_metadata: { rol },
    })
    if (error || !data.user) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
    userId = data.user.id
  }

  /* ── Qolgani yana oddiy huquq bilan ── */
  // MUHIM: rolni SHU YERDA aniq yozamiz. handle_new_user triggeri app_metadata
  // dan rol oladi, lekin auth.admin.createUser app_metadata'ni ba'zan qatordan
  // KEYIN yozadi — o'sha payt trigger 'oquvchi' (default) qo'yib yuboradi.
  // Natijada ustoz 'oquvchi' bo'lib qolardi. Shuning uchun profiles.rol ni
  // biz o'zimiz ustun qilib yozamiz.
  // Ota-ona: rol + farzandga bog'lanish (oquvchi_id). Boshqasi: rol.
  const profilYangi = otaOnami ? { ism, rol, oquvchi_id: nishon } : probniymi ? { ism, rol, lead_id: nishon } : { ism, rol }
  const { error: xatoProfil } = await supabase.from('profiles').update(profilYangi).eq('id', userId)
  if (xatoProfil) redirect(xabarliYol(yol, { xato: xatoMatni(xatoProfil) }))

  // 0116 — ota-ona bog'lanishi students.ota_ona_id da (bir ota-onada bir nechta farzand)
  if (otaOnami) {
    const { error: xatoOta } = await supabase.rpc('ota_ona_biriktir', { p_ota_ona: userId, p_student: nishon! })
    if (xatoOta) redirect(xabarliYol(yol, { xato: xatoMatni(xatoOta) }))
  }

  // Ota-ona hisobi o'quvchi/ustoz yozuvini EGALLAMAYDI (u faqat kuzatuvchi).
  const jadval = ustozmi ? 'teachers' : 'students'
  if (!otaOnami && !probniymi) {
    // Bitta hisob bitta odamga: eski bog'lanish uziladi
    await supabase.from(jadval).update({ profile_id: null }).eq('profile_id', userId)
    const { error: xatoBog } = await supabase.from(jadval).update({ profile_id: userId }).eq('id', nishon!)
    if (xatoBog) redirect(xabarliYol(yol, { xato: xatoMatni(xatoBog) }))
  }

  // Iz: audit_log ga faqat server yozadi
  await admin.from('audit_log').insert({
    profile_id: men.id,
    amal: bor ? 'HISOB_PAROL' : 'HISOB_OCHILDI',
    jadval: probniymi ? 'leads' : jadval,
    obyekt_id: nishon!,
    yangi: { email, ism },
  })

  revalidatePath('/crm', 'layout')
  redirect(
    xabarliYol(yol, {
      ok: bor
        ? `${ism} uchun parol almashtirildi (login: ${loginNomi(email)}). Parolni o‘ziga yetkazing.`
        : `${ism} uchun hisob ochildi — login: ${loginNomi(email)}. Parolni o‘ziga yetkazing — u boshqa ko‘rinmaydi.`,
    }),
  )
}

/* ── 0116: Ota-onalar bo'limi ─────────────────────────────────────────
 * O'quvchi yaratilgandek ota-onani ham alohida yaratish va parolini
 * almashtirish. Tartib hisobOch bilan bir xil: huquq — oddiy (RLS) klient
 * bilan; service_role FAQAT auth foydalanuvchisini yaratish / parolini
 * almashtirish uchun; qolgan yozuvlar oddiy klient bilan; audit_log'ga iz.
 */

async function loginBormi(admin: ReturnType<typeof createAdminClient>, email: string, yol: string) {
  for (let sahifa = 1; ; sahifa++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: sahifa, perPage: 1000 })
    if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
    if (data.users.some((u) => u.email?.toLowerCase() === email)) return true
    if (data.users.length < 1000) return false
  }
}

export async function otaOnaYarat(fd: FormData) {
  const men = await talabRol('admin', 'direktor', 'manager')
  const yol = '/crm/ota-onalar/yangi'
  const ism = toliqIsm(fd)
  const tel = matn(fd.get('telefon'))
  const telNorm = tel ? telefonNormal(tel) : null
  const email = loginEmail(fd.get('email'))
  const parol = String(fd.get('parol') ?? '')
  // 0117 — kamida bitta farzand majburiy: o'quvchi yoki sinov darsidagi bola
  const farzand = farzandQiymati(fd.get('farzand'))

  if (!ism) redirect(xabarliYol(yol, { xato: 'Ota-onaning ismi va familiyasini kiriting.' }))
  // Ota-ona telefoni majburiy (Jamshid, 03.11)
  if (!telNorm) redirect(xabarliYol(yol, { xato: 'Telefon raqamini kiriting: 90 123 45 67 yoki +998 90 123 45 67.' }))
  if (!email) redirect(xabarliYol(yol, { xato: `Login noto‘g‘ri. ${LOGIN_QOIDASI}` }))
  if (parol.length < 8) redirect(xabarliYol(yol, { xato: 'Parol kamida 8 belgidan bo‘lsin.' }))

  if (!farzand) redirect(xabarliYol(yol, { xato: 'Farzandni tanlang — ota-ona kamida bitta farzand bilan ochiladi.' }))

  const supabase = await createClient()
  const { data: f } =
    farzand!.turi === 'oquvchi'
      ? await supabase.from('students').select('ota_ona_id').eq('id', farzand!.id).maybeSingle()
      : await supabase.from('leads').select('ota_ona_id').eq('id', farzand!.id).maybeSingle()
  if (!f) redirect(xabarliYol(yol, { xato: 'Tanlangan farzand topilmadi.' }))
  if (f!.ota_ona_id) redirect(xabarliYol(yol, { xato: 'Bu farzandga boshqa ota-ona biriktirilgan — avval uni uzing.' }))

  /* ── Faqat shu qadam admin kaliti bilan ── */
  const admin = createAdminClient()
  if (await loginBormi(admin, email!, yol)) redirect(xabarliYol(yol, { xato: 'Bu login band — boshqa login tanlang.' }))
  const { data, error } = await admin.auth.admin.createUser({
    email: email!,
    password: parol,
    email_confirm: true,
    user_metadata: { ism },
    app_metadata: { rol: 'ota_ona' },
  })
  if (error || !data.user) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  const userId = data.user!.id

  /* ── Qolgani oddiy huquq bilan (rol ustun yoziladi — hisobOch dagi sabab bilan) ── */
  const { error: xatoProfil } = await supabase.from('profiles').update({ ism, rol: 'ota_ona', telefon: telNorm }).eq('id', userId)
  if (xatoProfil) redirect(xabarliYol(yol, { xato: xatoMatni(xatoProfil) }))
  const { error: xatoOta } =
    farzand!.turi === 'oquvchi'
      ? await supabase.rpc('ota_ona_biriktir', { p_ota_ona: userId, p_student: farzand!.id })
      : await supabase.rpc('ota_ona_lid_biriktir', { p_ota_ona: userId, p_lead: farzand!.id })
  if (xatoOta) redirect(xabarliYol(`/crm/ota-onalar/${userId}`, { xato: xatoMatni(xatoOta) }))

  await admin.from('audit_log').insert({
    profile_id: men.id,
    amal: 'HISOB_OCHILDI',
    jadval: 'profiles',
    obyekt_id: userId,
    yangi: { email, ism, rol: 'ota_ona', farzand },
  })

  revalidatePath('/crm', 'layout')
  redirect(
    xabarliYol(`/crm/ota-onalar/${userId}`, {
      ok: `${ism} uchun hisob ochildi — login: ${loginNomi(email)}. Parolni o‘ziga yetkazing — u boshqa ko‘rinmaydi.`,
    }),
  )
}

/** Ism + familiya (Vertix shabloni: ikki maydon) → profiles.ism "Ism Familiya" */
function toliqIsm(fd: FormData): string | null {
  const i = matn(fd.get('ism'))?.replace(/\s+/g, ' ')
  const f = matn(fd.get('familiya'))?.replace(/\s+/g, ' ')
  const t = [i, f].filter(Boolean).join(' ').slice(0, 80)
  return t.length >= 3 ? t : null
}

/**
 * Ota-onani tahrirlash (Vertix shabloni): ism, familiya, telefon, login va
 * xavfsizlik (parol avto/qo'lda). Faqat ota-ona hisobi; login band bo'lsa —
 * boshqa hisobga tegilmaydi. service_role faqat auth email/parol uchun.
 */
export async function otaOnaTahrir(fd: FormData) {
  const men = await talabRol('admin', 'direktor', 'manager')
  const id = matn(fd.get('ota_ona'))
  const yol = id ? `/crm/ota-onalar/${id}` : '/crm/ota-onalar'
  if (!id) redirect(xabarliYol('/crm/ota-onalar', { xato: 'Ota-ona topilmadi.' }))

  const ism = toliqIsm(fd)
  const tel = matn(fd.get('telefon'))
  const telNorm = tel ? telefonNormal(tel) : null
  const email = loginEmail(fd.get('email'))
  const parolKerak = fd.get('parol_turi') === 'avto' || fd.get('parol_turi') === 'qolda'
  const parol = String(fd.get('parol') ?? '')

  if (!ism) redirect(xabarliYol(yol, { xato: 'Ism va familiyani kiriting.' }))
  if (!telNorm) redirect(xabarliYol(yol, { xato: 'Telefon raqamini kiriting: 90 123 45 67.' }))
  if (!email) redirect(xabarliYol(yol, { xato: `Login noto‘g‘ri. ${LOGIN_QOIDASI}` }))
  if (parolKerak && parol.length < 8) redirect(xabarliYol(yol, { xato: 'Parol kamida 8 belgidan bo‘lsin.' }))

  const supabase = await createClient()
  const { data: o } = await supabase.from('profiles').select('id, email, rol').eq('id', id!).maybeSingle()
  if (!o || o.rol !== 'ota_ona') redirect(xabarliYol(yol, { xato: 'Bu ota-ona hisobi emas.' }))

  const loginOzgardi = (o!.email ?? '').toLowerCase() !== email
  const admin = createAdminClient()
  if (loginOzgardi && (await loginBormi(admin, email!, yol))) {
    redirect(xabarliYol(yol, { xato: 'Bu login band — boshqa login tanlang.' }))
  }

  /* ── Faqat shu qadam admin kaliti bilan: login va parol (auth) ── */
  if (loginOzgardi || parolKerak) {
    const { error } = await admin.auth.admin.updateUserById(id!, {
      ...(loginOzgardi ? { email: email!, email_confirm: true } : {}),
      ...(parolKerak ? { password: parol } : {}),
    })
    if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  }

  /* ── Qolgani oddiy huquq bilan ── */
  const { error: xatoProfil } = await supabase
    .from('profiles')
    .update({ ism: ism!, telefon: telNorm, ...(loginOzgardi ? { email: email! } : {}) })
    .eq('id', id!)
  if (xatoProfil) redirect(xabarliYol(yol, { xato: xatoMatni(xatoProfil) }))

  await admin.from('audit_log').insert({
    profile_id: men.id,
    amal: parolKerak ? 'HISOB_PAROL' : 'HISOB_TAHRIR',
    jadval: 'profiles',
    obyekt_id: id!,
    eski: { email: o!.email },
    yangi: { email, ism, telefon: telNorm, parol: parolKerak },
  })

  revalidatePath('/crm', 'layout')
  redirect(
    xabarliYol(yol, {
      ok: `${ism} saqlandi${loginOzgardi ? ` · yangi login: ${loginNomi(email)}` : ''}${parolKerak ? ' · parol yangilandi — o‘ziga yetkazing' : ''}.`,
    }),
  )
}

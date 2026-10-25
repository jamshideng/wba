'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { talabRol } from '@/lib/auth'
import { matn, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { loginEmail, loginNomi, LOGIN_QOIDASI } from '@/lib/login'

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

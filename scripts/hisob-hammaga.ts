/**
 * Barcha ustoz va o'quvchilarga hisob ochish (bir martalik, qayta yurgizsa
 * parolni yangilaydi — ikkilanmaydi).
 *
 *   Ustoz    login = ismi (lotin slug, unique)      · rol = ustoz
 *   O'quvchi login = 10000 + ID raqami (S020 → 10020) · rol = oquvchi
 *            (tartib raqami emas: o'quvchi qo'shilsa/o'chsa boshqalarniki surilmaydi)
 *            Arxivdagilarga (holat = ketgan) hisob ochilmaydi.
 *
 * Parol — tasodifiy. Natija ikki CSV faylga (Excel ochadi) yoziladi:
 *   .secrets/ustozlar-hisob.csv · .secrets/oquvchilar-hisob.csv
 * Kalitlar git'ga tushmaydi (.secrets/ .gitignore'da).
 *
 * Ishga tushirish:  npx tsx scripts/hisob-hammaga.ts
 */
import { config } from 'dotenv'
import { randomInt } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) throw new Error('Supabase kalitlari topilmadi (.env.local)')

const DOMEN = 'wba.uz'

/** Chalkashmaydigan belgilardan tasodifiy parol (0/O/1/l/I yo'q). */
function parolYarat(uzunlik = 8): string {
  const alifbo = 'abcdefghijkmnpqrstuvwxyz23456789'
  let p = ''
  for (let i = 0; i < uzunlik; i++) p += alifbo[randomInt(alifbo.length)]
  return p
}

/** Ism → lotin login slug. Faqat [a-z0-9], o'/g' soddalashadi. */
function slug(ism: string): string {
  return ism
    .toLowerCase()
    .replace(/['‘’`ʻ]/g, '')
    .replace(/[oʻ]|o'/g, 'o')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

/** Ismning honorifiksiz birinchi so'zi (opa/aka/ustoz/domla tashlanadi). */
function ustozLogin(ism: string): string {
  const honor = new Set(['opa', 'aka', 'ustoz', 'domla', 'muallim'])
  const sozlar = ism.split(/\s+/).map(slug).filter((s) => s && !honor.has(s))
  let login = sozlar[0] ?? ''
  // Kamida 3 belgi bo'lsin (login qoidasi)
  if (login.length < 3 && sozlar[1]) login = (login + sozlar[1]).slice(0, 16)
  return login
}

function csv(qatorlar: string[][]): string {
  const kat = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return '﻿' + qatorlar.map((r) => r.map(kat).join(';')).join('\r\n')
}

type Natija = { ism: string; login: string; parol: string; id: string }

async function main() {
  const db = createClient(URL!, KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

  // Mavjud auth foydalanuvchilar — email bo'yicha (qayta yurgizishda yangilash uchun)
  const bor = new Map<string, string>()
  for (let sahifa = 1; ; sahifa++) {
    const { data, error } = await db.auth.admin.listUsers({ page: sahifa, perPage: 1000 })
    if (error) throw error
    data.users.forEach((u) => u.email && bor.set(u.email.toLowerCase(), u.id))
    if (data.users.length < 1000) break
  }

  async function hisobOch(email: string, parol: string, ism: string, rol: 'ustoz' | 'oquvchi'): Promise<string> {
    const mavjud = bor.get(email)
    if (mavjud) {
      const { error } = await db.auth.admin.updateUserById(mavjud, {
        password: parol,
        user_metadata: { ism },
        app_metadata: { rol },
      })
      if (error) throw new Error(`${email}: ${error.message}`)
      return mavjud
    }
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: parol,
      email_confirm: true,
      user_metadata: { ism },
      app_metadata: { rol },
    })
    if (error || !data.user) throw new Error(`${email}: ${error?.message}`)
    return data.user.id
  }

  // ── Ustozlar ──
  const { data: ustozlar, error: e1 } = await db.from('teachers').select('id, ism').order('id')
  if (e1) throw e1
  const olingan = new Set<string>()
  const uNat: Natija[] = []
  for (const u of ustozlar ?? []) {
    let login = ustozLogin(u.ism) || `ustoz${u.id.toLowerCase()}`
    const baza = login
    let n = 2
    while (olingan.has(login)) login = `${baza}${n++}`
    olingan.add(login)
    const parol = parolYarat()
    const email = `${login}@${DOMEN}`
    const uid = await hisobOch(email, parol, u.ism, 'ustoz')
    await db.from('teachers').update({ profile_id: null }).eq('profile_id', uid)
    await db.from('teachers').update({ profile_id: uid }).eq('id', u.id)
    // rol'ni aniq yozamiz: handle_new_user triggeri admin.createUser app_metadata'ni
    // kech yozgani uchun 'oquvchi' qo'yib yuborishi mumkin (ustoz yo'qoladi).
    await db.from('profiles').update({ ism: u.ism, rol: 'ustoz' }).eq('id', uid)
    uNat.push({ ism: u.ism, login, parol, id: u.id })
    console.log(`ustoz  ${u.id}  ${login}  ${u.ism}`)
  }

  // ── O'quvchilar ── login = 10000 + ID raqami
  const { data: oquvchilar, error: e2 } = await db.from('students').select('id, fish').neq('holat', 'ketgan').order('id')
  if (e2) throw e2
  const oNat: Natija[] = []
  for (const o of oquvchilar ?? []) {
    const n = Number(o.id.replace(/\D/g, ''))
    if (!n) throw new Error(`O'quvchi ID'sidan raqam chiqmadi: ${o.id}`)
    const login = String(10000 + n)
    const parol = parolYarat()
    const email = `${login}@${DOMEN}`
    const uid = await hisobOch(email, parol, o.fish, 'oquvchi')
    await db.from('students').update({ profile_id: null }).eq('profile_id', uid)
    await db.from('students').update({ profile_id: uid }).eq('id', o.id)
    await db.from('profiles').update({ ism: o.fish, rol: 'oquvchi' }).eq('id', uid)
    oNat.push({ ism: o.fish, login, parol, id: o.id })
  }
  console.log(`o'quvchi: ${oNat.length} ta hisob`)

  mkdirSync('.secrets', { recursive: true })
  writeFileSync(
    '.secrets/ustozlar-hisob.csv',
    csv([['O‘qituvchi', 'Login', 'Parol', 'ID'], ...uNat.map((r) => [r.ism, r.login, r.parol, r.id])]),
  )
  writeFileSync(
    '.secrets/oquvchilar-hisob.csv',
    csv([['O‘quvchi', 'Login', 'Parol', 'ID'], ...oNat.map((r) => [r.ism, r.login, r.parol, r.id])]),
  )
  console.log(`\nYozildi: .secrets/ustozlar-hisob.csv (${uNat.length}) · .secrets/oquvchilar-hisob.csv (${oNat.length})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

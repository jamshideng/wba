/**
 * Faqat LOGINI YO'Q o'quvchilarga hisob ochadi (Sheets'dan yangi kelganlar).
 *
 * hisob-hammaga.ts dan farqi: mavjud hisoblarga TEGMAYDI — hech kimning
 * paroli qaytadan o'rnatilmaydi (o'z parolini almashtirganlar buzilmaydi).
 * Login = 10000 + ID raqami. Shu login bilan begona (bog'lanmagan) hisob
 * bor bo'lsa — o'tkazib yuboriladi va aytiladi, qo'lda hal qilinadi.
 *
 * Natija CSV: .secrets/oquvchilar-yangi-<sana>.csv (git'ga tushmaydi).
 * Ishga tushirish:  npx tsx scripts/hisob-yangilar.ts
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

function csv(qatorlar: string[][]): string {
  const kat = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return '﻿' + qatorlar.map((r) => r.map(kat).join(';')).join('\r\n')
}

async function main() {
  const db = createClient(URL!, KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: oquvchilar, error } = await db
    .from('students').select('id, fish').neq('holat', 'ketgan').is('profile_id', null).order('id')
  if (error) throw error
  if (!oquvchilar?.length) return console.log('Logini yo‘q o‘quvchi yo‘q.')

  const bor = new Set<string>()
  for (let page = 1; ; page++) {
    const { data, error: e } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (e) throw e
    data.users.forEach((u) => u.email && bor.add(u.email.toLowerCase()))
    if (data.users.length < 1000) break
  }

  const natija: string[][] = []
  for (const o of oquvchilar) {
    const n = Number(o.id.replace(/\D/g, ''))
    if (!n) { console.log(`o'tkazildi ${o.id}: ID'dan raqam chiqmadi`); continue }
    const login = String(10000 + n)
    const email = `${login}@${DOMEN}`
    if (bor.has(email)) { console.log(`o'tkazildi ${o.id}: ${login} hisobi bor, lekin bog'lanmagan — qo'lda tekshiring`); continue }
    const parol = parolYarat()
    const { data, error: e } = await db.auth.admin.createUser({
      email, password: parol, email_confirm: true, user_metadata: { ism: o.fish }, app_metadata: { rol: 'oquvchi' },
    })
    if (e || !data.user) throw new Error(`${email}: ${e?.message}`)
    await db.from('students').update({ profile_id: data.user.id }).eq('id', o.id)
    await db.from('profiles').update({ ism: o.fish, rol: 'oquvchi' }).eq('id', data.user.id)
    natija.push([o.fish, login, parol, o.id])
    console.log(`ochildi ${o.id} ${login}`)
  }

  mkdirSync('.secrets', { recursive: true })
  const fayl = `.secrets/oquvchilar-yangi-${new Date().toISOString().slice(0, 10)}.csv`
  writeFileSync(fayl, csv([['O‘quvchi', 'Login', 'Parol', 'ID'], ...natija]))
  console.log(`\n${natija.length} ta hisob · ${fayl}`)
}

main().catch((e) => { console.error(e); process.exit(1) })

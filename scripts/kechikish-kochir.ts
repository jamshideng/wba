/**
 * Ustozlar kechikishi: Sheets "Ustoz kechikishlari" → baza (0060).
 *
 *   npx tsx scripts/kechikish-kochir.ts            — REJA: faqat ko'rsatadi
 *   npx tsx scripts/kechikish-kochir.ts --tasdiq   — yozadi
 *
 * Ko'zgu: Sheets'dagi har qator (UK0001…) bazada bitta yozuv. Sheets'da
 * o'zgarsa — yangilanadi, o'chirilsa — bazadan ham o'chadi. Xavfsizlik:
 * varaq topilmasa yoki bo'sh bo'lib, bazada yozuv ko'p bo'lsa —
 * hech narsa o'chirilmaydi (Sheets o'qilmay qolgan bo'lishi mumkin).
 *
 * Kunlik ko'chirish (kunlik-kochir.mjs) migrate-from-sheets dan keyin
 * shuni ham chaqiradi.
 */

import { config } from 'dotenv'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { varaqQur } from './lib/sheets'
import { KECHIKISH_VARAQ, kechikishlarniQur, type KechikishQator } from './lib/kechikish'

config({ path: '.env.local' })
const TASDIQ = process.argv.includes('--tasdiq')

async function varaqniOqi(sheetsId: string) {
  const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] })
  const sheets = google.sheets({ version: 'v4', auth: (await auth.getClient()) as never })
  try {
    const j = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetsId,
      range: `'${KECHIKISH_VARAQ}'!A1:I1600`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER',
    })
    return varaqQur(KECHIKISH_VARAQ, (j.data.values ?? []) as unknown[][])
  } catch (e) {
    if (String((e as Error).message).includes('Unable to parse range')) return null // varaq hali yo'q
    throw e
  }
}

const teng = (a: KechikishQator, b: Record<string, unknown>) =>
  a.sana === b.sana && a.group_id === b.group_id && a.teacher_id === b.teacher_id &&
  a.daqiqa === b.daqiqa && a.sabab === b.sabab &&
  (a.kiritilgan ?? null) === (b.kiritilgan ? new Date(String(b.kiritilgan)).toISOString() : null)

async function ishga() {
  const sheetsId = process.env.SHEETS_ID
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!sheetsId || !url || !key) throw new Error('SHEETS_ID yoki Supabase kalitlari topilmadi (.env.local)')

  const v = await varaqniOqi(sheetsId)
  if (!v) {
    console.log(`"${KECHIKISH_VARAQ}" varag'i hali yo'q — Apps Script'da USTOZ_KECHIKISH() ni ishga tushiring. Hech narsa o'zgarmadi.`)
    return
  }
  const { royxat, xatolar } = kechikishlarniQur(v.qatorlar)

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const [{ data: bor, error: e1 }, { data: ustozlar }, { data: guruhlar }] = await Promise.all([
    db.from('ustoz_kechikish').select('id, sheets_id, sana, group_id, teacher_id, daqiqa, sabab, kiritilgan').not('sheets_id', 'is', null),
    db.from('teachers').select('id'),
    db.from('groups').select('id'),
  ])
  if (e1) throw new Error(e1.message)

  // Bazada yo'q ustoz/guruh — yozilmaydi (FK), ogohlantiriladi
  const uSet = new Set((ustozlar ?? []).map((u) => u.id as string))
  const gSet = new Set((guruhlar ?? []).map((g) => g.id as string))
  const yaroqli = royxat.filter((k) => {
    if (!uSet.has(k.teacher_id)) { xatolar.push(`${k.sheets_id}: ustoz ${k.teacher_id} bazada yo'q`); return false }
    if (k.group_id && !gSet.has(k.group_id)) k.group_id = null
    return true
  })

  const bazada = new Map((bor ?? []).map((b) => [b.sheets_id as string, b]))
  const yangi = yaroqli.filter((k) => !bazada.has(k.sheets_id))
  const ozgargan = yaroqli.filter((k) => bazada.has(k.sheets_id) && !teng(k, bazada.get(k.sheets_id)!))
  const sheetsda = new Set(royxat.map((k) => k.sheets_id))
  const ochadigan = [...bazada.keys()].filter((id) => !sheetsda.has(id))

  console.log(`Sheets: ${royxat.length} ta kechikish · bazada: ${bazada.size}`)
  console.log(`  yangi: ${yangi.length} · o'zgargan: ${ozgargan.length} · o'chadigan: ${ochadigan.length}`)
  xatolar.forEach((x) => console.log('  ! ' + x))

  // Sheets bo'sh o'qildi-yu, bazada ko'p yozuv bor — ehtiyot
  if (royxat.length === 0 && bazada.size > 3) {
    console.log("Varaq bo'sh o'qildi, bazada esa yozuvlar bor — o'chirish TO'XTATILDI.")
    ochadigan.length = 0
  }

  if (!TASDIQ) {
    console.log('\nREJA — hech narsa yozilmadi. Yozish uchun: --tasdiq')
    return
  }

  const yoz = [...yangi, ...ozgargan]
  if (yoz.length) {
    const { error } = await db.from('ustoz_kechikish').upsert(yoz, { onConflict: 'sheets_id' })
    if (error) throw new Error(`yozish: ${error.message}`)
  }
  if (ochadigan.length) {
    const { error } = await db.from('ustoz_kechikish').delete().in('sheets_id', ochadigan)
    if (error) throw new Error(`o'chirish: ${error.message}`)
  }
  console.log(`Yozildi: ${yoz.length} · o'chirildi: ${ochadigan.length}`)
}

ishga().catch((e) => {
  console.error('XATO:', e instanceof Error ? e.message : e)
  process.exit(1)
})

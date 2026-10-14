// Sheets ↔ wbalc.uz (prod) ikki tomonlama sinxron — Windows Task Scheduler "WBA-Kochir-*" ishga tushiradi.
// Eski kunlik-kochir.mjs o'rniga (14.10): sayt endi Sheets'ga tenglashtirilmaydi —
// kim o'zgartirgan bo'lsa o'shaniki yoziladi (scripts/sinxron.ts). Ziddiyat va
// "qo'lda" qilinadigan ishlar Jamshidga Telegram'da keladi (ro'yxat o'zgargandagina).
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const JAMSHID = '1380653599'
const env = { ...process.env }
for (const f of ['.secrets/bulut.env', '.env.local']) {
  for (const q of readFileSync(join(ROOT, f), 'utf8').split(/\r?\n/)) {
    const m = q.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

mkdirSync(join(ROOT, 'logs'), { recursive: true })
const vaqt = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tashkent' })
const LOG = join(ROOT, 'logs', `sinxron-${vaqt.slice(0, 10)}.log`)
const log = (m) => appendFileSync(LOG, m + '\n')

function yurgiz(skript, args, daqiqa) {
  const r = spawnSync('npx', ['tsx', skript, ...args], {
    cwd: ROOT, env, encoding: 'utf8', shell: true, timeout: daqiqa * 60 * 1000,
  })
  const out = (r.stdout ?? '') + (r.stderr ?? '')
  log(`\n===== ${vaqt} ${skript} ${args.join(' ')} (kod ${r.status}) =====\n${out}`)
  return { kod: r.status, out }
}

async function xabar(matn) {
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: JAMSHID, text: matn.slice(0, 4000) }),
    })
  } catch (e) { log('telegram xato: ' + e) }
}

/* Ustozlar kechikishi — mustaqil (06.10), xato bersa faqat xabar */
if (existsSync(join(ROOT, 'scripts', 'kechikish-kochir.ts'))) {
  const k = yurgiz('scripts/kechikish-kochir.ts', ['--tasdiq'], 5)
  if (k.kod !== 0) await xabar(`⚠️ Ustoz kechikishlari ko'chirilmadi (${vaqt}). Log: ${LOG}`)
}

const s = yurgiz('scripts/sinxron.ts', ['--tasdiq'], 15)
const natija = JSON.parse(s.out.match(/^NATIJA (.+)$/m)?.[1] ?? 'null')

if (s.kod === 2) {
  const sabab = s.out.split(/\r?\n/).filter((q) => q.trim().startsWith('✗') && !q.includes('ZIDDIYAT')).join('\n')
  await xabar(`⚠️ Sinxron (${vaqt}) YOZILMADI — to'xtatuvchi muammo:\n${sabab}\nLog: ${LOG}`)
  process.exit(1)
}
if (s.kod !== 0 || !natija) {
  const x = s.out.match(/XATO: (.+)/)?.[1] ?? `kod ${s.kod}`
  await xabar(`❌ Sinxron (${vaqt}) xato bilan tugadi: ${x}\nLog: ${LOG}`)
  process.exit(1)
}

/* Hal qilinadigan ishlar: ziddiyat, qo'lda, yo'qolgan — ro'yxat o'zgarsagina yuboriladi */
const ishlar = s.out.split(/\r?\n/).map((q) => q.trim())
  .filter((q) => /^(✗ ZIDDIYAT|✋|\? )/.test(q))
const hash = createHash('sha1').update(ishlar.join('\n')).digest('hex')
const HASH_FAYL = join(ROOT, 'logs', 'sinxron-oxirgi-ishlar.txt')
const eski = existsSync(HASH_FAYL) ? readFileSync(HASH_FAYL, 'utf8').trim() : ''
writeFileSync(HASH_FAYL, hash)

/* Pul — tasdiqlash uchun (eski ko'chirish xabari kabi): to'lovlar soni va Sheets hisobi bilan solishtirish */
const tolovSoni = s.out.match(/To‘lov\s+(\d+) \/ (\d+)/)
const pulQ = s.out.match(/to‘lashi kerak (\d[\d   ]*) \/ Sheets (\d[\d   ]*) · to‘langan (\d[\d   ]*) \/ Sheets (\d[\d   ]*)/)
const belgi = (a, b) => (a.trim() === b.trim() ? '✓' : '✗ FARQ')
const qism = [`✅ Sinxron (${vaqt}): saytga ${natija.saytga}, Sheets'ga ${natija.sheetsga}`]
if (tolovSoni) qism.push(`To'lovlar: ${tolovSoni[2]} ta (Sheets ${tolovSoni[1]})`)
if (pulQ) {
  qism.push(`To'langan: ${pulQ[3].trim()} so'm / Sheets ${pulQ[4].trim()} ${belgi(pulQ[3], pulQ[4])}`)
  qism.push(`To'lashi kerak: ${pulQ[1].trim()} so'm / Sheets ${pulQ[2].trim()} ${belgi(pulQ[1], pulQ[2])}`)
}
if (ishlar.length && hash !== eski) {
  qism.push(`\nHal qilish kerak (${ishlar.length}):\n${ishlar.slice(0, 40).join('\n')}${ishlar.length > 40 ? `\n… yana ${ishlar.length - 40} ta (log)` : ''}`)
} else if (ishlar.length) {
  qism.push(`Hal qilinmagan: ${ishlar.length} ta (ro'yxat o'zgarmagan)`)
}
await xabar(qism.join('\n'))
process.exit(0)

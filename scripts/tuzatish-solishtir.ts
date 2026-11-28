/**
 * 0147 tekshiruvi — migratsiyadan oldin va keyin pul hisobi bir xilmi.
 *
 *   npx tsx scripts/tuzatish-solishtir.ts surat  <DB_URL|prod> <fayl.json>   (prod — supabase CLI, read-only)
 *   npx tsx scripts/tuzatish-solishtir.ts solishtir <oldin.json> <keyin.json>
 *
 * Surat (faqat o'qiydi): har yozilish bo'yicha Σ invoices.summa, Σ invoices.tuzatish,
 * Σ payments, qarz; tuzatishlar soni va summasi; jami. Solishtirish — har qator
 * va jami bir xil bo'lmasa, farqlarni chiqarib, 1 bilan tugaydi.
 *
 * psql orqali (PATH yoki PGBIN). Prod URL faqat argumentda — faylga yozilmaydi.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

type Qator = { eid: string; inv: string; tuz: string; tol: string; qarz: string }
type Surat = {
  vaqt: string
  jami: { inv: string; tuz: string; tol: string; qarz: string; tuzatishlar_soni: number; tuzatishlar_summa: string }
  qatorlar: Qator[]
}

const SQL = `
with inv as (
  select enrollment_id eid, sum(summa) inv, sum(tuzatish) tuz
  from invoices where holat <> 'bekor' group by 1
), tol as (
  select enrollment_id eid, sum(summa) tol
  from payments where not bekor and enrollment_id is not null group by 1
), q as (
  select e.id::text eid,
         coalesce(inv.inv, 0)::text inv, coalesce(inv.tuz, 0)::text tuz, coalesce(tol.tol, 0)::text tol,
         (coalesce(inv.inv, 0) - coalesce(tol.tol, 0))::text qarz
  from enrollments e left join inv on inv.eid = e.id left join tol on tol.eid = e.id
)
select json_build_object(
  'vaqt', now(),
  'jami', json_build_object(
    'inv',  (select coalesce(sum(summa), 0)::text from invoices where holat <> 'bekor'),
    'tuz',  (select coalesce(sum(tuzatish), 0)::text from invoices where holat <> 'bekor'),
    'tol',  (select coalesce(sum(summa), 0)::text from payments where not bekor),
    'qarz', (select (coalesce((select sum(summa) from invoices where holat <> 'bekor'), 0)
                   - coalesce((select sum(summa) from payments where not bekor), 0))::text),
    'tuzatishlar_soni', (select count(*) from tuzatishlar where not bekor),
    'tuzatishlar_summa', (select coalesce(sum(summa), 0)::text from tuzatishlar where not bekor)
  ),
  'qatorlar', (select coalesce(json_agg(q order by q.eid), '[]'::json) from q)
)`

function psql(url: string, sql: string): string {
  const bin = process.env.PGBIN ? join(process.env.PGBIN, 'psql') : 'psql'
  return execFileSync(bin, [url, '-Atq', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', maxBuffer: 1 << 28 })
}

/** Prod (bog'langan loyiha) — supabase CLI orqali, faqat o'qish tranzaksiyasida */
function prodSurat(): Surat {
  // Ko'p qatorli SQL — fayl orqali (Windows buyruq qatori uni buzadi)
  const fayl = join(tmpdir(), `tuzatish-solishtir-${process.pid}.sql`)
  writeFileSync(fayl, `${SQL} as natija;`)
  const chiqish = execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['supabase', 'db', 'query', '--remote', '--read-only', '--output-format', 'json', '--file', fayl],
    { encoding: 'utf8', maxBuffer: 1 << 28, shell: process.platform === 'win32' },
  )
  const j = JSON.parse(chiqish.slice(chiqish.indexOf('{'), chiqish.lastIndexOf('}') + 1)) as { rows: { natija: Surat }[] }
  return j.rows[0].natija
}

function surat(url: string, fayl: string) {
  let s: Surat
  if (url === 'prod') {
    s = prodSurat()
  } else {
    // json_agg qatorlarni yangi satr bilan ajratadi — butun chiqishdan { … } olinadi
    const chiqish = psql(url, `begin read only; ${SQL}; commit;`)
    s = JSON.parse(chiqish.slice(chiqish.indexOf('{'), chiqish.lastIndexOf('}') + 1)) as Surat
  }
  writeFileSync(fayl, JSON.stringify(s, null, 1))
  console.log(`Surat: ${s.qatorlar.length} yozilish · hisob-faktura ${s.jami.inv} · tuzatish ${s.jami.tuz} · to'lov ${s.jami.tol} · qarz ${s.jami.qarz} · tuzatishlar ${s.jami.tuzatishlar_soni} ta / ${s.jami.tuzatishlar_summa}`)
}

function solishtir(a: string, b: string) {
  const x = JSON.parse(readFileSync(a, 'utf8')) as Surat
  const y = JSON.parse(readFileSync(b, 'utf8')) as Surat
  const farq: string[] = []
  for (const k of Object.keys(x.jami) as (keyof Surat['jami'])[]) {
    if (Number(x.jami[k]) !== Number(y.jami[k])) farq.push(`JAMI ${k}: ${x.jami[k]} → ${y.jami[k]}`)
  }
  const ym = new Map(y.qatorlar.map((q) => [q.eid, q]))
  for (const q of x.qatorlar) {
    const r = ym.get(q.eid)
    if (!r) { farq.push(`${q.eid}: keyingi suratda yo'q`); continue }
    for (const k of ['inv', 'tuz', 'tol', 'qarz'] as const) {
      if (Number(q[k]) !== Number(r[k])) farq.push(`${q.eid} ${k}: ${q[k]} → ${r[k]}`)
    }
  }
  if (y.qatorlar.length !== x.qatorlar.length) farq.push(`yozilishlar soni: ${x.qatorlar.length} → ${y.qatorlar.length}`)

  if (farq.length) {
    console.error(`FARQ BOR (${farq.length}):\n` + farq.slice(0, 50).join('\n'))
    process.exit(1)
  }
  console.log(`BIR XIL: ${x.qatorlar.length} yozilish, jami qarz ${x.jami.qarz}, hisob-faktura ${x.jami.inv}, tuzatish ${x.jami.tuz}, tuzatishlar ${x.jami.tuzatishlar_soni} ta.`)
}

const [buyruq, p1, p2] = process.argv.slice(2)
if (buyruq === 'surat' && p1 && p2) surat(p1, p2)
else if (buyruq === 'solishtir' && p1 && p2) solishtir(p1, p2)
else {
  console.error('Ishlatish: surat <DB_URL> <fayl.json> | solishtir <oldin.json> <keyin.json>')
  process.exit(2)
}

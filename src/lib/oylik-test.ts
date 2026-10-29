/**
 * Oylik test (0104) — umumiy turlar va kichik yordamchilar.
 * Foiz bazada hisoblanadi (oylik_natija_foiz triggeri); bu yerda faqat
 * ko'rsatish va formadan o'qish.
 */

export type OylikTestTuri = 'foiz' | 'ball' | 'bolimlar' | 'ielts'

export type OylikBolim = { nom: string; maks: number }

export type OylikTest = {
  id: string
  group_id: string
  davr: string
  sana: string | null
  turi: OylikTestTuri
  maks: number | null
  bolimlar: OylikBolim[]
  izoh: string | null
}

export type OylikNatija = {
  id: string
  test_id: string
  davr: string
  sana: string | null
  turi: OylikTestTuri
  maks: number | null
  bolimlar: OylikBolim[]
  group_id: string
  guruh: string
  fan: string | null
  ustoz: string | null
  student_id: string
  fish: string
  keldi: boolean
  ball: number | null
  bolim_ballar: (number | null)[] | null
  foiz: number | null
  izoh: string | null
  elon_qilingan: boolean
  elon_vaqti: string | null
  orin: number | null
}

export const TUR_NOMI: Record<OylikTestTuri, string> = {
  foiz: 'Foizda',
  ball: 'Ball (34/40 kabi)',
  bolimlar: 'Bo‘limlar (Grammar %, Writing /9…)',
  ielts: 'IELTS (4 qism + Overall)',
}

/** Bo'lim balli o'z shkalasida: maks 100 — foiz ("70%"), boshqasi — "7/9" */
function bolimQiymati(ball: number, maks: number): string {
  return maks === 100 ? `${son(ball)}%` : `${son(ball)}/${son(maks)}`
}

/** IELTS band doim bir xonali kasr bilan: 7 → "7.0" */
export function band(n: number | string): string {
  return Number(n).toFixed(1)
}

/** Formadagi "Reading — 40" qatorlarini bo'limlarga aylantiradi. Xato bo'lsa — matn. */
export function bolimlarniOqi(nomlar: string[], makslar: string[]): OylikBolim[] | string {
  const natija: OylikBolim[] = []
  nomlar.forEach((n, i) => {
    const nom = n.trim()
    const maksXom = (makslar[i] ?? '').trim().replace(',', '.')
    if (!nom && !maksXom) return
    const maks = Number(maksXom)
    if (!nom) return
    if (!maksXom || !Number.isFinite(maks) || maks <= 0) {
      natija.push({ nom, maks: NaN })
      return
    }
    natija.push({ nom: nom.slice(0, 40), maks })
  })
  const xato = natija.find((b) => Number.isNaN(b.maks))
  if (xato) return `“${xato.nom}” bo‘limiga maksimal ball yozing.`
  if (natija.length === 0) return 'Kamida bitta bo‘lim qo‘shing.'
  if (natija.length > 10) return 'Ko‘pi bilan 10 ta bo‘lim.'
  return natija
}

/** Ball maydoni: bo'sh — null, vergul ham qabul qilinadi. */
export function ballOqi(v: FormDataEntryValue | null | undefined): number | null | 'xato' {
  const s = typeof v === 'string' ? v.trim().replace(',', '.') : ''
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : 'xato'
}

/** Natija ko'rinishi: "34 / 40", "85%", "Grammar 70% · Writing 7/9 · Speaking 3/9",
    IELTS: "L 7.0 · R 6.5 · W 6.0 · S 7.5 · Overall 7.0" */
export function natijaMatni(n: Pick<OylikNatija, 'turi' | 'maks' | 'bolimlar' | 'ball' | 'bolim_ballar' | 'keldi'>): string {
  if (!n.keldi) return 'Kelmadi'
  if (n.turi === 'foiz') return n.ball == null ? '—' : `${son(n.ball)}%`
  if (n.turi === 'ball') return n.ball == null ? '—' : `${son(n.ball)} / ${son(n.maks ?? 0)}`
  if (!n.bolim_ballar?.length) return '—'
  if (n.turi === 'ielts') {
    const q = n.bolimlar.map((b, i) => `${b.nom[0]} ${n.bolim_ballar?.[i] != null ? band(n.bolim_ballar[i]) : '—'}`).join(' · ')
    return n.ball != null ? `${q} · Overall ${band(n.ball)}` : q
  }
  return n.bolimlar
    .map((b, i) => (n.bolim_ballar?.[i] != null ? `${b.nom} ${bolimQiymati(Number(n.bolim_ballar[i]), b.maks)}` : null))
    .filter(Boolean)
    .join(' · ')
}

export function son(n: number | string): string {
  const x = Number(n)
  return Number.isInteger(x) ? String(x) : x.toFixed(1).replace(/\.0$/, '')
}

/** Asosiy ko'rsatkich: IELTS — Overall band ("7.0"), qolganlari — foiz ("85%") */
export function asosiy(n: { turi: OylikTestTuri; ball: number | null; foiz: number | null }): string {
  if (n.turi === 'ielts') return n.ball != null ? band(n.ball) : '—'
  return n.foiz != null ? `${son(n.foiz)}%` : '—'
}

/** Foiz bo'yicha rang: 85+ yashil, 60–84 sariq, <60 qizil */
export function foizTon(foiz: number | null): 'ok' | 'accent' | 'brand' | 'jim' {
  if (foiz == null) return 'jim'
  if (foiz >= 85) return 'ok'
  if (foiz >= 60) return 'accent'
  return 'brand'
}

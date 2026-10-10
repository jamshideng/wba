/**
 * Saytdagi arizaning qo'shimcha ma'lumoti (test natijasi, qulay kun/vaqt).
 * `leads` jadvalida alohida ustun yo'q — izohga belgili qatorlar bilan
 * yoziladi, CRM kartasi esa shu qatorlarni ajratib belgi (badge) qilib ko'rsatadi.
 */

const TEST_BOSHI = 'Test: '
const VAQT_BOSHI = 'Qulay vaqt: '

export type ArizaTest = { fan: string; togri: number; jami: number; foiz: number; daraja: string }

export function testQatori(t: ArizaTest): string {
  return `${TEST_BOSHI}${t.fan} · ${t.togri}/${t.jami} (${t.foiz}%) · ${t.daraja}`
}

export function arizaIzohi(q: {
  yonalish?: string
  test?: ArizaTest
  qulay?: string
  izoh?: string
}): string | null {
  const qatorlar = [
    q.yonalish && `Yo‘nalish: ${q.yonalish}`,
    q.test && testQatori(q.test),
    q.qulay && `${VAQT_BOSHI}${q.qulay}`,
    q.izoh,
  ].filter(Boolean)
  return qatorlar.length ? qatorlar.join('\n') : null
}

/** Izohdan test va vaqt qatorlarini ajratadi; qolgani — oddiy izoh. */
export function izohniAjrat(izoh: string | null): {
  test: { matn: string; foiz: number | null } | null
  vaqt: string | null
  qolgan: string
} {
  let test: { matn: string; foiz: number | null } | null = null
  let vaqt: string | null = null
  const qolgan: string[] = []
  for (const q of (izoh ?? '').split('\n')) {
    if (!test && q.startsWith(TEST_BOSHI)) {
      const matn = q.slice(TEST_BOSHI.length).trim()
      const m = matn.match(/\((\d{1,3})%\)/)
      test = { matn, foiz: m ? Number(m[1]) : null }
    } else if (!vaqt && q.startsWith(VAQT_BOSHI)) {
      vaqt = q.slice(VAQT_BOSHI.length).trim()
    } else {
      qolgan.push(q)
    }
  }
  return { test, vaqt, qolgan: qolgan.join('\n').trim() }
}

/**
 * Qidiruv matnini tahlil qilish — butun loyihada bir xil qoida.
 *
 *   S01, s012       — ID boshi bo'yicha (S012%)
 *   90 123, +99890… — telefon raqamlari bo'lagi (kamida 3 raqam)
 *   ma, o'g         — ism bo'lagi, katta-kichik harf farqsiz
 *
 * Harfma-harf yozilganda natija darhol torayadi: "m" → "ma" → "mad".
 * O'zbekcha tutuq belgisi (' ‘ ’ ʻ `) har xil yozilgani uchun istalgan
 * bitta belgi deb qidiriladi: "o'g" → "O‘g'il" ham topiladi.
 */
export type QidiruvTuri =
  | { turi: 'id'; naqsh: string }
  | { turi: 'tel'; naqsh: string }
  | { turi: 'ism'; naqsh: string }

export function qidiruvTuri(xom: string | null | undefined): QidiruvTuri | null {
  // PostgREST filtrini buzadigan va LIKE naqsh belgilarini olib tashlaymiz
  const q = String(xom ?? '')
    .replace(/[%_\\,()"*:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  if (!q) return null

  if (/^s\d+$/i.test(q)) return { turi: 'id', naqsh: `${q.toUpperCase()}%` }

  const raqam = q.replace(/\D/g, '')
  if (/^[\d\s+()-]+$/.test(q) && raqam.length >= 3) return { turi: 'tel', naqsh: `%${raqam}%` }

  return { turi: 'ism', naqsh: `%${q.replace(/['‘’ʻʼ`]/g, '_')}%` }
}

/** Telefon ustunlari bo'yicha `.or()` filtri */
export function telefonFiltri(naqsh: string, ustunlar = ['ota_tel', 'ona_tel', 'shaxsiy_tel']): string {
  return ustunlar.map((u) => `${u}.ilike.${naqsh}`).join(',')
}

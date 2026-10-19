// Guruhlar va Davomat sahifalaridagi guruh filtri — manzil (?q=&fan=&ustoz=&kun=&vaqt=&holat=)
// bo'yicha ro'yxatni serverda saralaydi. Guruhlar soni kichik — bazaga alohida so'rov shart emas.

export type GuruhSorov = {
  q?: string
  fan?: string
  ustoz?: string
  kun?: string
  vaqt?: string
  holat?: string
}

export type FiltrGuruh = {
  id: string
  nom: string
  subject_id?: string | null
  teacher_id?: string | null
  boshlanish?: string | null
  kunlar?: number[] | null
  holat?: string
  teachers?: { ism: string } | null
}

/** "o‘", "o'", "oʻ" — bitta ko'rinishga; katta-kichik harf farqsiz */
const tekis = (s: string) => s.toLowerCase().replace(/[‘’ʻʼ`']/g, "'").replace(/\s+/g, ' ').trim()

export const kunKaliti = (kunlar: readonly number[] | null | undefined) => [...(kunlar ?? [])].sort((a, b) => a - b).join(',')

export function filtrFaolmi(s: GuruhSorov) {
  return Boolean(s.q?.trim() || s.fan || s.ustoz || s.kun || s.vaqt || s.holat)
}

export function guruhMos(g: FiltrGuruh, s: GuruhSorov): boolean {
  const q = tekis(s.q ?? '')
  if (q && !tekis(`${g.nom} ${g.id} ${g.teachers?.ism ?? ''}`).includes(q)) return false
  if (s.fan && g.subject_id !== s.fan) return false
  if (s.ustoz && g.teacher_id !== s.ustoz) return false
  if (s.kun && kunKaliti(g.kunlar) !== s.kun) return false
  if (s.vaqt && (g.boshlanish ?? '').slice(0, 5) !== s.vaqt) return false
  if (s.holat && g.holat !== s.holat) return false
  return true
}

/**
 * Haftalik dars jadvali (LevelUp "Schedule" o'rni, xonalarsiz).
 * Har hafta kuni uchun shu kuni dars bo'ladigan faol guruhlar — vaqt bo'yicha,
 * va bitta ustozning vaqti ustma-ust tushgan darslari (to'qnashuv).
 */

export type JadvalGuruh = {
  id: string
  nom: string
  kunlar: number[] | null
  boshlanish: string | null
  tugash: string | null
  teacher_id: string | null
  ustoz: string | null
  oquvchilar: number
}

export type JadvalKuni = {
  kun: number
  darslar: (JadvalGuruh & { toqnash: string[] })[]
}

/** "14:30:00" → daqiqa. Vaqt yo'q bo'lsa null. */
export function daqiqa(t: string | null): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

function ustmaUst(a: JadvalGuruh, b: JadvalGuruh): boolean {
  const [a1, a2, b1, b2] = [daqiqa(a.boshlanish), daqiqa(a.tugash), daqiqa(b.boshlanish), daqiqa(b.tugash)]
  if (a1 === null || b1 === null) return false
  // Tugash vaqti yo'q bo'lsa — 90 daqiqa deb olinadi (markazdagi odatiy dars)
  return a1 < (b2 ?? b1 + 90) && b1 < (a2 ?? a1 + 90)
}

export function haftalikJadval(guruhlar: JadvalGuruh[]): JadvalKuni[] {
  return [1, 2, 3, 4, 5, 6, 7].map((kun) => {
    const bugungi = guruhlar
      .filter((g) => (g.kunlar ?? []).includes(kun))
      .sort((a, b) => (daqiqa(a.boshlanish) ?? 9999) - (daqiqa(b.boshlanish) ?? 9999) || a.nom.localeCompare(b.nom, 'uz'))
    return {
      kun,
      darslar: bugungi.map((g) => ({
        ...g,
        toqnash: bugungi
          .filter((h) => h.id !== g.id && g.teacher_id && h.teacher_id === g.teacher_id && ustmaUst(g, h))
          .map((h) => h.nom),
      })),
    }
  })
}

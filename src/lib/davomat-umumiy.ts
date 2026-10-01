/**
 * Umumiy davomat (LevelUp "Attendance" bo'limi o'rni) — davr bo'yicha
 * har guruhning foizi va belgilanmay qolgan dars kunlari.
 *
 * Foiz qoidasi oylik eksport va v_attendance_monthly bilan bir xil:
 * kelgan (keldi + kechikdi) / qo'yilgan belgilar. Kelajak kunlar sanalmaydi.
 */

import { haftaKuni } from '@/lib/format'

export type Belgi = 'keldi' | 'kechikdi' | 'sababli' | 'kelmadi'

export type GuruhKirish = { id: string; nom: string; kunlar: number[] | null }
export type YozilishKirish = { group_id: string; boshlandi: string; tugadi: string | null }
export type DarsKirish = { id: string; group_id: string; sana: string }
export type BelgiKirish = { lesson_id: string; holat: Belgi }

export type GuruhQatori = {
  id: string
  nom: string
  darslar: number
  keldi: number
  kelmadi: number
  sababli: number
  belgilar: number
  foiz: number | null
  /** Dars kuni bo'lgan, guruhda o'quvchi bor, lekin bitta ham belgi qo'yilmagan kunlar */
  belgilanmagan: string[]
}

/** dan..gacha oralig'idagi kunlar ("YYYY-MM-DD"), ikkala chet ham kiradi. */
export function kunlarOraligi(dan: string, gacha: string): string[] {
  const natija: string[] = []
  const d = new Date(`${dan}T00:00:00Z`)
  const oxiri = new Date(`${gacha}T00:00:00Z`)
  while (d <= oxiri && natija.length < 400) {
    natija.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return natija
}

export function umumiyDavomat(
  kunlar: string[],
  guruhlar: GuruhKirish[],
  yozilishlar: YozilishKirish[],
  darslar: DarsKirish[],
  belgilar: BelgiKirish[],
): GuruhQatori[] {
  const darsBelgilari = new Map<string, Belgi[]>()
  for (const b of belgilar) {
    const r = darsBelgilari.get(b.lesson_id) ?? []
    r.push(b.holat)
    darsBelgilari.set(b.lesson_id, r)
  }
  const kunDarsi = new Map(darslar.map((d) => [`${d.group_id}|${d.sana}`, d.id]))

  return guruhlar
    .map((g) => {
      const q: GuruhQatori = { id: g.id, nom: g.nom, darslar: 0, keldi: 0, kelmadi: 0, sababli: 0, belgilar: 0, foiz: null, belgilanmagan: [] }
      const yz = yozilishlar.filter((y) => y.group_id === g.id)
      for (const kun of kunlar) {
        const dars = kunDarsi.get(`${g.id}|${kun}`)
        const b = dars ? darsBelgilari.get(dars) ?? [] : []
        if (b.length) {
          q.darslar += 1
          for (const h of b) {
            q.belgilar += 1
            if (h === 'keldi' || h === 'kechikdi') q.keldi += 1
            else if (h === 'sababli') q.sababli += 1
            else q.kelmadi += 1
          }
          continue
        }
        const darsKuni = (g.kunlar ?? []).includes(haftaKuni(kun))
        const oquvchiBor = yz.some((y) => y.boshlandi <= kun && (!y.tugadi || y.tugadi >= kun))
        if (darsKuni && oquvchiBor) q.belgilanmagan.push(kun)
      }
      q.foiz = q.belgilar ? Math.round((q.keldi * 100) / q.belgilar) : null
      return q
    })
    .sort((a, b) => (a.foiz ?? 101) - (b.foiz ?? 101) || a.nom.localeCompare(b.nom, 'uz'))
}

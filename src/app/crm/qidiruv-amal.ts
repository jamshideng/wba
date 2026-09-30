'use server'

import { createClient } from '@/lib/supabase/server'
import { getProfile, staffmi } from '@/lib/auth'
import { qidiruvTuri, telefonFiltri } from '@/lib/qidiruv'

export type TopilganOquvchi = { id: string; fish: string; tel: string | null; holat: string }

/**
 * Tezkor qidiruv (panel tepasidagi maydon) — yozish bilan 8 ta mos
 * o'quvchi. Faqat xodim; RLS ham cheklaydi.
 */
export async function oquvchiTop(q: string): Promise<TopilganOquvchi[]> {
  const profil = await getProfile()
  if (!profil || !staffmi(profil.rol)) return []

  const qt = qidiruvTuri(q)
  if (!qt) return []

  const supabase = await createClient()
  let soorov = supabase.from('students').select('id, fish, holat, shaxsiy_tel, ota_tel, ona_tel')
  if (qt.turi === 'id') soorov = soorov.ilike('id', qt.naqsh)
  else if (qt.turi === 'tel') soorov = soorov.or(telefonFiltri(qt.naqsh))
  else soorov = soorov.ilike('fish', qt.naqsh)

  const { data } = await soorov.order('holat').order('fish').limit(8)
  return (data ?? []).map((o) => ({
    id: o.id,
    fish: o.fish,
    holat: o.holat,
    tel: o.shaxsiy_tel ?? o.ota_tel ?? o.ona_tel,
  }))
}

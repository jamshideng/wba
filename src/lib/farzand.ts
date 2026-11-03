import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Ota-onaning farzandlari: o'quvchilar (0116, students.ota_ona_id) va sinov
 * darsidagi bolalar (0117, leads.ota_ona_id). RLS / definer faqat o'zinikini beradi.
 * id: o'quvchi — "S012", sinovdagi — "L-<uuid>" (sahifa manzili ham shu).
 */
export type Farzand = { id: string; fish: string; holat: string; sinov: boolean }

export const SINOV_OLD = 'L-'

export const farzandlarim = cache(async (): Promise<Farzand[]> => {
  const supabase = await createClient()
  const [{ data: st }, { data: lid }] = await Promise.all([
    supabase.from('students').select('id, fish, holat').order('fish'),
    supabase.rpc('ota_ona_lidlarim'),
  ])
  const oquvchilar = ((st ?? []) as { id: string; fish: string; holat: string }[])
    .map((s) => ({ ...s, sinov: false }))
    .sort((a, b) => Number(a.holat === 'ketgan') - Number(b.holat === 'ketgan'))
  const sinovdagilar = ((lid ?? []) as { id: string; ism: string; holat: string }[]).map((l) => ({
    id: `${SINOV_OLD}${l.id}`,
    fish: l.ism,
    holat: l.holat,
    sinov: true,
  }))
  return [...oquvchilar, ...sinovdagilar]
})

/** "S:S012" yoki "L:<uuid>" — forma qiymatidan farzand */
export function farzandQiymati(v: FormDataEntryValue | null): { turi: 'oquvchi'; id: string } | { turi: 'sinov'; id: string } | null {
  const s = String(v ?? '').trim()
  const o = s.match(/^S:(S\d+)$/i)
  if (o) return { turi: 'oquvchi', id: o[1].toUpperCase() }
  const l = s.match(/^L:([0-9a-f-]{36})$/i)
  if (l) return { turi: 'sinov', id: l[1].toLowerCase() }
  return null
}

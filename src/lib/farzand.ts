import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/** Ota-onaning farzandlari (0116, students.ota_ona_id). RLS faqat o'zinikini beradi. */
export type Farzand = { id: string; fish: string; holat: string }

export const farzandlarim = cache(async (): Promise<Farzand[]> => {
  const supabase = await createClient()
  const { data } = await supabase.from('students').select('id, fish, holat').order('fish')
  return ((data ?? []) as Farzand[]).sort((a, b) => Number(a.holat === 'ketgan') - Number(b.holat === 'ketgan'))
})

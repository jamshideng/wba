import type { createClient } from '@/lib/supabase/server'

type Klient = Awaited<ReturnType<typeof createClient>>

/** Keyingi bozor kuni (settings market.bozor_sana, 0042) — belgilanmagan bo'lsa null */
export async function bozorKuni(supabase: Klient): Promise<string | null> {
  const { data } = await supabase.from('settings').select('qiymat').eq('kalit', 'market.bozor_sana').maybeSingle()
  const q = data?.qiymat
  return typeof q === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : null
}

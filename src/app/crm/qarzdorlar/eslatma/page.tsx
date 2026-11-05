import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar } from '@/components/forma'
import type { Qarzdor } from '@/lib/types'
import { EslatmaForma, type EslatmaQarzdor } from './forma'

export const metadata = { title: 'Qarzdorlarga eslatma' }
export const dynamic = 'force-dynamic'
// Telegram yuborish shu so'rov ichida tugaydi (xabarlar sahifasi bilan bir xil)
export const maxDuration = 60

/**
 * Faqat qarzdorlarga to'lov eslatmasi — Telegram + sayt + ilova (push).
 * Ro'yxat to'liq (sahifalashsiz), hammasi oldindan belgilangan; minimal
 * summa va belgilash brauzerda, jonli.
 */
export default async function QarzEslatma({ searchParams }: { searchParams: Promise<{ ok?: string; xato?: string }> }) {
  await talabRol('admin', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Qarzdorlarga eslatma" />
  const sp = await searchParams

  const supabase = await createClient()
  const oldin = new Date(Date.now() - 90 * 86_400_000).toISOString()
  const [{ data: qarzdorlar }, { data: tarix }, { data: aud }] = await Promise.all([
    supabase.from('v_qarzdorlar').select('*').order('qarz', { ascending: false }).limit(2000),
    supabase.from('bildirishnomalar').select('filtr, created_at').eq('manba', 'qarz').gte('created_at', oldin).order('created_at', { ascending: false }).limit(5000),
    supabase.rpc('elon_oluvchilar', { p_kimga: ['oquvchi', 'ota_ona'], p_filtr: { qarzdor: true } }),
  ])

  const oxirgi = new Map<string, string>()
  for (const t of tarix ?? []) {
    const id = (t.filtr as { oquvchi?: string } | null)?.oquvchi
    if (id && !oxirgi.has(id)) oxirgi.set(id, t.created_at as string)
  }
  const telegram = new Map<string, { oquvchi: boolean; ota_ona: boolean }>()
  for (const a of aud ?? []) {
    if (!a.student_id || !a.chat_id) continue
    const t = telegram.get(a.student_id) ?? { oquvchi: false, ota_ona: false }
    if (a.kim === 'oquvchi') t.oquvchi = true
    if (a.kim === 'ota_ona') t.ota_ona = true
    telegram.set(a.student_id, t)
  }

  const royxat: EslatmaQarzdor[] = ((qarzdorlar ?? []) as Qarzdor[])
    .filter((q) => Number(q.qarz) > 0)
    .map((q) => ({
      id: q.student_id,
      fish: q.fish,
      guruhlar: q.guruhlar,
      qarz: Number(q.qarz),
      oxirgi: oxirgi.get(q.student_id) ?? null,
      telegram: telegram.get(q.student_id) ?? { oquvchi: false, ota_ona: false },
    }))

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Qarzdorlarga eslatma" izoh="Telegram · sayt · ilova" />
      <Link href="/crm/qarzdorlar" className="w-fit text-[13px] text-ink-3 hover:text-ink">← Qarzdorlar</Link>
      <Xabar ok={sp.ok} xato={sp.xato} />
      <EslatmaForma qarzdorlar={royxat} />
    </div>
  )
}

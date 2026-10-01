import Link from 'next/link'
import { notFound } from 'next/navigation'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar } from '@/components/forma'
import { IconArrowLeft } from '@/components/icons'
import type { Mahsulot } from '@/lib/market'
import { MahsulotForma } from '../forma'
import { bozorKuni } from '../../../bozor'

export const metadata = { title: 'Mahsulot · Market boshqaruvi' }
export const dynamic = 'force-dynamic'

/** /crm/market/boshqaruv/mahsulot/yangi — yangi; /<uuid> — tahrirlash */
export default async function MahsulotSahifasi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ xato?: string }>
}) {
  await talabRol('admin', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Mahsulot" />

  const [{ id }, s] = await Promise.all([params, searchParams])
  const yangi = id === 'yangi'
  if (!yangi && !/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const supabase = await createClient()
  const [{ data }, { data: toifaQatorlar }, bozor, { count: zakazlar }] = await Promise.all([
    yangi ? Promise.resolve({ data: null }) : supabase.from('woblr_rewards').select('*').eq('id', id).maybeSingle(),
    supabase.from('woblr_rewards').select('toifa').not('toifa', 'is', null),
    bozorKuni(supabase),
    yangi
      ? Promise.resolve({ count: 0 })
      : supabase.from('woblr_redemptions').select('id', { count: 'exact', head: true }).eq('reward_id', id).eq('holat', 'buyurtma'),
  ])
  if (!yangi && !data) notFound()
  const toifalar = [...new Set((toifaQatorlar ?? []).map((t) => t.toifa as string))].sort((a, b) => a.localeCompare(b, 'uz'))

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href="/crm/market/boshqaruv?bolim=mahsulot" className="flex items-center gap-2 text-[13px] text-ink-3 transition hover:text-ink">
        <IconArrowLeft size={15} /> Mahsulotlar
      </Link>
      <Sarlavha nom={yangi ? 'Yangi mahsulot' : 'Mahsulotni tahrirlash'} izoh="woblar market" />
      <Xabar xato={s.xato} />
      <MahsulotForma key={id} m={(data as Mahsulot | null) ?? null} toifalar={toifalar} bozor={bozor} zakazlar={zakazlar ?? 0} />
    </div>
  )
}

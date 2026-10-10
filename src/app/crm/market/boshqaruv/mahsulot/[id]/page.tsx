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
import { MahsulotOchirish } from '../ochirish'
import { bozorKuni } from '../../../bozor'

export const metadata = { title: 'Mahsulot · Market boshqaruvi' }
export const dynamic = 'force-dynamic'

/** /crm/market/boshqaruv/mahsulot/yangi — yangi; /<uuid> — tahrirlash */
export default async function MahsulotSahifasi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ xato?: string; taklif?: string }>
}) {
  await talabRol('admin', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Mahsulot" />

  const [{ id }, s] = await Promise.all([params, searchParams])
  const yangi = id === 'yangi'
  if (!yangi && !/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const supabase = await createClient()
  const [{ data }, { data: toifaQatorlar }, bozor, { count: zakazlar }, { data: buyurtmalar }] = await Promise.all([
    yangi ? Promise.resolve({ data: null }) : supabase.from('woblr_rewards').select('*').eq('id', id).maybeSingle(),
    supabase.from('woblr_rewards').select('toifa').not('toifa', 'is', null),
    bozorKuni(supabase),
    yangi
      ? Promise.resolve({ count: 0 })
      : supabase.from('woblr_redemptions').select('id', { count: 'exact', head: true }).eq('reward_id', id).eq('holat', 'buyurtma'),
    yangi ? Promise.resolve({ data: [] }) : supabase.from('woblr_redemptions').select('holat').eq('reward_id', id),
  ])
  const ochiq = (buyurtmalar ?? []).filter((b) => b.holat === 'buyurtma' || b.holat === 'kutilmoqda').length
  const berilgan = (buyurtmalar ?? []).filter((b) => b.holat === 'berildi').length
  if (!yangi && !data) notFound()
  const toifalar = [...new Set((toifaQatorlar ?? []).map((t) => t.toifa as string))].sort((a, b) => a.localeCompare(b, 'uz'))

  // 0065 — "Mahsulot qilish": o'quvchi taklifidan to'ldiriladi
  const { data: taklif } = yangi && s.taklif && /^[0-9a-f-]{36}$/i.test(s.taklif)
    ? await supabase.from('woblr_takliflar').select('nom, tavsif, havola, rasm_url, taxminiy_narx, qachon').eq('id', s.taklif).maybeSingle()
    : { data: null }
  const andoza = taklif
    ? {
        nom: taklif.nom as string,
        tavsif: [taklif.tavsif, taklif.havola].filter(Boolean).join('\n') || null,
        rasm_url: (taklif.rasm_url as string | null) ?? null,
        narx: (taklif.taxminiy_narx as number | null) ?? null,
        oldindan: taklif.qachon === 'keyingi_bozor',
      }
    : null

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href="/crm/market/boshqaruv?bolim=mahsulot" className="flex items-center gap-2 text-[13px] text-ink-3 transition hover:text-ink">
        <IconArrowLeft size={15} /> Mahsulotlar
      </Link>
      <Sarlavha nom={yangi ? 'Yangi mahsulot' : 'Mahsulotni tahrirlash'} izoh="woblar market" />
      <Xabar xato={s.xato} />
      <MahsulotForma key={id} m={(data as Mahsulot | null) ?? null} toifalar={toifalar} bozor={bozor} zakazlar={zakazlar ?? 0} andoza={andoza} />
      {!yangi && data && (
        <div className="mt-4 max-w-3xl">
          <MahsulotOchirish id={id} nom={(data as Mahsulot).nom} ochiq={ochiq} berilgan={berilgan} />
        </div>
      )}
    </div>
  )
}

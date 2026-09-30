import Link from 'next/link'
import { notFound } from 'next/navigation'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar } from '@/components/forma'
import { IconArrowLeft } from '@/components/icons'
import { guruhTahrir } from '../../actions'
import { GuruhFormasi, type GuruhQiymati } from '../../forma'

export const metadata = { title: 'Guruhni tahrirlash' }
export const dynamic = 'force-dynamic'

export default async function GuruhTahrir({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ xato?: string }>
}) {
  await talabRol('admin', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Guruhni tahrirlash" />

  const [{ id }, { xato }] = await Promise.all([params, searchParams])
  const supabase = await createClient()
  const { data: g } = await supabase
    .from('groups')
    .select('id, nom, subject_id, level_id, teacher_id, boshlanish, tugash, kunlar, oylik_narx, sigim, holat')
    .eq('id', id)
    .maybeSingle()
  if (!g) notFound()

  return (
    <div className="flex max-w-2xl flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href={`/crm/guruhlar/${g.id}`} className="flex items-center gap-2 text-[13px] text-ink-3 hover:text-ink">
        <IconArrowLeft size={15} /> {g.nom}
      </Link>
      <Sarlavha nom="Guruhni tahrirlash" izoh={g.id} />
      <Xabar xato={xato} />
      <GuruhFormasi amal={guruhTahrir} qiymat={g as GuruhQiymati} tugma="Saqlash" />
    </div>
  )
}

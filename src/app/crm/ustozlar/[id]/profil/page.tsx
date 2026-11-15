import Link from 'next/link'
import { notFound } from 'next/navigation'
import { talabRol, managermi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Xabar } from '@/components/forma'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { IconArrowLeft } from '@/components/icons'
import { UstozProfilSahifa } from '@/components/ustoz-profil/profil-sahifa'
import { ustozProfilOl } from '@/lib/ustoz-profil'

export const metadata = { title: 'Ustoz ma’lumotlari' }
export const dynamic = 'force-dynamic'

/** Admin/manager/direktor: ustozning CV, obyektivka, saytda ko'rsatish va tasdiq (0126) */
export default async function UstozMalumotlari({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  const profil = await talabRol('admin', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Ustoz ma’lumotlari" />
  const [{ id }, s] = await Promise.all([params, searchParams])
  const supabase = await createClient()
  const m = await ustozProfilOl(supabase, id)
  if (!m) notFound()
  const manager = managermi(profil.rol)
  const { data: nusxa } = manager && m.profil.holat === 'kutilmoqda' ? await supabase.rpc('ustoz_cv_nusxa', { p_teacher: id }) : { data: null }

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href={`/crm/ustozlar/${id}`} className="flex items-center gap-2 text-[13px] text-ink-3 transition hover:text-ink">
        <IconArrowLeft size={15} />
        {m.ustoz.ism}
      </Link>
      <Sarlavha nom="Ma’lumotlari" izoh={`${m.ustoz.ism} (${id}) · CV va obyektivka`} />
      <Xabar ok={s.ok} xato={s.xato} />
      <UstozProfilSahifa
        m={m}
        qaytish={`/crm/ustozlar/${id}/profil`}
        admin
        manager={manager}
        joriyNusxa={(nusxa as Record<string, unknown> | null) ?? null}
        docxHavola={`/crm/ustozlar/${id}/obyektivka`}
      />
    </div>
  )
}

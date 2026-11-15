import { redirect } from 'next/navigation'
import { talabProfil, adminmi, managermi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Xabar } from '@/components/forma'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { UstozProfilSahifa } from '@/components/ustoz-profil/profil-sahifa'
import { ustozProfilOl } from '@/lib/ustoz-profil'

export const metadata = { title: 'Ma’lumotlarim' }
export const dynamic = 'force-dynamic'

/**
 * Ustozning "Ma'lumotlarim" sahifasi (0126): CV (manager tasdig'i bilan
 * saytga chiqadi) va obyektivka (ichki). Profil menyusidan ochiladi.
 */
export default async function Malumotlarim({ searchParams }: { searchParams: Promise<{ ok?: string; xato?: string }> }) {
  const profil = await talabProfil()
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Ma’lumotlarim" />
  const s = await searchParams
  const supabase = await createClient()
  const { data: men } = await supabase.from('teachers').select('id').eq('profile_id', profil.id).maybeSingle()
  if (!men) redirect('/crm/profil')

  const m = await ustozProfilOl(supabase, men.id)
  if (!m) redirect('/crm/profil')
  const manager = managermi(profil.rol)
  const { data: nusxa } = manager && m.profil.holat === 'kutilmoqda' ? await supabase.rpc('ustoz_cv_nusxa', { p_teacher: men.id }) : { data: null }

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Ma’lumotlarim" izoh="CV va obyektivka" />
      <Xabar ok={s.ok} xato={s.xato} />
      <UstozProfilSahifa
        m={m}
        qaytish="/crm/malumotlarim"
        admin={adminmi(profil.rol)}
        manager={false}
        joriyNusxa={(nusxa as Record<string, unknown> | null) ?? null}
        docxHavola={`/crm/ustozlar/${men.id}/obyektivka`}
      />
    </div>
  )
}

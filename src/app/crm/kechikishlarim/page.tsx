import { redirect } from 'next/navigation'
import { talabProfil, getUstoz } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { IconAlert, IconJadval } from '@/components/icons'
import { KECHIKISH_USTUNLAR, KechikishJadval, type KechikishYozuv } from '@/components/kechikish'
import { davrNomi, joriyDavr } from '@/lib/format'

export const metadata = { title: 'Kechikishlarim' }
export const dynamic = 'force-dynamic'

/**
 * Ustoz o'z kechikishlarini ko'radi (faqat ko'rish). RLS (0060):
 * ustoz faqat teacher_id = o'zi bo'lgan yozuvlarni oladi.
 */
export default async function Kechikishlarim() {
  await talabProfil()
  const ustoz = await getUstoz()
  if (!ustoz) redirect('/crm')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Kechikishlarim" />

  const davr = joriyDavr()
  const supabase = await createClient()
  const { data } = await supabase
    .from('ustoz_kechikish')
    .select(KECHIKISH_USTUNLAR)
    .eq('teacher_id', ustoz.id)
    .order('sana', { ascending: false })
    .limit(100)
  const royxat = (data ?? []) as unknown as KechikishYozuv[]
  const oy = royxat.filter((k) => k.sana.startsWith(davr))
  const oyDaq = oy.reduce((a, k) => a + k.daqiqa, 0)

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Kechikishlarim" izoh="administrator yozgan kechikishlar — yozuv yo‘q bo‘lsa, o‘z vaqtida kelgansiz" />
      <div className="grid grid-cols-2 gap-3">
        <Stat label={`${davrNomi(davr)} — kechikish`} value={String(oy.length)} sub="marta" ton={oy.length ? 'brand' : 'ok'} Icon={IconAlert} />
        <Stat label="Jami kechikkan vaqt" value={`${oyDaq} daq`} sub="shu oy" ton={oyDaq ? 'accent' : 'ok'} Icon={IconJadval} />
      </div>
      <Card className="flex flex-col">
        <CardHeader title="Tarix" meta={`${royxat.length} ta`} />
        <div className="px-3 pb-3">
          <KechikishJadval royxat={royxat} ustozsiz bosh="Kechikish yozilmagan. Barakalla!" />
        </div>
      </Card>
    </div>
  )
}

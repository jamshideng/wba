import Link from 'next/link'
import { redirect } from 'next/navigation'
import { talabRol } from '@/lib/auth'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { farzandlarim } from '@/lib/farzand'
import { Card, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { IconStudents } from '@/components/icons'

export const metadata = { title: 'Farzandlarim' }
export const dynamic = 'force-dynamic'

/**
 * Ota-ona bosh sahifasi (0116). Bitta farzand — to'g'ridan-to'g'ri uning
 * sahifasi; bir nechta — tanlash; hech kim bog'lanmagan — admin'ga murojaat.
 */
export default async function Farzandlarim() {
  await talabRol('ota_ona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Farzandlarim" />

  const farzandlar = await farzandlarim()
  if (farzandlar.length === 1) redirect(`/crm/farzand/${farzandlar[0].id}`)

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Farzandlarim" izoh={farzandlar.length ? `${farzandlar.length} ta farzand` : 'ota-ona'} />
      {farzandlar.length === 0 ? (
        <Card className="p-5">
          <Empty>Hisobingiz hali farzandingizga bog‘lanmagan. Markaz adminiga aytsangiz, bir bosishda bog‘lab qo‘yadi.</Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {farzandlar.map((f) => (
            <Link
              key={f.id}
              href={`/crm/farzand/${f.id}`}
              className="flex min-h-11 items-center gap-3 rounded-[14px] border border-line bg-surface px-5 py-4 transition hover:border-ink-3"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                <IconStudents size={18} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-semibold">{f.fish}</span>
                <span className="text-[12px] text-ink-3">{f.id}</span>
              </span>
              {f.holat !== 'faol' && <Badge ton="jim">{f.holat}</Badge>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

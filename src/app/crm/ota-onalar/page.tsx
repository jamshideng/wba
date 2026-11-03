import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { loginNomi } from '@/lib/login'
import { telefon } from '@/lib/format'
import { Card, CardHeader, Badge, Empty, Button } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { kirishKlass, Xabar } from '@/components/forma'
import { JonliForma } from '@/components/jonli-forma'

export const metadata = { title: 'Ota-onalar' }
export const dynamic = 'force-dynamic'

type OtaOna = { id: string; ism: string; email: string | null; telefon: string | null; holat: string }
type Bola = { id: string; fish: string; holat: string; ota_ona_id: string }

/**
 * Ota-onalar (0116) — admin, manager, direktor. Har ota-ona hisobi va unga
 * biriktirilgan farzandlar; bosilsa — farzand biriktirish / uzish sahifasi.
 */
export default async function OtaOnalar({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; xato?: string }> }) {
  await talabRol('admin', 'direktor', 'manager')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Ota-onalar" />

  const s = await searchParams
  const q = (s.q ?? '').trim().toLowerCase()
  const supabase = await createClient()
  const [{ data: oXom }, { data: bXom }] = await Promise.all([
    supabase.from('profiles').select('id, ism, email, telefon, holat').eq('rol', 'ota_ona').order('ism'),
    supabase.from('students').select('id, fish, holat, ota_ona_id').not('ota_ona_id', 'is', null).order('fish'),
  ])
  const bolalar = (bXom ?? []) as Bola[]
  const royxat = ((oXom ?? []) as OtaOna[])
    .map((o) => ({ ...o, farzandlar: bolalar.filter((b) => b.ota_ona_id === o.id) }))
    .filter(
      (o) =>
        !q ||
        o.ism.toLowerCase().includes(q) ||
        loginNomi(o.email).toLowerCase().includes(q) ||
        (o.telefon ?? '').replace(/\D/g, '').includes(q.replace(/\D/g, '') || '§') ||
        o.farzandlar.some((b) => b.fish.toLowerCase().includes(q) || b.id.toLowerCase() === q),
    )

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Ota-onalar" izoh={`${royxat.length} ta hisob`} amal={<Button href="/crm/ota-onalar/yangi">+ Yangi ota-ona</Button>} />
      <Xabar ok={s.ok} xato={s.xato} />
      <p className="text-[12.5px] text-ink-3">
        Ota-onaga hisob shu yerda (“+ Yangi ota-ona”) yoki o‘quvchi sahifasida ochiladi. Bu yerda bir ota-onaga bir nechta farzand biriktiriladi yoki uziladi.
      </p>

      <JonliForma className="flex flex-wrap items-end gap-2.5">
        <label className="flex min-w-64 flex-1 flex-col gap-1.5">
          <span className="lbl">Qidirish</span>
          <input name="q" defaultValue={s.q ?? ''} placeholder="Ism, login, telefon yoki farzand" className={kirishKlass} />
        </label>
      </JonliForma>

      <Card className="flex flex-col">
        <CardHeader title="Ro‘yxat" meta={`${royxat.length} ta`} />
        {royxat.length === 0 ? (
          <div className="px-5 pb-5">
            <Empty>{q ? 'Hech narsa topilmadi.' : 'Hali ota-ona hisobi ochilmagan.'}</Empty>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            {royxat.map((o) => (
              <li key={o.id}>
                <Link href={`/crm/ota-onalar/${o.id}`} className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-2">
                  <span className="flex min-w-48 flex-1 flex-col">
                    <span className="text-[13.5px] font-semibold">{o.ism}</span>
                    <span className="text-[12px] text-ink-3">
                      {loginNomi(o.email)}
                      {o.telefon ? ` · ${telefon(o.telefon)}` : ''}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {o.farzandlar.length === 0 ? (
                      <Badge ton="accent">farzand biriktirilmagan</Badge>
                    ) : (
                      o.farzandlar.map((b) => (
                        <Badge key={b.id} ton={b.holat === 'ketgan' ? 'jim' : 'brand'}>
                          {b.fish}
                        </Badge>
                      ))
                    )}
                  </span>
                  {o.holat !== 'faol' && <Badge ton="jim">{o.holat}</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

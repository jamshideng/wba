import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { sozlamaSaqla } from './actions'
import type { Setting } from '@/lib/types'

export const metadata = { title: 'Sozlamalar' }
export const dynamic = 'force-dynamic'

/** jsonb qiymatni formaga qaytarish uchun matn. */
function korinish(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

export default async function Sozlamalar({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  await talabRol('admin', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Sozlamalar" />

  const xabar = await searchParams
  const supabase = await createClient()

  const { data: sozlamalar } = await supabase.from('settings').select('*').order('kalit')

  const sList = (sozlamalar ?? []) as Setting[]
  const aniqlanmagan = sList.filter((x) => x.qiymat === null)

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Sozlamalar" />
      <Xabar ok={xabar.ok} xato={xabar.xato} />

      {aniqlanmagan.length > 0 && (
        <p className="rounded-[10px] border border-dashed border-accent-line px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
          <b>{aniqlanmagan.length} ta qiymat [ANIQLANMAGAN]</b> — bular kelishilmaguncha tizim ularni
          hisobga olmaydi va taxmin qilmaydi: {aniqlanmagan.map((x) => x.kalit).join(', ')}.
        </p>
      )}

      <p className="rounded-[10px] border border-line bg-surface px-4 py-3 text-[12.5px] text-ink-2">
        Xodim hisoblari (ochish, parol, lavozim, ustozga bog‘lash, bloklash) —{' '}
        <Link href="/crm/xodimlar" className="font-semibold text-accent hover:text-brand">Xodimlar</Link> bo‘limida.
      </p>

      <Card className="flex flex-col">
        <CardHeader title="Markaz qiymatlari" meta="bo‘sh qoldirilsa — [ANIQLANMAGAN]" />
        <ul>
          {sList.map((x) => (
            <li key={x.kalit} className="border-t border-line-soft px-5 py-3">
              <form action={sozlamaSaqla} className="grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1.6fr_auto] sm:items-center">
                <input type="hidden" name="kalit" value={x.kalit} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-[family-name:var(--font-mono)] text-[12px]">{x.kalit}</span>
                  {x.tavsif && <span className="text-[11.5px] text-ink-3">{x.tavsif}</span>}
                </span>
                <input
                  name="qiymat"
                  defaultValue={korinish(x.qiymat)}
                  placeholder="[ANIQLANMAGAN]"
                  aria-label={x.kalit}
                  className={`${kirishKlass} ${x.qiymat === null ? 'border-accent-line' : ''}`}
                />
                <Yuborish tur="ikkilamchi" kutish="…">Saqlash</Yuborish>
              </form>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

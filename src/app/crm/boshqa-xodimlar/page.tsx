import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { pul, telefon, sanaQisqa } from '@/lib/format'
import type { BoshqaXodim } from '@/lib/types'
import { xodimQosh, xodimTahrir } from './actions'

export const metadata = { title: 'Boshqa xodimlar' }
export const dynamic = 'force-dynamic'

const LAVOZIMLAR = ['Farrosh', 'Qorovul', 'Oshpaz', 'Haydovchi', 'Texnik xodim', 'Bog‘bon']

/**
 * Boshqa xodimlar (0068) — farrosh, qorovul va h.k. Tizimga kirmaydi,
 * faqat ro'yxat. "Xodimlar" guruhining bir qismi. Faqat admin va direktor.
 */
export default async function BoshqaXodimlar({ searchParams }: { searchParams: Promise<{ ok?: string; xato?: string }> }) {
  await talabRol('admin', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Boshqa xodimlar" />
  const xabar = await searchParams

  const supabase = await createClient()
  const { data } = await supabase
    .from('boshqa_xodimlar')
    .select('id, ism, lavozim, telefon, oylik, ishga_kirgan, holat, izoh, created_at, updated_at')
    .order('holat')
    .order('lavozim')
    .order('ism')
  const royxat = (data ?? []) as BoshqaXodim[]
  const faollar = royxat.filter((x) => x.holat === 'faol')
  const jamiOylik = faollar.reduce((a, x) => a + Number(x.oylik ?? 0), 0)

  const Maydonlar = ({ x }: { x?: BoshqaXodim }) => (
    <>
      <Maydon nom="Ism familiya">
        <input name="ism" required defaultValue={x?.ism} className={kirishKlass} />
      </Maydon>
      <Maydon nom="Lavozim">
        <input name="lavozim" required list="lavozimlar" defaultValue={x?.lavozim} placeholder="Farrosh" className={kirishKlass} />
      </Maydon>
      <Maydon nom="Telefon">
        <input name="telefon" type="tel" defaultValue={x?.telefon ?? ''} className={kirishKlass} />
      </Maydon>
      <Maydon nom="Oylik" izoh="Bo‘sh — belgilanmagan">
        <input name="oylik" inputMode="numeric" defaultValue={x?.oylik ?? ''} placeholder="2000000" className={kirishKlass} />
      </Maydon>
      <Maydon nom="Ishga kirgan">
        <input name="ishga_kirgan" type="date" defaultValue={x?.ishga_kirgan ?? ''} className={kirishKlass} />
      </Maydon>
      <Maydon nom="Izoh">
        <input name="izoh" defaultValue={x?.izoh ?? ''} className={kirishKlass} />
      </Maydon>
    </>
  )

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Boshqa xodimlar" izoh={`${faollar.length} ta faol · farrosh, qorovul va h.k. — tizimga kirmaydi`} />
      <Xabar ok={xabar.ok} xato={xabar.xato} />
      <datalist id="lavozimlar">
        {LAVOZIMLAR.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Stat label="Faol xodimlar" value={faollar.length} sub={`ketgan: ${royxat.length - faollar.length}`} />
        <Stat label="Oyliklar jami" value={pul(jamiOylik)} sub="faollar · so‘m" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <Card className="flex flex-col">
          <CardHeader title="Ro‘yxat" meta={`${royxat.length} ta`} />
          {royxat.length === 0 ? (
            <div className="px-5 pb-5">
              <Empty>Hali xodim qo‘shilmagan.</Empty>
            </div>
          ) : (
            <ul className="flex flex-col">
              {royxat.map((x) => (
                <li key={x.id} className="flex flex-col gap-2 border-t border-line-soft px-5 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
                        {x.ism}
                        <Badge ton={x.holat === 'faol' ? 'ok' : 'jim'}>{x.holat === 'faol' ? x.lavozim : 'ishdan ketgan'}</Badge>
                      </span>
                      <span className="tnum text-[12px] text-ink-3">
                        {telefon(x.telefon)}
                        {x.ishga_kirgan ? ` · ${sanaQisqa(x.ishga_kirgan)} dan` : ''}
                        {x.izoh ? ` · ${x.izoh}` : ''}
                      </span>
                    </span>
                    <span className="tnum font-[family-name:var(--font-mono)] text-[13.5px] font-semibold">
                      {x.oylik === null ? '—' : pul(x.oylik)}
                    </span>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-[12px] text-ink-3 hover:text-ink">Tahrirlash</summary>
                    <form action={xodimTahrir} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-end">
                      <input type="hidden" name="id" value={x.id} />
                      <Maydonlar x={x} />
                      <Maydon nom="Holat">
                        <select name="holat" defaultValue={x.holat} className={kirishKlass}>
                          <option value="faol">Ishlayapti</option>
                          <option value="ketgan">Ishdan ketgan</option>
                        </select>
                      </Maydon>
                      <Yuborish kutish="…">Saqlash</Yuborish>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Xodim qo‘shish" />
          <form action={xodimQosh} className="flex flex-col gap-3 px-5 pb-5">
            <Maydonlar />
            <Yuborish kutish="Qo‘shilmoqda…">Qo‘shish</Yuborish>
          </form>
        </Card>
      </div>
    </div>
  )
}

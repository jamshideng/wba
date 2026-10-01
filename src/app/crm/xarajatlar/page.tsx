import { talabRol, adminmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, BarRow, Empty, Badge } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { pul, sana, davrNomi, joriyDavr, bugunToshkent } from '@/lib/format'
import { xarajatQosh, xarajatBekor } from './actions'
import { TOIFALAR, toifami } from './toifalar'

export const metadata = { title: 'Xarajatlar' }
export const dynamic = 'force-dynamic'

type Xarajat = {
  id: number
  sana: string
  toifa: string
  summa: number
  izoh: string | null
  bekor: boolean
  bekor_sabab: string | null
  profiles: { ism: string } | null
}

type Moliya = {
  tushum: number
  xarajat: number
  foyda: number
  toifalar: { toifa: string; summa: number; soni: number }[]
}

/**
 * Xarajatlar va oylik moliya (0033, LevelUp `expenses` o'rni).
 *
 * Oy tanlanadi: tushum (tasdiqlangan to'lovlar, to'lov sanasi bo'yicha),
 * xarajat va sof foyda. Yozish — admin va direktor; qabulxona faqat ko'radi.
 * Xarajat o'chirilmaydi — sababi bilan bekor qilinadi.
 */
export default async function Xarajatlar({
  searchParams,
}: {
  searchParams: Promise<{ davr?: string; toifa?: string; ok?: string; xato?: string }>
}) {
  const profil = await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Xarajatlar" />

  const s = await searchParams
  const davr = /^\d{4}-(0[1-9]|1[0-2])$/.test(s.davr ?? '') ? s.davr! : joriyDavr()
  const toifa = toifami(s.toifa) ? s.toifa : undefined
  const yozadi = adminmi(profil.rol)

  const dan = `${davr}-01`
  const [y, m] = davr.split('-').map(Number)
  const gacha = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const joriy = `/crm/xarajatlar?davr=${davr}${toifa ? `&toifa=${toifa}` : ''}`

  const supabase = await createClient()
  let sorov = supabase
    .from('xarajatlar')
    .select('id, sana, toifa, summa, izoh, bekor, bekor_sabab, profiles(ism)')
    .gte('sana', dan)
    .lte('sana', gacha)
  if (toifa) sorov = sorov.eq('toifa', toifa)

  const [{ data }, { data: moliyaXom }] = await Promise.all([
    sorov.order('sana', { ascending: false }).order('id', { ascending: false }),
    supabase.rpc('oylik_moliya', { p_davr: davr }),
  ])

  const royxat = (data ?? []) as unknown as Xarajat[]
  const mo: Moliya = moliyaXom ?? { tushum: 0, xarajat: 0, foyda: 0, toifalar: [] }
  const foyda = Number(mo.foyda)
  const maxToifa = Math.max(1, ...mo.toifalar.map((t) => Number(t.summa)))
  const toifaNomi = (t: string) => TOIFALAR[t as keyof typeof TOIFALAR] ?? t

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Xarajatlar"
        izoh={`${davrNomi(davr)} · ${royxat.filter((x) => !x.bekor).length} ta yozuv`}
        amal={
          <form className="flex items-end gap-2">
            <input type="month" name="davr" defaultValue={davr} className={kirishKlass} />
            <button type="submit" className="min-h-11 rounded-[9px] border border-line px-4 text-[13px] text-ink-2 hover:text-ink">
              Ko‘rish
            </button>
          </form>
        }
      />

      <Xabar ok={s.ok} xato={s.xato} />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Stat label={`${davrNomi(davr)} tushumi`} value={pul(mo.tushum)} sub="tasdiqlangan to‘lovlar · so‘m" />
        <Stat label="Xarajat" value={pul(mo.xarajat)} sub="bekor qilinmaganlar · so‘m" ton="accent" />
        <Stat
          label="Sof foyda"
          value={pul(foyda)}
          sub="tushum − xarajat · so‘m"
          ton={foyda < 0 ? 'brand' : 'ok'}
          border={foyda < 0 ? 'brand' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <Card className="flex flex-col">
          <CardHeader title="Yozuvlar" meta={toifa ? toifaNomi(toifa) : 'hamma toifa'} />
          {royxat.length === 0 ? (
            <div className="px-5 pb-5">
              <Empty>{toifa ? 'Bu oyda shu toifada xarajat yo‘q.' : 'Bu oyda xarajat yozilmagan.'}</Empty>
            </div>
          ) : (
            <ul className="flex flex-col">
              {royxat.map((x) => (
                <li key={x.id} className="flex flex-col gap-2 border-t border-line-soft px-5 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
                        {toifaNomi(x.toifa)}
                        {x.bekor && <Badge>bekor</Badge>}
                      </span>
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-3">
                        #{x.id} · {sana(x.sana)}
                        {x.profiles?.ism ? ` · ${x.profiles.ism}` : ''}
                      </span>
                      {x.izoh && <span className="text-[12.5px] text-ink-2">{x.izoh}</span>}
                      {x.bekor && x.bekor_sabab && <span className="text-[12px] text-ink-3">Sabab: {x.bekor_sabab}</span>}
                    </div>
                    <span
                      className={`tnum font-[family-name:var(--font-mono)] text-[14px] font-semibold ${x.bekor ? 'text-ink-4 line-through' : ''}`}
                    >
                      {pul(x.summa)}
                    </span>
                  </div>
                  {yozadi && !x.bekor && (
                    <details>
                      <summary className="cursor-pointer text-[12px] text-ink-3 hover:text-ink">Bekor qilish</summary>
                      <form action={xarajatBekor} className="mt-2 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="id" value={x.id} />
                        <input type="hidden" name="qaytish" value={joriy} />
                        <Maydon nom="Sabab">
                          <input name="sabab" required placeholder="Masalan: ikki marta yozilgan" className={kirishKlass} />
                        </Maydon>
                        <Yuborish tur="xavfli" kutish="…">Bekor qilish</Yuborish>
                      </form>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {yozadi && (
            <Card className="flex flex-col">
              <CardHeader title="Xarajat qo‘shish" />
              <form action={xarajatQosh} className="flex flex-col gap-3 px-5 pb-5">
                <input type="hidden" name="qaytish" value={joriy} />
                <Maydon nom="Toifa">
                  <select name="toifa" required defaultValue={toifa ?? ''} className={kirishKlass}>
                    <option value="" disabled>
                      Tanlang…
                    </option>
                    {Object.entries(TOIFALAR).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Maydon>
                <Maydon nom="Summa" izoh="Masalan: 3500000, 3500 ming yoki 3.5 mln">
                  <input name="summa" required inputMode="numeric" className={kirishKlass} />
                </Maydon>
                <Maydon nom="Sana">
                  <input type="date" name="sana" required defaultValue={bugunToshkent()} className={kirishKlass} />
                </Maydon>
                <Maydon nom="Izoh">
                  <input name="izoh" placeholder="Masalan: oktabr ijarasi" className={kirishKlass} />
                </Maydon>
                <Yuborish kutish="Yozilmoqda…">Yozish</Yuborish>
              </form>
            </Card>
          )}

          <Card className="flex flex-col">
            <CardHeader title="Toifalar bo‘yicha" meta="so‘m" />
            <div className="flex flex-col gap-2.5 px-5 pb-5">
              {mo.toifalar.length === 0 ? (
                <Empty>Hali xarajat yo‘q.</Empty>
              ) : (
                mo.toifalar.map((t) => (
                  <a key={t.toifa} href={`/crm/xarajatlar?davr=${davr}&toifa=${t.toifa}`} className="block hover:opacity-80">
                    <BarRow label={`${toifaNomi(t.toifa)} · ${t.soni}`} value={Number(t.summa)} max={maxToifa} />
                  </a>
                ))
              )}
              {toifa && (
                <a href={`/crm/xarajatlar?davr=${davr}`} className="text-[12px] text-ink-3 hover:text-ink">
                  Hamma toifani ko‘rsatish →
                </a>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

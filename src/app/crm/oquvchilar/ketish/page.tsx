import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Empty, Badge, BarRow } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { kirishKlass, Maydon } from '@/components/forma'
import { JonliForma } from '@/components/jonli-forma'
import { pul, sana, bugunToshkent } from '@/lib/format'
import { ketishNomi, type KetishTahlili } from '@/lib/ketish'

export const metadata = { title: 'Ketish tahlili' }
export const dynamic = 'force-dynamic'

const SANA = /^\d{4}-\d{2}-\d{2}$/
const soniFmt = (n: number) => String(n)

/**
 * Ketish tahlili (0083, SoffCRM'dan): tanlangan davrda arxivga o'tganlar —
 * sabablar, ustoz va fan kesimi, koeffitsient, yo'qotilgan oylik daromad.
 * Sababi yo'qlarga Arxiv sahifasida sabab qo'yiladi.
 */
export default async function KetishTahliliSahifa({
  searchParams,
}: {
  searchParams: Promise<{ dan?: string; gacha?: string }>
}) {
  await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Ketish tahlili" />

  const s = await searchParams
  const bugun = bugunToshkent()
  const dan = SANA.test(s.dan ?? '') ? s.dan! : bugunToshkent(new Date(Date.now() - 90 * 86400_000))
  const gacha = SANA.test(s.gacha ?? '') ? s.gacha! : bugun

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('ketish_tahlili', { p_dan: dan, p_gacha: gacha })
  const t = data as KetishTahlili | null

  const maxSabab = Math.max(1, ...(t?.sabablar ?? []).map((x) => x.soni))
  const maxUstoz = Math.max(1, ...(t?.ustozlar ?? []).map((x) => x.soni))
  const maxFan = Math.max(1, ...(t?.fanlar ?? []).map((x) => x.soni))
  const belgilanmagan = (t?.sabablar ?? []).find((x) => x.sabab === 'belgilanmagan')?.soni ?? 0

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Ketish tahlili"
        izoh={`${sana(dan)} — ${sana(gacha)}`}
        amal={
          <JonliForma className="flex flex-wrap items-end gap-2">
            <Maydon nom="Dan">
              <input type="date" name="dan" defaultValue={dan} className={kirishKlass} />
            </Maydon>
            <Maydon nom="Gacha">
              <input type="date" name="gacha" defaultValue={gacha} className={kirishKlass} />
            </Maydon>
          </JonliForma>
        }
      />

      {error && <p className="text-[13px] text-brand">Tahlilni o‘qib bo‘lmadi.</p>}

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <Stat label="Ketganlar" value={t?.jami ?? 0} sub={`${t?.boshida ?? 0} ta o‘qiyotgan + ${t?.yangi ?? 0} ta yangi`} ton={t?.jami ? 'brand' : undefined} />
        <Stat label="Ketish koeffitsienti" value={t?.koeffitsient == null ? '—' : `${t.koeffitsient}%`} sub="ketganlar ÷ o‘qiganlar" />
        <Stat label="Yo‘qotilgan daromad" value={pul(t?.yoqotilgan ?? 0)} sub="oyiga · so‘m" />
        <Stat label="O‘rtacha o‘qigan" value={t?.orta_oy == null ? '—' : `${t.orta_oy} oy`} sub="kelgandan ketguncha" />
      </div>

      {belgilanmagan > 0 && (
        <Card className="px-5 py-3.5 text-[12.5px] text-ink-2">
          {belgilanmagan} ta o‘quvchining ketish sababi belgilanmagan.{' '}
          <Link href="/crm/arxiv" className="text-accent underline underline-offset-2 hover:text-brand">
            Arxivda sabab qo‘yish
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader title="Sabablar" meta="kishi" />
          <div className="px-5 pb-4">
            {(t?.sabablar ?? []).length === 0 ? (
              <Empty>Bu davrda ketgan yo‘q.</Empty>
            ) : (
              t!.sabablar.map((x) => <BarRow key={x.sabab} label={ketishNomi(x.sabab)} value={x.soni} max={maxSabab} format={soniFmt} />)
            )}
          </div>
        </Card>
        <Card className="flex flex-col">
          <CardHeader title="Ustozlar kesimi" meta="kishi" />
          <div className="px-5 pb-4">
            {(t?.ustozlar ?? []).length === 0 ? (
              <Empty>Ma’lumot yo‘q.</Empty>
            ) : (
              t!.ustozlar.map((x) => <BarRow key={x.ism} label={x.ism} value={x.soni} max={maxUstoz} format={soniFmt} />)
            )}
          </div>
        </Card>
        <Card className="flex flex-col">
          <CardHeader title="Fanlar kesimi" meta="kishi" />
          <div className="px-5 pb-4">
            {(t?.fanlar ?? []).length === 0 ? (
              <Empty>Ma’lumot yo‘q.</Empty>
            ) : (
              t!.fanlar.map((x) => <BarRow key={x.nom} label={x.nom} value={x.soni} max={maxFan} format={soniFmt} />)
            )}
          </div>
        </Card>
      </div>

      <Card className="flex flex-col">
        <CardHeader title="Ketganlar" meta={`${t?.royxat.length ?? 0} ta`} />
        {(t?.royxat ?? []).length === 0 ? (
          <div className="px-5 pb-5">
            <Empty>Bu davrda ketgan yo‘q.</Empty>
          </div>
        ) : (
          <ul className="flex flex-col">
            {t!.royxat.map((x) => (
              <li key={x.id}>
                <Link
                  href={`/crm/oquvchilar/${x.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-3 transition hover:bg-surface-2"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[13.5px] font-semibold">{x.fish}</span>
                    <span className="truncate text-[12px] text-ink-3">
                      {x.id} · {sana(x.sana)}
                      {x.izoh ? ` · ${x.izoh}` : ''}
                    </span>
                  </span>
                  <Badge ton={x.sabab === 'belgilanmagan' ? 'accent' : 'jim'}>{ketishNomi(x.sabab)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

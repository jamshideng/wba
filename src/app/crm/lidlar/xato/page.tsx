import Link from 'next/link'
import { talabRol, managermi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { IconArrowLeft } from '@/components/icons'
import { sana, joriyDavr, davrNomi, telefon } from '@/lib/format'
import { lidXatoQaytar, lidXatoOchir } from '../actions'

export const metadata = { title: 'Xato kiritilgan lidlar' }
export const dynamic = 'force-dynamic'

const YOL = '/crm/lidlar/xato'

/** Bazadagi vaqt UTC: kun va oy Toshkent bo'yicha */
const toshkentKuni = (vaqt: string) => new Date(vaqt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })

/** Konversiyaga kirmaydigan lidlar va kim nechta xato belgilagani (0114). Menyuda yo'q. */
export default async function XatoLidlar({ searchParams }: { searchParams: Promise<{ ok?: string; xato?: string }> }) {
  const profil = await talabRol('admin', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Xato kiritilgan lidlar" />

  const xabar = await searchParams
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('lid_xatolar')
  const royxat = data ?? []
  const davr = joriyDavr()

  const shuOy = new Map<string, number>()
  for (const l of royxat) {
    if (l.xato_at && toshkentKuni(l.xato_at).slice(0, 7) === davr) shuOy.set(l.belgiladi, (shuOy.get(l.belgiladi) ?? 0) + 1)
  }
  const ochiradi = managermi(profil.rol)

  return (
    <div className="flex max-w-3xl flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href="/crm/lidlar" className="flex items-center gap-2 text-[13px] text-ink-3 hover:text-ink">
        <IconArrowLeft size={15} /> Lidlar
      </Link>
      <Sarlavha nom="Xato kiritilgan lidlar" izoh={`${royxat.length} ta · konversiya va hisobotlarga kirmaydi`} />
      <Xabar ok={xabar.ok} xato={xabar.xato ?? (error ? 'Ro‘yxatni o‘qib bo‘lmadi.' : undefined)} />

      <Card className="flex flex-col">
        <CardHeader title="Kim belgilagan" meta={davrNomi(davr)} />
        <div className="flex flex-col px-5 pb-4 text-[13px]">
          {shuOy.size === 0 ? (
            <Empty>Bu oyda xato belgilanmagan.</Empty>
          ) : (
            [...shuOy].sort((a, b) => b[1] - a[1]).map(([ism, n]) => (
              <div key={ism} className="flex justify-between border-t border-line-soft py-2 first:border-t-0">
                <span>{ism}</span>
                <span className="tnum font-semibold">{n} ta</span>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="flex flex-col">
        <CardHeader title="Ro‘yxat" />
        {royxat.length === 0 ? (
          <div className="px-5 pb-5"><Empty>Xato kiritilgan lid yo‘q.</Empty></div>
        ) : (
          <ul className="flex flex-col">
            {royxat.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-3.5">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[13.5px] font-semibold">{l.ism}{l.telefon ? ` · ${telefon(l.telefon)}` : ''}</span>
                  <span className="text-[12px] text-ink-3">
                    {l.sabab} · {l.belgiladi}{l.xato_at ? ` · ${sana(toshkentKuni(l.xato_at))}` : ''}
                  </span>
                </span>
                <form action={lidXatoQaytar} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="qaytish" value={YOL} />
                  <Yuborish tur="ikkilamchi" kutish="…">Qaytarish</Yuborish>
                  {ochiradi && (
                    <button type="submit" formAction={lidXatoOchir} className="min-h-11 px-2 text-[12.5px] text-ink-3 hover:text-ink">
                      Butunlay o‘chirish
                    </button>
                  )}
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

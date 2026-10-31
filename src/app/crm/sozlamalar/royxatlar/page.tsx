import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Badge, Card, CardHeader } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar, kirishKlass } from '@/components/forma'
import { IconArrowLeft } from '@/components/icons'
import { Yuborish } from '@/components/yuborish'
import { ROYXAT_NOMI, ROYXAT_TURLARI, royxatOl } from '@/lib/royxat'
import { variantQosh, variantNomi, variantHolat } from './actions'

export const metadata = { title: 'Ro‘yxatlar' }
export const dynamic = 'force-dynamic'

/**
 * Tanlash ro'yxatlari (0108): variant qo'shish, nomini o'zgartirish, yashirish.
 * O'chirish yo'q — eski yozuvlar buzilmasin. Tizim variantlari yashirilmaydi.
 */
export default async function Royxatlar({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  await talabRol('admin', 'direktor', 'manager')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Ro‘yxatlar" />

  const s = await searchParams
  const supabase = await createClient()
  const royxatlar = await Promise.all(ROYXAT_TURLARI.map(async (tur) => ({ tur, bandlar: await royxatOl(supabase, tur) })))

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href="/crm/sozlamalar" className="inline-flex min-h-11 items-center gap-1.5 self-start text-[13px] text-ink-3 hover:text-ink">
        <IconArrowLeft size={16} /> Sozlamalar
      </Link>
      <Sarlavha nom="Ro‘yxatlar" izoh="tanlash maydonlaridagi variantlar" />
      <Xabar ok={s.ok} xato={s.xato} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {royxatlar.map(({ tur, bandlar }) => (
          <Card key={tur} className="flex flex-col">
            <CardHeader title={ROYXAT_NOMI[tur].nom} meta={ROYXAT_NOMI[tur].izoh} />
            <form action={variantQosh} className="flex gap-2 px-5 pb-3">
              <input type="hidden" name="tur" value={tur} />
              <input name="nom" required maxLength={60} placeholder="Yangi variant" aria-label={`${ROYXAT_NOMI[tur].nom}: yangi variant`} className={`${kirishKlass} min-w-0 flex-1`} />
              <Yuborish kutish="…">Qo‘shish</Yuborish>
            </form>
            <ul>
              {bandlar.map((b) => (
                <li key={b.kalit} className={`flex items-center gap-2 border-t border-line-soft px-5 py-2 ${b.faol ? '' : 'opacity-60'}`}>
                  <form action={variantNomi} className="flex min-w-0 flex-1 items-center gap-2">
                    <input type="hidden" name="tur" value={tur} />
                    <input type="hidden" name="kalit" value={b.kalit} />
                    <input name="nom" required maxLength={60} defaultValue={b.nom} aria-label={`${b.nom}: nomi`} className={`${kirishKlass} min-w-0 flex-1`} />
                    <Yuborish tur="ikkilamchi" kutish="…">Saqlash</Yuborish>
                  </form>
                  {b.tizim ? (
                    <span title="Tizimda ishlatiladi: nomini o‘zgartirsa bo‘ladi, yashirib bo‘lmaydi"><Badge>tizim</Badge></span>
                  ) : (
                    <form action={variantHolat}>
                      <input type="hidden" name="tur" value={tur} />
                      <input type="hidden" name="kalit" value={b.kalit} />
                      <input type="hidden" name="faol" value={b.faol ? '0' : '1'} />
                      <Yuborish tur="ikkilamchi" kutish="…">{b.faol ? 'Yashirish' : 'Qaytarish'}</Yuborish>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}

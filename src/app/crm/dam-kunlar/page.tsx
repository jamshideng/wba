import { talabRol, adminmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { sana, bugunToshkent, haftaKuni, HAFTA_KUNLARI } from '@/lib/format'
import { damKunQosh, damKunOchir } from './actions'

export const metadata = { title: 'Dam olish kunlari' }
export const dynamic = 'force-dynamic'

/**
 * Kanikul va bayramlar — butun markazda dars yo'q kunlar (0036).
 * Bu kunlari davomat so'ralmaydi, jurnalda ustun "dam" bo'ladi,
 * hisobotda "belgilanmagan dars" bo'lib chiqmaydi.
 */
export default async function DamKunlar({ searchParams }: { searchParams: Promise<{ ok?: string; xato?: string }> }) {
  const profil = await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Dam olish kunlari" />

  const xabar = await searchParams
  const bugun = bugunToshkent()
  const supabase = await createClient()
  const { data } = await supabase.from('dam_kunlar').select('sana, sabab').order('sana', { ascending: false }).limit(200)
  const royxat = (data ?? []) as { sana: string; sabab: string }[]
  const kelajak = royxat.filter((d) => d.sana >= bugun).reverse()
  const otgan = royxat.filter((d) => d.sana < bugun)
  const yozadi = adminmi(profil.rol)

  const Qator = ({ d }: { d: { sana: string; sabab: string } }) => (
    <li className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-line-soft px-5 py-2 last:border-0">
      <span className="flex flex-col">
        <span className="text-[13.5px] font-semibold">
          {sana(d.sana)} <span className="font-normal text-ink-3">· {HAFTA_KUNLARI[haftaKuni(d.sana) - 1].nom}</span>
          {d.sana === bugun && <span className="ml-2 text-[11.5px] text-accent">bugun</span>}
        </span>
        <span className="text-[12px] text-ink-3">{d.sabab}</span>
      </span>
      {yozadi && (
        <form action={damKunOchir}>
          <input type="hidden" name="sana" value={d.sana} />
          <button type="submit" className="min-h-11 px-2 text-[12px] text-ink-3 transition hover:text-brand">
            Bekor qilish
          </button>
        </form>
      )}
    </li>
  )

  return (
    <div className="flex max-w-3xl flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Dam olish kunlari" izoh="kanikul va bayram — butun markazda dars yo‘q" />
      <Xabar ok={xabar.ok} xato={xabar.xato} />

      {yozadi && (
        <Card className="flex flex-col">
          <CardHeader title="Dam kuni qo‘shish" meta="bir kun yoki oraliq" />
          <form action={damKunQosh} className="flex flex-col gap-3 px-5 pb-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
              <Maydon nom="Sana (dan)">
                <input type="date" name="dan" required defaultValue={bugun} className={kirishKlass} />
              </Maydon>
              <Maydon nom="Gacha" izoh="bo‘sh — bitta kun">
                <input type="date" name="gacha" className={kirishKlass} />
              </Maydon>
              <Maydon nom="Sabab">
                <input name="sabab" required placeholder="Masalan: Ustozlar kuni" className={kirishKlass} />
              </Maydon>
            </div>
            <p className="text-[12px] text-ink-3">
              Bu kunlari ustozdan davomat so‘ralmaydi, jurnalda ustun “dam” bo‘ladi, hisobotda “belgilanmagan dars” chiqmaydi.
              To‘lov hisobiga ta’sir qilmaydi — kerak bo‘lsa o‘quvchiga “Tuzatish” bilan ayiriladi.
            </p>
            <Yuborish>Belgilash</Yuborish>
          </form>
        </Card>
      )}

      <Card className="flex flex-col">
        <CardHeader title="Oldinda" meta={`${kelajak.length} ta`} />
        {kelajak.length === 0 ? (
          <div className="px-5 pb-5"><Empty>Oldinda dam kuni belgilanmagan.</Empty></div>
        ) : (
          <ul className="flex flex-col">{kelajak.map((d) => <Qator key={d.sana} d={d} />)}</ul>
        )}
      </Card>

      {otgan.length > 0 && (
        <Card className="flex flex-col">
          <CardHeader title="O‘tganlari" meta={`${otgan.length} ta`} />
          <ul className="flex flex-col">{otgan.map((d) => <Qator key={d.sana} d={d} />)}</ul>
        </Card>
      )}
    </div>
  )
}

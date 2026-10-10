import Link from 'next/link'
import { redirect } from 'next/navigation'
import { talabProfil } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Badge, Button, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar } from '@/components/forma'
import { TAKLIF_HOLAT_NOMI, TAKLIF_HOLAT_TONI, kunOy, nechaKunQoldi, sanaVaqt, type Taklif } from '@/lib/market'
import { bugunToshkent } from '@/lib/format'
import { bozorKuni } from '../bozor'
import { TaklifForma } from './forma'

export const metadata = { title: 'Taklif · Woblar market' }
export const dynamic = 'force-dynamic'

/**
 * O'quvchi taklifi (0065): Marketda yo'q narsani so'raydi — keyingi bozorga
 * yoki umuman. Pastda — o'z takliflari va admin javobi.
 */
export default async function TaklifSahifasi({ searchParams }: { searchParams: Promise<{ ok?: string; xato?: string }> }) {
  const profil = await talabProfil()
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Taklif" />
  if (profil.rol !== 'oquvchi') redirect('/crm/market/boshqaruv?bolim=taklif')

  const s = await searchParams
  const supabase = await createClient()
  const [{ data: takliflar }, bozor] = await Promise.all([
    supabase.from('woblr_takliflar').select('*').order('created_at', { ascending: false }).limit(50),
    bozorKuni(supabase),
  ])
  const bozorOldinda = bozor && nechaKunQoldi(bozor, bugunToshkent()) >= 0 ? bozor : null
  const royxat = (takliflar ?? []) as Taklif[]

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 py-5">
      <Sarlavha
        nom="Taklif yuborish"
        izoh={bozorOldinda ? `keyingi bozor: ${kunOy(bozorOldinda)}` : 'Marketda yo‘q narsani so‘rang'}
        amal={<Button href="/crm/market" variant="ikkilamchi">Marketga qaytish</Button>}
      />
      <Xabar ok={s.ok} xato={s.xato} />

      <Card className="flex flex-col gap-4 p-5">
        <p className="text-[13px] leading-relaxed text-ink-2">
          Marketda yo‘q, lekin olishni istagan narsangizni yozing. Admin ko‘rib chiqadi — olib kelinsa, sizga xabar beramiz
          va u Marketda paydo bo‘ladi. Taklif uchun woblar yechilmaydi.
        </p>
        <TaklifForma uid={profil.id} bozorBor={Boolean(bozorOldinda)} />
      </Card>

      <Card className="flex flex-col">
        <CardHeader title="Takliflarim" meta={`${royxat.length} ta`} />
        {royxat.length === 0 ? (
          <div className="px-5 pb-5"><Empty>Hali taklif yubormagansiz.</Empty></div>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {royxat.map((t) => (
              <li key={t.id} className="flex flex-col gap-1.5 px-5 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold">{t.nom}</span>
                  <Badge ton={TAKLIF_HOLAT_TONI[t.holat]} nuqta>{TAKLIF_HOLAT_NOMI[t.holat]}</Badge>
                </div>
                <span className="text-[12px] text-ink-3">
                  {t.qachon === 'keyingi_bozor' ? 'Keyingi bozorga' : 'Umumiy taklif'} · {sanaVaqt(t.created_at)}
                  {t.taxminiy_narx ? ` · ~${t.taxminiy_narx} woblar` : ''}
                </span>
                {t.admin_javob && <span className="text-[13px] text-ink-2"><b>Admin:</b> {t.admin_javob}</span>}
                {t.holat === 'olib_kelindi' && (
                  <Link href="/crm/market" className="text-[13px] font-semibold text-ok underline underline-offset-2">Marketda ko‘rish →</Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

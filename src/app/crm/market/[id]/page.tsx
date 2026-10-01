import Link from 'next/link'
import { notFound } from 'next/navigation'
import { talabProfil, adminmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Badge, Button } from '@/components/ui'
import { Ulanmagan } from '@/components/crm'
import { Xabar } from '@/components/forma'
import { IconArrowLeft } from '@/components/icons'
import { omborMatni, kelishSanasi, kunOy, type Mahsulot } from '@/lib/market'
import { Woblar } from '../bolaklar'
import { SotibOlish } from '../sotib-olish'
import { Galereya } from '../galereya'
import { bozorKuni } from '../bozor'

export const metadata = { title: 'Mahsulot · Woblar market' }
export const dynamic = 'force-dynamic'

export default async function MahsulotSahifasi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ xato?: string }>
}) {
  const profil = await talabProfil()
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Woblar market" />

  const [{ id }, s] = await Promise.all([params, searchParams])
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const supabase = await createClient()
  const { data } = await supabase.from('woblr_rewards').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()
  const m = data as Mahsulot
  if (m.holat !== 'faol' && !adminmi(profil.rol)) notFound()

  const { data: men } = profil.rol === 'oquvchi'
    ? await supabase.from('students').select('id').eq('profile_id', profil.id).maybeSingle()
    : { data: null }
  const { data: bal } = men
    ? await supabase.from('v_woblr_balance').select('balans').eq('student_id', men.id).maybeSingle()
    : { data: null }
  const balans = bal ? Number(bal.balans) || 0 : null

  const bozor = await bozorKuni(supabase)
  const oldindan = m.rejim === 'oldindan'
  const qachon = kelishSanasi(m, bozor)
  const ombor = omborMatni(m)
  const maks = m.cheksiz ? 5 : Math.min(5, m.qolgan_soni)

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href="/crm/market" className="flex items-center gap-2 text-[13px] text-ink-3 transition hover:text-ink">
        <IconArrowLeft size={15} /> Woblar market
      </Link>
      <Xabar xato={s.xato} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
        <Galereya rasmlar={m.rasmlar?.length ? m.rasmlar : m.rasm_url ? [m.rasm_url] : []} nom={m.nom} />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {m.toifa && <span className="lbl">{m.toifa}</span>}
            <h1 className="h-display text-[26px] leading-tight text-pretty">{m.nom}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <Woblar son={m.narx_ball} katta />
              <Badge ton={ombor.tugagan ? 'jim' : ombor.kam ? 'brand' : 'ok'}>{ombor.matn}</Badge>
              {m.holat !== 'faol' && <Badge ton="jim">sotuvda emas</Badge>}
            </div>
          </div>

          {oldindan && (
            <div className="flex flex-col gap-1.5 rounded-[12px] border border-accent-line bg-accent-soft px-4 py-3.5">
              <span className="text-[14px] font-bold text-ink">
                Oldindan buyurtma{qachon ? ` — ${kunOy(qachon)} kuni keladi` : ' — bozor kuni keladi'}
              </span>
              <span className="text-[12.5px] leading-relaxed text-ink-2">
                Tovar hali markazda yo‘q. Hozir zakaz bersangiz, woblaringiz band qilinadi va tovar
                kelishi bilan sizga xabar beramiz — keyin markazdan olib ketasiz.
              </span>
            </div>
          )}

          {m.tavsif && <p className="text-[14px] leading-relaxed whitespace-pre-line text-ink-2">{m.tavsif}</p>}

          <Card className="flex flex-col gap-3 p-4">
            {balans !== null ? (
              <>
                <span className="flex items-center justify-between text-[13px] text-ink-2">
                  Sizning woblaringiz <Woblar son={balans} />
                </span>
                {ombor.tugagan || m.holat !== 'faol' ? (
                  <span className="rounded-[10px] bg-surface-2 py-3 text-center text-[13.5px] text-ink-3">Hozir olib bo‘lmaydi</span>
                ) : (
                  <SotibOlish rewardId={m.id} narx={m.narx_ball} balans={balans} maks={maks} oldindan={oldindan} />
                )}
              </>
            ) : (
              <span className="text-[13px] text-ink-3">
                Sotib olishni o‘quvchi o‘z hisobidan qiladi.
                {adminmi(profil.rol) && (
                  <>
                    {' '}
                    <Link href={`/crm/market/boshqaruv/mahsulot/${m.id}`} className="font-semibold text-accent hover:text-brand">Tahrirlash</Link>
                  </>
                )}
              </span>
            )}
          </Card>

          <ol className="flex flex-col gap-1.5 text-[12.5px] text-ink-3">
            {oldindan ? (
              <>
                <li>1. “Oldindan olish”ni bosing — woblar band qilinadi, chek kodi beriladi.</li>
                <li>2. Tovar kelganda Telegram’da xabar olasiz.</li>
                <li>3. Markazga kelib, kodni adminga ko‘rsating — sovg‘angizni beradi.</li>
                <li>Fikringiz o‘zgarsa, olib ketguningizcha bekor qilasiz — woblar qaytadi.</li>
              </>
            ) : (
              <>
                <li>1. “Olish”ni bosing — woblar yechiladi, chek kodi beriladi.</li>
                <li>2. Kodni adminga ko‘rsating — sovg‘angizni beradi.</li>
                <li>3. Fikringiz o‘zgarsa, olib ketguningizcha bekor qilishingiz mumkin — woblar qaytadi.</li>
              </>
            )}
          </ol>
          {profil.rol === 'oquvchi' && (
            <Button href="/crm/market/buyurtmalar" variant="ikkilamchi">Buyurtmalarim</Button>
          )}
        </div>
      </div>
    </div>
  )
}

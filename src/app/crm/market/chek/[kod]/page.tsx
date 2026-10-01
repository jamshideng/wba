import Link from 'next/link'
import { notFound } from 'next/navigation'
import { talabProfil, staffmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Badge, Button } from '@/components/ui'
import { Ulanmagan } from '@/components/crm'
import { Xabar } from '@/components/forma'
import { IconArrowLeft } from '@/components/icons'
import { HOLAT_NOMI, HOLAT_TONI, kodNormal, sanaVaqt, type Buyurtma } from '@/lib/market'
import { MahsulotRasm, Woblar } from '../../bolaklar'
import { buyurtmaBerildi, buyurtmaKeldi, buyurtmaniBekorQil } from '../../actions'

export const metadata = { title: 'Chek · Woblar market' }
export const dynamic = 'force-dynamic'

/**
 * Chek — o'quvchi shu sahifani (yoki kodni) adminga ko'rsatadi.
 * RLS: o'quvchi faqat o'z chekini, xodim hammasini ko'radi.
 */
export default async function Chek({
  params,
  searchParams,
}: {
  params: Promise<{ kod: string }>
  searchParams: Promise<{ yangi?: string; ok?: string; xato?: string }>
}) {
  const profil = await talabProfil()
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Woblar market" />

  const [p, s] = await Promise.all([params, searchParams])
  const kod = kodNormal(decodeURIComponent(p.kod))
  if (!kod) notFound()

  const supabase = await createClient()
  const { data } = await supabase.from('woblr_redemptions').select('*').eq('kod', kod).maybeSingle()
  if (!data) notFound()
  const b = data as Buyurtma

  const [{ data: m }, { data: oquvchi }] = await Promise.all([
    supabase.from('woblr_rewards').select('nom, rasm_url, narx_ball').eq('id', b.reward_id).maybeSingle(),
    supabase.from('students').select('fish').eq('id', b.student_id).maybeSingle(),
  ])

  const xodim = staffmi(profil.rol)
  const yol = `/crm/market/chek/${kod}`
  const nom = b.mahsulot_nomi ?? m?.nom ?? 'Mahsulot'

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Link
        href={xodim ? '/crm/market/boshqaruv' : '/crm/market/buyurtmalar'}
        className="flex items-center gap-2 text-[13px] text-ink-3 transition hover:text-ink"
      >
        <IconArrowLeft size={15} /> {xodim ? 'Boshqaruv' : 'Buyurtmalarim'}
      </Link>
      <Xabar ok={s.ok} xato={s.xato} />
      {s.yangi && b.holat === 'kutilmoqda' && (
        <p role="status" className="rounded-[10px] border border-ok bg-ok-soft px-4 py-3 text-[13.5px] text-ok">
          Buyurtma qabul qilindi! Quyidagi kodni adminga ko‘rsating — sovg‘angizni beradi.
        </p>
      )}
      {s.yangi && b.holat === 'buyurtma' && (
        <p role="status" className="rounded-[10px] border border-ok bg-ok-soft px-4 py-3 text-[13.5px] text-ok">
          Oldindan buyurtma qabul qilindi! Woblaringiz band qilindi. Tovar kelishi bilan Telegram’da xabar beramiz —
          keyin markazga kelib, shu kodni adminga ko‘rsatasiz.
        </p>
      )}

      <Card className="mx-auto flex w-full max-w-md flex-col overflow-hidden">
        <div className="flex flex-col items-center gap-2 border-b border-dashed border-line bg-surface-2 px-5 py-6 text-center">
          <span className="lbl">Chek kodi</span>
          <span className="tnum font-[family-name:var(--font-display)] text-[38px] leading-none font-extrabold tracking-[0.06em] text-ink select-all">
            {kod}
          </span>
          <Badge ton={HOLAT_TONI[b.holat]} nuqta>{HOLAT_NOMI[b.holat]}</Badge>
        </div>

        <div className="flex items-center gap-3 px-5 py-4">
          <MahsulotRasm url={m?.rasm_url ?? null} nom={nom} className="size-16! shrink-0 rounded-[10px]" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[14.5px] font-semibold text-ink">{nom}{b.soni > 1 ? ` × ${b.soni}` : ''}</span>
            <Woblar son={b.ball} />
          </div>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-line px-5 py-4 text-[13px]">
          <dt className="text-ink-3">O‘quvchi</dt>
          <dd className="text-right text-ink">{oquvchi?.fish ?? '—'}</dd>
          <dt className="text-ink-3">Buyurtma vaqti</dt>
          <dd className="tnum text-right text-ink">{sanaVaqt(b.created_at)}</dd>
          {b.holat === 'berildi' && (
            <>
              <dt className="text-ink-3">Berilgan vaqt</dt>
              <dd className="tnum text-right text-ink">{sanaVaqt(b.berildi_vaqt)}</dd>
            </>
          )}
          {b.holat === 'bekor' && (
            <>
              <dt className="text-ink-3">Bekor sababi</dt>
              <dd className="text-right text-ink">{b.bekor_sabab ?? '—'} · woblar qaytarilgan</dd>
            </>
          )}
        </dl>

        {(b.holat === 'kutilmoqda' || b.holat === 'buyurtma') && (
          <div className="flex flex-col gap-2 border-t border-line px-5 py-4">
            {xodim ? (
              <>
                {b.holat === 'buyurtma' && (
                  <form action={buyurtmaKeldi}>
                    <input type="hidden" name="kod" value={kod} />
                    <input type="hidden" name="qaytish" value={yol} />
                    <Button type="submit" variant="ikkilamchi" className="w-full">Tovar keldi — o‘quvchiga xabar berish</Button>
                  </form>
                )}
                <form action={buyurtmaBerildi}>
                  <input type="hidden" name="kod" value={kod} />
                  <Button type="submit" className="w-full">Berildi deb belgilash</Button>
                </form>
              </>
            ) : b.holat === 'buyurtma' ? (
              <p className="text-center text-[12.5px] leading-relaxed text-ink-3">
                Tovar hali kelmagan. Kelishi bilan xabar beramiz — keyin markazga kelib, kodni adminga ko‘rsatasiz.
                Fikringiz o‘zgarsa, bekor qilishingiz mumkin — woblar qaytadi.
              </p>
            ) : (
              <p className="text-center text-[12.5px] text-ink-3">
                Kodni adminga ko‘rsating. Olib ketguningizcha bekor qilsangiz, woblar qaytadi.
              </p>
            )}
            <form action={buyurtmaniBekorQil} className="flex flex-col gap-2">
              <input type="hidden" name="kod" value={kod} />
              <input type="hidden" name="qaytish" value={yol} />
              {xodim && (
                <input
                  name="sabab"
                  placeholder="Bekor sababi (ixtiyoriy)"
                  className="min-h-11 w-full rounded-[9px] border border-line bg-surface px-3 text-[13.5px] text-ink placeholder:text-ink-4"
                />
              )}
              <Button type="submit" variant="ikkilamchi" className="w-full">
                Buyurtmani bekor qilish
              </Button>
            </form>
          </div>
        )}
      </Card>

      {!xodim && (
        <div className="flex justify-center">
          <Button href="/crm/market" variant="ikkilamchi">Marketga qaytish</Button>
        </div>
      )}
    </div>
  )
}

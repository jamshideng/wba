import { redirect } from 'next/navigation'
import { talabProfil, panelYoli } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Empty, Stat, Badge } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { sana, vaqt, kunlarNomi, haftaKuni, HAFTA_KUNLARI } from '@/lib/format'
import { probniyYozilmoqchi } from './actions'

export const metadata = { title: 'Sinov darslarim' }
export const dynamic = 'force-dynamic'

type Kabinet = {
  holat: 'sinov' | 'oquvchi' | 'yoqotildi' | 'yopiq' | 'kutilmoqda'
  ism: string
  sinov_sana: string | null
  yozilmoqchi: boolean
  guruh: { nom: string; boshlanish: string; tugash: string; kunlar: number[]; fan: string | null; ustoz: string | null } | null
  darslar: string[]
  davomat: { sana: string; holat: string }[]
  woblar: number
}

/**
 * Probniy kabineti (0102). Sinov darsiga yozilgan bola va ota-onasi uchun:
 * guruh va ustoz, keyingi darslar, probniy davomati, woblar,
 * "Guruhga yozilmoqchiman". Narx ko'rsatilmaydi (Jamshid, 25.10).
 * Hamma ma'lumot bitta definer funksiyadan — boshqa hech kim ko'rinmaydi.
 */
export default async function ProbniyKabinet({ searchParams }: { searchParams: Promise<{ ok?: string; xato?: string }> }) {
  const profil = await talabProfil()
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Sinov darslarim" />
  if (profil.rol !== 'probniy') redirect(panelYoli(profil.rol))

  const s = await searchParams
  const supabase = await createClient()
  const { data } = await supabase.rpc('probniy_kabinet')
  const k = data as unknown as Kabinet | null

  if (!k || k.holat === 'yopiq' || k.holat === 'kutilmoqda') {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 py-5">
        <Sarlavha nom="Sinov darslarim" izoh="World Bridge Academy" />
        <Card className="p-5">
          <Empty>Sinov davri tugagan. Qaytadan yozilish uchun markaz administratori bilan bog‘laning.</Empty>
        </Card>
      </div>
    )
  }

  const kelgan = k.davomat.filter((d) => d.holat === 'keldi' || d.holat === 'kechikdi').length

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 py-5">
      <Sarlavha nom={`Assalomu alaykum, ${k.ism}!`} izoh="Sinov darslaringiz · World Bridge Academy" />
      <Xabar ok={s.ok} xato={s.xato} />

      {k.holat === 'oquvchi' && (
        <Card className="p-5">
          <p className="text-[14px] font-semibold text-ok">Tabriklaymiz — siz guruhga yozildingiz! Sahifani yangilang, o‘quvchi kabinetingiz ochiladi.</p>
        </Card>
      )}
      {k.holat === 'yoqotildi' && (
        <Card className="p-5">
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            Sinov davri yakunlandi. Fikringiz o‘zgarsa — administratorga yozing, sizni guruhga qaytadan taklif qilamiz.
          </p>
        </Card>
      )}

      {k.guruh && (
        <Card className="flex flex-col gap-3 p-5">
          <span className="lbl">Guruhingiz</span>
          <span className="text-[16px] font-bold">{k.guruh.fan ?? k.guruh.nom.split(' · ')[0]}</span>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13.5px]">
            <dt className="text-ink-3">Ustoz</dt>
            <dd className="font-semibold">{k.guruh.ustoz ?? '[ANIQLANMAGAN]'}</dd>
            <dt className="text-ink-3">Dars kunlari</dt>
            <dd>{kunlarNomi(k.guruh.kunlar)}</dd>
            <dt className="text-ink-3">Vaqti</dt>
            <dd className="tnum">{vaqt(k.guruh.boshlanish)}–{vaqt(k.guruh.tugash)}</dd>
            {k.sinov_sana && (
              <>
                <dt className="text-ink-3">Sinov darsi</dt>
                <dd>{sana(k.sinov_sana)}</dd>
              </>
            )}
          </dl>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Stat label="Qatnashgan darslar" value={String(kelgan)} sub={`${k.davomat.length} ta dars belgilangan`} href="/crm/probniy?b=keldi" />
        <Stat label="Woblar" value={String(k.woblar)} sub="guruhga yozilsangiz saqlanadi" ton="accent" />
      </div>

      {k.holat === 'sinov' && k.darslar.length > 0 && (
        <Card className="flex flex-col">
          <CardHeader title="Keyingi darslar" meta="2 hafta" />
          <ul className="flex flex-col divide-y divide-line px-5 pb-3">
            {k.darslar.slice(0, 6).map((d) => (
              <li key={d} className="flex items-center justify-between py-2.5 text-[13.5px]">
                <span>{sana(d)} · {HAFTA_KUNLARI[haftaKuni(d) - 1].nom}</span>
                {k.guruh && <span className="tnum text-ink-3">{vaqt(k.guruh.boshlanish)}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {k.davomat.length > 0 && (
        <Card className="flex flex-col">
          <CardHeader title="Davomat" meta={`${kelgan} / ${k.davomat.length}`} />
          <ul className="flex flex-col divide-y divide-line px-5 pb-3">
            {k.davomat.map((d) => (
              <li
                key={d.sana}
                data-belgi={d.holat === 'keldi' || d.holat === 'kechikdi' ? 'keldi' : undefined}
                className="flex items-center justify-between py-2.5 text-[13.5px]"
              >
                <span>{sana(d.sana)}</span>
                <Badge ton={d.holat === 'keldi' || d.holat === 'kechikdi' ? 'ok' : 'brand'}>
                  {d.holat === 'keldi' || d.holat === 'kechikdi' ? 'Keldi' : 'Kelmadi'}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {k.holat === 'sinov' && (
        <Card className="flex flex-col gap-3 p-5">
          <span className="text-[15px] font-bold">Guruhga yozilmoqchimisiz?</span>
          <p className="text-[13px] leading-relaxed text-ink-2">
            Bosing — administrator siz bilan bog‘lanadi va joyni band qiladi. Sinovda yig‘gan woblaringiz saqlanadi.
          </p>
          {k.yozilmoqchi ? (
            <Badge ton="ok">So‘rov yuborilgan — administrator bog‘lanadi</Badge>
          ) : (
            <form action={probniyYozilmoqchi}>
              <Yuborish kutish="Yuborilmoqda…">Guruhga yozilmoqchiman</Yuborish>
            </form>
          )}
        </Card>
      )}
    </div>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { talabProfil, staffmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Empty, Badge, Button } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar } from '@/components/forma'
import { HOLAT_NOMI, HOLAT_TONI, sanaVaqt, type Buyurtma } from '@/lib/market'
import { Woblar } from '../bolaklar'

export const metadata = { title: 'Buyurtmalarim · Woblar market' }
export const dynamic = 'force-dynamic'

/** O'quvchining o'z buyurtmalari — avval olib ketilmaganlari. */
export default async function Buyurtmalarim({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  const profil = await talabProfil()
  if (staffmi(profil.rol)) redirect('/crm/market/boshqaruv')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Buyurtmalarim" />

  const s = await searchParams
  const supabase = await createClient()
  const { data: men } = await supabase.from('students').select('id').eq('profile_id', profil.id).maybeSingle()
  const { data } = men
    ? await supabase
        .from('woblr_redemptions')
        .select('*')
        .eq('student_id', men.id)
        .not('kod', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: [] }
  const ro = (data ?? []) as Buyurtma[]
  const kutilmoqda = ro.filter((b) => b.holat === 'kutilmoqda')
  const kelmagan = ro.filter((b) => b.holat === 'buyurtma')
  const qolgan = ro.filter((b) => b.holat === 'berildi' || b.holat === 'bekor')

  const Qator = ({ b }: { b: Buyurtma }) => (
    <li>
      <Link
        href={`/crm/market/chek/${b.kod}`}
        className="flex min-h-14 items-center gap-3 px-4 py-3 transition hover:bg-surface-2"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[13.5px] font-semibold">
            {b.mahsulot_nomi ?? 'Mahsulot'}{b.soni > 1 ? ` × ${b.soni}` : ''}
          </span>
          <span className="tnum text-[12px] text-ink-3">{b.kod} · {sanaVaqt(b.created_at)}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Woblar son={b.ball} />
          <Badge ton={HOLAT_TONI[b.holat]}>{HOLAT_NOMI[b.holat]}</Badge>
        </span>
      </Link>
    </li>
  )

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Buyurtmalarim"
        izoh="woblar marketdan olganlaringiz"
        amal={<Button href="/crm/market" variant="ikkilamchi">Marketga</Button>}
      />
      <Xabar ok={s.ok} xato={s.xato} />

      {ro.length === 0 ? (
        <Card className="p-6">
          <Empty>Hali buyurtma yo‘q. Marketdan sovg‘a tanlang!</Empty>
        </Card>
      ) : (
        <>
          {kutilmoqda.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="lbl text-ok!">Tayyor — markazga kelib, kodni adminga ko‘rsating</h2>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-line">{kutilmoqda.map((b) => <Qator key={b.id} b={b} />)}</ul>
              </Card>
            </section>
          )}
          {kelmagan.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="lbl">Oldindan buyurtmalar — tovar kelishi kutilmoqda</h2>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-line">{kelmagan.map((b) => <Qator key={b.id} b={b} />)}</ul>
              </Card>
              <p className="text-[12px] text-ink-3">Tovar kelishi bilan Telegram’da xabar olasiz.</p>
            </section>
          )}
          {qolgan.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="lbl">Tarix</h2>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-line">{qolgan.map((b) => <Qator key={b.id} b={b} />)}</ul>
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  )
}

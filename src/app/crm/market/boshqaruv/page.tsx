import Link from 'next/link'
import { talabRol, adminmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Empty, Badge, Button, Stat } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar, kirishKlass } from '@/components/forma'
import { JonliForma } from '@/components/jonli-forma'
import { IconSearch } from '@/components/icons'
import { HOLAT_NOMI, HOLAT_TONI, omborMatni, sanaVaqt, type Buyurtma, type BuyurtmaHolati, type Mahsulot } from '@/lib/market'
import { joriyDavr } from '@/lib/format'
import { buyurtmaBerildi, kodniOch } from '../actions'
import { MahsulotRasm, Woblar } from '../bolaklar'

export const metadata = { title: 'Market boshqaruvi' }
export const dynamic = 'force-dynamic'

const HOLATLAR: (BuyurtmaHolati | 'hammasi')[] = ['kutilmoqda', 'berildi', 'bekor', 'hammasi']

/**
 * Market boshqaruvi — xodim uchun.
 * Buyurtmalar: o'quvchi kodni ko'rsatadi → kod yoziladi → "Berildi".
 * Mahsulotlar: faqat admin/direktor qo'shadi va o'zgartiradi.
 */
export default async function Boshqaruv({
  searchParams,
}: {
  searchParams: Promise<{ bolim?: string; holat?: string; q?: string; ok?: string; xato?: string }>
}) {
  const profil = await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Market boshqaruvi" />

  const s = await searchParams
  const supabase = await createClient()
  const admin = adminmi(profil.rol)
  const bolim = s.bolim === 'mahsulot' && admin ? 'mahsulot' : 'buyurtma'
  const holat = HOLATLAR.find((h) => h === s.holat) ?? 'kutilmoqda'
  const qidiruv = (s.q ?? '').trim().replace(/[%_,()"\\]/g, ' ').trim()

  const oyBoshi = `${joriyDavr()}-01`
  const [{ count: kutilmoqdaSoni }, { data: oyBerilgan }] = await Promise.all([
    supabase.from('woblr_redemptions').select('id', { count: 'exact', head: true }).eq('holat', 'kutilmoqda'),
    supabase.from('woblr_redemptions').select('ball').eq('holat', 'berildi').gte('berildi_vaqt', oyBoshi),
  ])
  const oyWoblar = (oyBerilgan ?? []).reduce((a, r) => a + (Number(r.ball) || 0), 0)

  const tablar = (
    <nav className="flex gap-1.5" aria-label="Bo‘limlar">
      {[
        { k: 'buyurtma', nom: `Buyurtmalar${kutilmoqdaSoni ? ` · ${kutilmoqdaSoni}` : ''}` },
        ...(admin ? [{ k: 'mahsulot', nom: 'Mahsulotlar' }] : []),
      ].map((t) => (
        <Link
          key={t.k}
          href={t.k === 'buyurtma' ? '/crm/market/boshqaruv' : '/crm/market/boshqaruv?bolim=mahsulot'}
          aria-current={bolim === t.k ? 'page' : undefined}
          className={`flex min-h-11 items-center rounded-full border px-4 text-[13px] font-semibold transition ${
            bolim === t.k ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2 hover:border-ink-3 hover:text-ink'
          }`}
        >
          {t.nom}
        </Link>
      ))}
    </nav>
  )

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Woblar market"
        izoh="buyurtmalar va mahsulotlar"
        amal={
          <span className="flex flex-wrap gap-2">
            <Button href="/crm/market" variant="ikkilamchi">Vitrina</Button>
            {admin && <Button href="/crm/market/boshqaruv/mahsulot/yangi">Yangi mahsulot</Button>}
          </span>
        }
      />
      <Xabar ok={s.ok} xato={s.xato} />

      <div className="grid max-w-2xl grid-cols-2 gap-3">
        <Stat label="Olib ketilmagan" value={String(kutilmoqdaSoni ?? 0)} ton={kutilmoqdaSoni ? 'accent' : 'neytral'} />
        <Stat label="Shu oy berildi" value={String(oyBerilgan?.length ?? 0)} sub={`${oyWoblar.toLocaleString('ru-RU')} woblar`} />
      </div>

      {tablar}

      {bolim === 'buyurtma' ? (
        <BuyurtmalarBolimi holat={holat} qidiruv={qidiruv} q={s.q} />
      ) : (
        <MahsulotlarBolimi />
      )}
    </div>
  )
}

async function BuyurtmalarBolimi({ holat, qidiruv, q }: { holat: BuyurtmaHolati | 'hammasi'; qidiruv: string; q?: string }) {
  const supabase = await createClient()

  // Qidiruv: kod, mahsulot nomi yoki o'quvchi ismi
  let oquvchiIdlar: string[] = []
  if (qidiruv) {
    const { data } = await supabase.from('students').select('id').ilike('fish', `%${qidiruv}%`).limit(50)
    oquvchiIdlar = (data ?? []).map((r) => r.id)
  }

  let soorov = supabase.from('woblr_redemptions').select('*').not('kod', 'is', null)
  if (holat !== 'hammasi') soorov = soorov.eq('holat', holat)
  if (qidiruv) {
    const shartlar = [`kod.ilike.%${qidiruv}%`, `mahsulot_nomi.ilike.%${qidiruv}%`]
    if (oquvchiIdlar.length) shartlar.push(`student_id.in.(${oquvchiIdlar.join(',')})`)
    soorov = soorov.or(shartlar.join(','))
  }
  const { data } = await soorov
    .order('created_at', { ascending: holat === 'kutilmoqda' })
    .limit(200)
  const ro = (data ?? []) as Buyurtma[]

  const idlar = [...new Set(ro.map((b) => b.student_id))]
  const { data: oquvchilar } = idlar.length
    ? await supabase.from('students').select('id, fish').in('id', idlar)
    : { data: [] }
  const ism = new Map((oquvchilar ?? []).map((o) => [o.id, o.fish as string]))

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2 border-accent-line! bg-accent-soft! p-4">
        <span className="lbl">O‘quvchi kodini kiriting</span>
        <form action={kodniOch} className="flex flex-wrap gap-2">
          <input
            name="kod"
            required
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="WM-7K4P2X"
            className={`${kirishKlass} tnum max-w-xs flex-1 uppercase tracking-[0.06em]`}
          />
          <Button type="submit">Chekni ochish</Button>
        </form>
      </Card>

      <JonliForma className="flex flex-wrap items-end gap-2.5">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-sm">
          <span className="lbl">Qidiruv</span>
          <span className="flex min-h-11 items-center gap-2.5 rounded-[9px] border border-line bg-surface px-3">
            <IconSearch size={15} />
            <input
              name="q"
              type="search"
              autoComplete="off"
              defaultValue={q ?? ''}
              placeholder="Kod, o‘quvchi yoki mahsulot…"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-4"
            />
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="lbl">Holat</span>
          <select name="holat" defaultValue={holat} className={kirishKlass}>
            {HOLATLAR.map((h) => (
              <option key={h} value={h}>{h === 'hammasi' ? 'Hammasi' : HOLAT_NOMI[h]}</option>
            ))}
          </select>
        </label>
      </JonliForma>

      {ro.length === 0 ? (
        <Card className="p-6">
          <Empty>{qidiruv ? 'Topilmadi.' : holat === 'kutilmoqda' ? 'Olib ketilmagan buyurtma yo‘q.' : 'Buyurtma yo‘q.'}</Empty>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {ro.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Link href={`/crm/market/chek/${b.kod}`} className="flex min-w-0 flex-1 flex-col gap-0.5 hover:text-brand">
                  <span className="truncate text-[13.5px] font-semibold">
                    {ism.get(b.student_id) ?? '—'}
                  </span>
                  <span className="truncate text-[12.5px] text-ink-2">
                    {b.mahsulot_nomi ?? 'Mahsulot'}{b.soni > 1 ? ` × ${b.soni}` : ''}
                  </span>
                  <span className="tnum text-[11.5px] text-ink-3">{b.kod} · {sanaVaqt(b.created_at)}</span>
                </Link>
                <span className="flex items-center gap-3">
                  <Woblar son={b.ball} />
                  {b.holat === 'kutilmoqda' ? (
                    <form action={buyurtmaBerildi}>
                      <input type="hidden" name="kod" value={b.kod ?? ''} />
                      <Button type="submit">Berildi</Button>
                    </form>
                  ) : (
                    <Badge ton={HOLAT_TONI[b.holat]}>{HOLAT_NOMI[b.holat]}</Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

async function MahsulotlarBolimi() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('woblr_rewards')
    .select('*')
    .order('holat', { ascending: true })
    .order('tartib', { ascending: false })
    .order('created_at', { ascending: false })
  const ro = (data ?? []) as Mahsulot[]

  if (ro.length === 0) {
    return (
      <Card className="p-6">
        <Empty>Hali mahsulot yo‘q. “Yangi mahsulot” orqali birinchisini qo‘shing.</Empty>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-line">
        {ro.map((m) => {
          const ombor = omborMatni(m)
          return (
            <li key={m.id}>
              <Link
                href={`/crm/market/boshqaruv/mahsulot/${m.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2"
              >
                <MahsulotRasm url={m.rasm_url} nom={m.nom} className="size-14! shrink-0 rounded-[9px]" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[13.5px] font-semibold">{m.nom}</span>
                  <span className="text-[12px] text-ink-3">{m.toifa ?? 'Toifasiz'}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Woblar son={m.narx_ball} />
                  <span className="flex gap-1">
                    {m.holat !== 'faol' && <Badge ton="jim">yopilgan</Badge>}
                    <Badge ton={ombor.tugagan ? 'brand' : ombor.kam ? 'accent' : 'ok'}>{ombor.matn}</Badge>
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

import Link from 'next/link'
import { talabRol, adminmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Empty, Badge, Button, Stat } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar, kirishKlass } from '@/components/forma'
import { JonliForma } from '@/components/jonli-forma'
import { IconSearch } from '@/components/icons'
import { HOLAT_NOMI, HOLAT_TONI, kelishSanasi, kunOy, nechaKunQoldi, omborMatni, sanaVaqt, type Buyurtma, type BuyurtmaHolati, type Mahsulot } from '@/lib/market'
import { bugunToshkent, joriyDavr } from '@/lib/format'
import { bozorSanasi, buyurtmaBerildi, buyurtmaKeldi, kodniOch, mahsulotKeldi } from '../actions'
import { MahsulotRasm, Woblar } from '../bolaklar'
import { TakliflarBolimi } from './takliflar'
import { bozorKuni } from '../bozor'

export const metadata = { title: 'Market boshqaruvi' }
export const dynamic = 'force-dynamic'

const HOLATLAR: (BuyurtmaHolati | 'hammasi')[] = ['kutilmoqda', 'buyurtma', 'berildi', 'bekor', 'hammasi']

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
  const bolim = s.bolim === 'mahsulot' && admin ? 'mahsulot' : s.bolim === 'taklif' ? 'taklif' : 'buyurtma'
  const holat = HOLATLAR.find((h) => h === s.holat) ?? 'kutilmoqda'
  const qidiruv = (s.q ?? '').trim().replace(/[%_,()"\\]/g, ' ').trim()

  const oyBoshi = `${joriyDavr()}-01`
  const [{ count: kutilmoqdaSoni }, { data: oyBerilgan }, { count: oldindanSoni }, bozor, { count: yangiTaklif }] = await Promise.all([
    supabase.from('woblr_redemptions').select('id', { count: 'exact', head: true }).eq('holat', 'kutilmoqda'),
    supabase.from('woblr_redemptions').select('ball').eq('holat', 'berildi').gte('berildi_vaqt', oyBoshi),
    supabase.from('woblr_redemptions').select('id', { count: 'exact', head: true }).eq('holat', 'buyurtma'),
    bozorKuni(supabase),
    supabase.from('woblr_takliflar').select('id', { count: 'exact', head: true }).eq('holat', 'yangi'),
  ])
  const bugun = bugunToshkent()
  const oyWoblar = (oyBerilgan ?? []).reduce((a, r) => a + (Number(r.ball) || 0), 0)

  const tablar = (
    <nav className="flex gap-1.5" aria-label="Bo‘limlar">
      {[
        { k: 'buyurtma', nom: `Buyurtmalar${kutilmoqdaSoni ? ` · ${kutilmoqdaSoni}` : ''}` },
        ...(admin ? [{ k: 'mahsulot', nom: 'Mahsulotlar' }] : []),
        { k: 'taklif', nom: `Takliflar${yangiTaklif ? ` · ${yangiTaklif} yangi` : ''}` },
      ].map((t) => (
        <Link
          key={t.k}
          href={t.k === 'buyurtma' ? '/crm/market/boshqaruv' : `/crm/market/boshqaruv?bolim=${t.k}`}
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
        izoh="buyurtmalar, mahsulotlar va takliflar"
        amal={
          <span className="flex flex-wrap gap-2">
            <Button href="/crm/market" variant="ikkilamchi">Vitrina</Button>
            {admin && <Button href="/crm/market/boshqaruv/mahsulot/yangi">Yangi mahsulot</Button>}
          </span>
        }
      />
      <Xabar ok={s.ok} xato={s.xato} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Tayyor, olib ketilmagan" value={String(kutilmoqdaSoni ?? 0)} ton={kutilmoqdaSoni ? 'accent' : 'neytral'} />
        <Stat label="Oldindan buyurtmalar" value={String(oldindanSoni ?? 0)} sub="tovar kelishi kutilmoqda" ton={oldindanSoni ? 'brand' : 'neytral'} />
        <Stat label="Shu oy berildi" value={String(oyBerilgan?.length ?? 0)} sub={`${oyWoblar.toLocaleString('ru-RU')} woblar`} />
        <div className="flex flex-col gap-1.5 rounded-[12px] border border-line bg-surface px-4 py-3.5">
          <span className="lbl">Bozor kuni</span>
          {admin ? (
            <form action={bozorSanasi} className="flex items-center gap-2">
              <input type="date" name="sana" defaultValue={bozor ?? ''} aria-label="Bozor kuni" className={`${kirishKlass} min-w-0 flex-1`} />
              <Button type="submit" variant="ikkilamchi" className="px-3!">Saqlash</Button>
            </form>
          ) : (
            <span className="h-display text-[20px]">{bozor ? kunOy(bozor) : '—'}</span>
          )}
          <span className="text-xs text-ink-3">
            {bozor
              ? nechaKunQoldi(bozor, bugun) > 0 ? `${nechaKunQoldi(bozor, bugun)} kun qoldi` : nechaKunQoldi(bozor, bugun) === 0 ? 'bugun!' : 'o‘tib ketgan — yangisini belgilang'
              : 'belgilanmagan'}
          </span>
        </div>
      </div>

      {tablar}

      {bolim === 'buyurtma' ? (
        <BuyurtmalarBolimi holat={holat} qidiruv={qidiruv} q={s.q} />
      ) : bolim === 'taklif' ? (
        <TakliflarBolimi holat={s.holat} admin={admin} />
      ) : (
        <MahsulotlarBolimi bozor={bozor} />
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
          <Empty>{qidiruv ? 'Topilmadi.' : holat === 'kutilmoqda' ? 'Olib ketilmagan buyurtma yo‘q.' : holat === 'buyurtma' ? 'Oldindan buyurtma yo‘q.' : 'Buyurtma yo‘q.'}</Empty>
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
                    {b.mahsulot_nomi ?? 'Mahsulot'}{b.soni > 1 ? ` × ${b.soni}` : ''}{b.tur === 'bozor' ? ' · an’anaviy bozor' : ''}
                  </span>
                  <span className="tnum text-[11.5px] text-ink-3">{b.kod} · {sanaVaqt(b.created_at)}</span>
                </Link>
                <span className="flex items-center gap-3">
                  <Woblar son={b.ball} />
                  {b.holat === 'buyurtma' && (
                    <form action={buyurtmaKeldi}>
                      <input type="hidden" name="kod" value={b.kod ?? ''} />
                      <Button type="submit" variant="ikkilamchi">Keldi</Button>
                    </form>
                  )}
                  {b.holat === 'kutilmoqda' || b.holat === 'buyurtma' ? (
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

async function MahsulotlarBolimi({ bozor }: { bozor: string | null }) {
  const supabase = await createClient()
  const [{ data }, { data: zakazQator }] = await Promise.all([
    supabase
      .from('woblr_rewards')
      .select('*')
      .order('holat', { ascending: true })
      .order('tartib', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('woblr_redemptions').select('reward_id, soni').eq('holat', 'buyurtma'),
  ])
  const ro = (data ?? []) as Mahsulot[]
  const zakaz = new Map<string, number>()
  for (const z of zakazQator ?? []) {
    if (z.reward_id) zakaz.set(z.reward_id, (zakaz.get(z.reward_id) ?? 0) + (Number(z.soni) || 1))
  }

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
          const oldindan = m.holat === 'faol' && m.rejim === 'oldindan'
          const qachon = kelishSanasi(m, bozor)
          const nechta = zakaz.get(m.id) ?? 0
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link
                href={`/crm/market/boshqaruv/mahsulot/${m.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg transition hover:opacity-80"
              >
                <MahsulotRasm url={m.rasm_url} nom={m.nom} className="size-14! shrink-0 rounded-[9px]" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[13.5px] font-semibold">{m.nom}</span>
                  <span className="text-[12px] text-ink-3">
                    {m.toifa ?? 'Toifasiz'}
                    {m.rasmlar?.length > 1 ? ` · ${m.rasmlar.length} rasm` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Woblar son={m.narx_ball} />
                  <span className="flex flex-wrap justify-end gap-1">
                    {m.holat !== 'faol' && <Badge ton="jim">yopilgan</Badge>}
                    {oldindan && <Badge ton="accent">oldindan{qachon ? ` · ${kunOy(qachon)}` : ''}</Badge>}
                    {oldindan && <Badge ton="brand">{nechta} ta zakaz</Badge>}
                    <Badge ton={ombor.tugagan ? 'brand' : ombor.kam ? 'accent' : 'ok'}>{ombor.matn}</Badge>
                  </span>
                </span>
              </Link>
              {oldindan && (
                <form action={mahsulotKeldi} className="w-full sm:w-auto">
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="sotuvga" value="1" />
                  <input type="hidden" name="qaytish" value="/crm/market/boshqaruv?bolim=mahsulot" />
                  <Button type="submit" className="w-full sm:w-auto">
                    Tovar keldi{nechta ? ` · ${nechta} ta zakazga xabar` : ''}
                  </Button>
                </form>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

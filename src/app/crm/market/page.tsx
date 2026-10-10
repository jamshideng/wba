import Link from 'next/link'
import { talabProfil, staffmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Empty, Button } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar, kirishKlass } from '@/components/forma'
import { JonliForma } from '@/components/jonli-forma'
import { IconSearch } from '@/components/icons'
import { omborMatni, kelishSanasi, kunOy, nechaKunQoldi, type Mahsulot } from '@/lib/market'
import { bugunToshkent } from '@/lib/format'
import { MahsulotRasm, Woblar } from './bolaklar'
import { bozorKuni } from './bozor'

export const metadata = { title: 'Woblar market' }
export const dynamic = 'force-dynamic'

const TARTIBLAR = { yangi: 'Yangilari', arzon: 'Arzonlari', qimmat: 'Qimmatlari' } as const
const TURLAR = { sotuvda: 'Hozir bor', oldindan: 'Oldindan buyurtma' } as const

/**
 * WOBLAR MARKET — vitrina (Uzum / Yandex Market kabi).
 * O'quvchi o'z woblariga admin qo'ygan narsalarni oladi. Xodim shu
 * ko'rinishni oldindan ko'radi va "Boshqaruv"ga o'tadi.
 */
export default async function Market({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; toifa?: string; tartib?: string; tur?: string; ok?: string; xato?: string }>
}) {
  const profil = await talabProfil()
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Woblar market" />

  const s = await searchParams
  const supabase = await createClient()
  const oquvchimi = profil.rol === 'oquvchi'
  const tartib = (Object.keys(TARTIBLAR) as (keyof typeof TARTIBLAR)[]).find((t) => t === s.tartib) ?? 'yangi'
  const qidiruv = (s.q ?? '').trim().replace(/[%_,()"\\]/g, ' ').trim()

  const tur = (Object.keys(TURLAR) as (keyof typeof TURLAR)[]).find((t) => t === s.tur) ?? null
  let soorov = supabase.from('woblr_rewards').select('*').eq('holat', 'faol')
  if (s.toifa) soorov = soorov.eq('toifa', s.toifa)
  if (tur) soorov = soorov.eq('rejim', tur)
  if (qidiruv) soorov = soorov.ilike('nom', `%${qidiruv}%`)
  soorov =
    tartib === 'arzon'
      ? soorov.order('narx_ball', { ascending: true })
      : tartib === 'qimmat'
        ? soorov.order('narx_ball', { ascending: false })
        : soorov.order('tartib', { ascending: false }).order('created_at', { ascending: false })

  const [{ data: mahsulotlar }, { data: toifaQatorlar }, { data: men }, bozor, { count: oldindanSoni }] = await Promise.all([
    soorov,
    supabase.from('woblr_rewards').select('toifa').eq('holat', 'faol').not('toifa', 'is', null),
    oquvchimi ? supabase.from('students').select('id').eq('profile_id', profil.id).maybeSingle() : Promise.resolve({ data: null }),
    bozorKuni(supabase),
    supabase.from('woblr_rewards').select('id', { count: 'exact', head: true }).eq('holat', 'faol').eq('rejim', 'oldindan'),
  ])
  const bugun = bugunToshkent()
  const bozorOldinda = bozor && nechaKunQoldi(bozor, bugun) >= 0 ? bozor : null

  const [{ data: bal }, { count: kutilmoqda }] = men
    ? await Promise.all([
        supabase.from('v_woblr_balance').select('balans').eq('student_id', men.id).maybeSingle(),
        supabase.from('woblr_redemptions').select('id', { count: 'exact', head: true }).eq('student_id', men.id).eq('holat', 'kutilmoqda'),
      ])
    : [{ data: null }, { count: 0 }]

  const balans = bal ? Number(bal.balans) || 0 : null
  const mList = (mahsulotlar ?? []) as Mahsulot[]
  const toifalar = [...new Set((toifaQatorlar ?? []).map((t) => t.toifa as string))].sort((a, b) => a.localeCompare(b, 'uz'))

  const toifaHavola = (t: string | null, turi: string | null = tur) => {
    const p = new URLSearchParams()
    if (t) p.set('toifa', t)
    if (turi) p.set('tur', turi)
    if (s.q) p.set('q', s.q)
    if (tartib !== 'yangi') p.set('tartib', tartib)
    const qs = p.toString()
    return qs ? `/crm/market?${qs}` : '/crm/market'
  }

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Woblar market"
        izoh="yig‘gan woblaringizga sovg‘a oling"
        amal={
          staffmi(profil.rol) ? (
            <Button href="/crm/market/boshqaruv">Boshqaruv</Button>
          ) : oquvchimi ? (
            <Button href="/crm/market/buyurtmalar" variant="ikkilamchi">
              Buyurtmalarim{kutilmoqda ? ` · ${kutilmoqda}` : ''}
            </Button>
          ) : undefined
        }
      />
      <Xabar ok={s.ok} xato={s.xato} />

      {balans !== null && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-accent-line! bg-accent-soft! px-5 py-4">
          <span className="flex flex-col gap-0.5">
            <span className="lbl">Sizning woblaringiz</span>
            <Woblar son={balans} katta />
          </span>
          <span className="max-w-xs text-[12.5px] leading-relaxed text-ink-2">
            Darsdagi faolligingiz uchun ustoz woblar beradi. Shu yerda istagan sovg‘angizni tanlang.
          </span>
        </Card>
      )}

      {oquvchimi && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Link
            href="/crm/market/bozor-xarid"
            className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line bg-surface px-5 py-4 transition hover:border-ink-3"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[14.5px] font-bold">An’anaviy bozordan sotib olish</span>
              <span className="text-[12.5px] text-ink-3">Marketda yo‘q narsa oldingizmi? Nomini va narxini o‘zingiz yozib, woblar bilan to‘lang.</span>
            </span>
            <span className="flex min-h-11 items-center rounded-[10px] bg-brand px-4 text-[13.5px] font-bold text-white">Tanlash →</span>
          </Link>
          <Link
            href="/crm/market/taklif"
            className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line bg-surface px-5 py-4 transition hover:border-ink-3"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[14.5px] font-bold">Taklif yuborish</span>
              <span className="text-[12.5px] text-ink-3">Nimadir istaysizmi? Keyingi bozorga yoki umuman taklif qiling — rasm, havola, tavsif bilan.</span>
            </span>
            <span className="flex min-h-11 items-center rounded-[10px] border border-brand px-4 text-[13.5px] font-bold text-brand">Taklif →</span>
          </Link>
        </div>
      )}

      {oquvchimi && (kutilmoqda ?? 0) > 0 && (
        <Link
          href="/crm/market/buyurtmalar"
          className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-ok bg-ok-soft px-5 py-3.5 text-[13.5px] text-ok transition hover:brightness-95"
        >
          <span>
            <b>{kutilmoqda} ta buyurtmangiz tayyor!</b> Markazga kelib, chek kodini adminga ko‘rsating.
          </span>
          <span className="font-bold">Ko‘rish →</span>
        </Link>
      )}

      {(bozorOldinda || (oldindanSoni ?? 0) > 0) && (
        <Card className="flex flex-wrap items-center justify-between gap-4 overflow-hidden border-brand/30! bg-brand-soft! px-5 py-4">
          <span className="flex min-w-0 flex-col gap-1">
            <span className="lbl text-brand!">WBA bozori</span>
            <span className="h-display text-[20px] leading-tight">
              {bozorOldinda
                ? nechaKunQoldi(bozorOldinda, bugun) === 0
                  ? 'Bozor — bugun!'
                  : `Keyingi bozor: ${kunOy(bozorOldinda)}`
                : 'Oldindan buyurtma ochiq'}
            </span>
            <span className="max-w-xl text-[12.5px] leading-relaxed text-ink-2">
              {bozorOldinda && nechaKunQoldi(bozorOldinda, bugun) > 0 && <b>{nechaKunQoldi(bozorOldinda, bugun)} kun qoldi. </b>}
              Hali kelmagan tovarlarni hoziroq zakaz qiling — woblaringiz band qilinadi, tovar kelishi bilan sizga xabar beramiz.
            </span>
          </span>
          {(oldindanSoni ?? 0) > 0 && tur !== 'oldindan' && (
            <Button href={toifaHavola(null, 'oldindan')}>Oldindan buyurtma · {oldindanSoni}</Button>
          )}
        </Card>
      )}

      <JonliForma className="flex flex-wrap items-end gap-2.5">
        {s.toifa && <input type="hidden" name="toifa" value={s.toifa} />}
        {tur && <input type="hidden" name="tur" value={tur} />}
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-sm">
          <span className="lbl">Qidiruv</span>
          <span className="flex min-h-11 items-center gap-2.5 rounded-[9px] border border-line bg-surface px-3">
            <IconSearch size={15} />
            <input
              name="q"
              type="search"
              autoComplete="off"
              defaultValue={s.q ?? ''}
              placeholder="Mahsulot nomi…"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-4"
            />
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="lbl">Tartib</span>
          <select name="tartib" defaultValue={tartib} className={kirishKlass}>
            {Object.entries(TARTIBLAR).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
      </JonliForma>

      {(oldindanSoni ?? 0) > 0 && (
        <nav aria-label="Tovar turi" className="flex gap-1.5">
          {([null, 'sotuvda', 'oldindan'] as const).map((t) => (
            <Link
              key={t ?? 'hammasi'}
              href={toifaHavola(s.toifa ?? null, t)}
              aria-current={tur === t ? 'page' : undefined}
              className={`flex min-h-11 items-center rounded-[10px] px-3.5 text-[13px] font-semibold transition ${
                tur === t ? 'bg-ink text-bg' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
              }`}
            >
              {t ? TURLAR[t] : 'Hammasi'}
            </Link>
          ))}
        </nav>
      )}

      {toifalar.length > 0 && (
        <nav aria-label="Toifalar" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {[null, ...toifalar].map((t) => {
            const tanlangan = (s.toifa ?? null) === t
            return (
              <Link
                key={t ?? 'hammasi'}
                href={toifaHavola(t)}
                aria-current={tanlangan ? 'page' : undefined}
                className={`flex min-h-11 shrink-0 items-center rounded-full border px-4 text-[13px] font-semibold transition ${
                  tanlangan ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2 hover:border-ink-3 hover:text-ink'
                }`}
              >
                {t ?? 'Hammasi'}
              </Link>
            )
          })}
        </nav>
      )}

      {mList.length === 0 ? (
        <Card className="p-6">
          <Empty>
            {qidiruv || s.toifa
              ? 'Shu shartlarga mos mahsulot topilmadi.'
              : staffmi(profil.rol)
                ? 'Marketda hali mahsulot yo‘q — “Boshqaruv” orqali qo‘shing.'
                : 'Marketda hali mahsulot yo‘q. Tez orada sovg‘alar qo‘shiladi!'}
          </Empty>
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {mList.map((m) => {
            const ombor = omborMatni(m)
            const yetmaydi = balans !== null && balans < m.narx_ball
            const oldindan = m.rejim === 'oldindan'
            const qachon = kelishSanasi(m, bozor)
            return (
              <li key={m.id}>
                <Link
                  href={`/crm/market/${m.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-[14px] border border-line bg-surface transition hover:-translate-y-0.5 hover:border-ink-3 hover:shadow-md"
                >
                  <span className="relative">
                    <MahsulotRasm url={m.rasm_url} nom={m.nom} className="transition group-hover:brightness-95" />
                    <span className="absolute top-2 left-2 flex flex-col items-start gap-1">
                      {oldindan && (
                        <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-bold text-bg">
                          Oldindan{qachon ? ` · ${kunOy(qachon)}` : ''}
                        </span>
                      )}
                      {(ombor.tugagan || ombor.kam) && (
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${ombor.tugagan ? 'bg-ink text-bg' : 'bg-brand text-white'}`}>
                          {oldindan && !ombor.tugagan ? `${m.qolgan_soni} ta joy` : ombor.matn}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="flex flex-1 flex-col gap-1.5 p-3">
                    <Woblar son={m.narx_ball} />
                    <span className="line-clamp-2 text-[13.5px] leading-snug font-semibold text-ink">{m.nom}</span>
                    {m.toifa && <span className="text-[11.5px] text-ink-3">{m.toifa}</span>}
                    <span className="mt-auto pt-1.5">
                      {ombor.tugagan ? (
                        <span className="block rounded-[9px] bg-surface-2 py-2 text-center text-[12.5px] text-ink-3">Tugagan</span>
                      ) : yetmaydi ? (
                        <span className="block rounded-[9px] bg-surface-2 py-2 text-center text-[12px] text-ink-3">
                          Yana {(m.narx_ball - (balans ?? 0)).toLocaleString('ru-RU')} woblar kerak
                        </span>
                      ) : (
                        <span className="block rounded-[9px] bg-brand py-2 text-center text-[13px] font-bold text-white transition group-hover:brightness-110">
                          {oquvchimi ? (oldindan ? 'Oldindan olish' : 'Olish') : 'Ko‘rish'}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

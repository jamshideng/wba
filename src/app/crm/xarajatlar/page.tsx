import { talabRol, adminmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, BarRow, Empty, Badge } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { JonliForma } from '@/components/jonli-forma'
import { pul, sana, davrNomi, joriyDavr, bugunToshkent } from '@/lib/format'
import { xarajatQosh, xarajatBekor } from './actions'
import { royxatOl, royxatNomi, royxatVariantlari } from '@/lib/royxat'

export const metadata = { title: 'Xarajatlar' }
export const dynamic = 'force-dynamic'

type Xarajat = {
  id: number
  sana: string
  toifa: string
  summa: number
  izoh: string | null
  bekor: boolean
  bekor_sabab: string | null
  kiritgan: string | null
  profiles: { ism: string } | null
}

type Oluvchi = { kalit: string; ism: string }

const SANA = /^\d{4}-\d{2}-\d{2}$/

type Moliya = {
  tushum: number
  xarajat: number
  foyda: number
  toifalar: { toifa: string; summa: number; soni: number }[]
}

/**
 * Xarajatlar va oylik moliya (0033, LevelUp `expenses` o'rni).
 *
 * Oy tanlanadi: tushum (tasdiqlangan to'lovlar, to'lov sanasi bo'yicha),
 * xarajat va sof foyda. Yozish — admin va direktor; qabulxona faqat ko'radi.
 * Xarajat o'chirilmaydi — sababi bilan bekor qilinadi.
 */
export default async function Xarajatlar({
  searchParams,
}: {
  searchParams: Promise<{
    davr?: string; toifa?: string; q?: string; kim?: string; xodim?: string
    holat?: string; dan?: string; gacha?: string; ok?: string; xato?: string
  }>
}) {
  const profil = await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Xarajatlar" />

  const s = await searchParams
  const davr = /^\d{4}-(0[1-9]|1[0-2])$/.test(s.davr ?? '') ? s.davr! : joriyDavr()
  const yozadi = adminmi(profil.rol)
  const supabase = await createClient()
  const toifalar = await royxatOl(supabase, 'xarajat_toifa')
  const toifa = toifalar.find((t) => t.kalit === s.toifa)?.kalit

  const oyBoshi = `${davr}-01`
  const [y, m] = davr.split('-').map(Number)
  const oyOxiri = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)

  // Filtrlar (jonli): sana oralig'i oyni almashtiradi; toifa, xodim, kim yozgan, holat, qidiruv
  const fDan = SANA.test(s.dan ?? '') ? s.dan! : null
  const fGacha = SANA.test(s.gacha ?? '') ? s.gacha! : null
  const dan = fDan ?? (fGacha ? '2000-01-01' : oyBoshi)
  const gacha = fGacha ?? (fDan ? '2100-01-01' : oyOxiri)
  const oraliq = !!(fDan || fGacha)
  const q = (s.q ?? '').trim().slice(0, 80)
  const holat = s.holat === 'faol' || s.holat === 'bekor' ? s.holat : null
  const kim = /^[0-9a-f-]{36}$/i.test(s.kim ?? '') ? s.kim! : null
  const xodim = /^[tpb]:.+$/.test(s.xodim ?? '') ? s.xodim! : null

  const parametr = new URLSearchParams()
  parametr.set('davr', davr)
  for (const [k, v] of [['toifa', toifa], ['q', q], ['kim', kim], ['xodim', xodim], ['holat', holat], ['dan', fDan], ['gacha', fGacha]] as const) {
    if (v) parametr.set(k, v)
  }
  const joriy = `/crm/xarajatlar?${parametr.toString()}`

  // Oraliqdagi barcha xarajatlar (filtrsiz) — variantlar va xodim bog'lanishi uchun
  const [{ data: hammaXom }, { data: tolovXom }, { data: tasdiqXom }] = await Promise.all([
    supabase.from('xarajatlar').select('kiritgan, profiles(ism)').gte('sana', dan).lte('sana', gacha),
    supabase.from('maosh_tolovlar').select('xarajat_id, teacher_id, profile_id, boshqa_xodim_id').gte('sana', dan).lte('sana', gacha),
    // maosh_tasdiq (0075, 0112 gacha maosh xarajati shu orqali) — types.ts da yo'q
    (supabase as unknown as { from: (t: string) => typeof supabase extends { from: (t: 'maosh_tolovlar') => infer Q } ? Q : never })
      .from('maosh_tasdiq')
      .select('xarajat_id, teacher_id, ism')
      .not('xarajat_id', 'is', null),
  ])

  const kiritganlar = new Map<string, string>()
  for (const r of (hammaXom ?? []) as unknown as { kiritgan: string | null; profiles: { ism: string } | null }[]) {
    if (r.kiritgan) kiritganlar.set(r.kiritgan, r.profiles?.ism ?? '—')
  }

  // Xarajat → kimga berilgan (maosh/avans): kalit t:ustoz / p:profil / b:boshqa xodim
  const xarajatXodim = new Map<number, string>()
  for (const t of (tolovXom ?? []) as { xarajat_id: number; teacher_id: string | null; profile_id: string | null; boshqa_xodim_id: number | null }[]) {
    const k = t.teacher_id ? `t:${t.teacher_id}` : t.profile_id ? `p:${t.profile_id}` : `b:${t.boshqa_xodim_id}`
    xarajatXodim.set(Number(t.xarajat_id), k)
  }
  const xodimIsm = new Map<string, string>()
  for (const t of (tasdiqXom ?? []) as unknown as { xarajat_id: number; teacher_id: string; ism: string }[]) {
    if (!xarajatXodim.has(Number(t.xarajat_id))) xarajatXodim.set(Number(t.xarajat_id), `t:${t.teacher_id}`)
    xodimIsm.set(`t:${t.teacher_id}`, t.ism)
  }
  const idlar = (p: string) => [...new Set([...xarajatXodim.values()].filter((k) => k.startsWith(p)).map((k) => k.slice(2)))]
  const bosh = Promise.resolve({ data: [] as { id: string | number; ism: string }[] })
  const [tIsm, pIsm, bIsm] = await Promise.all([
    idlar('t:').length ? supabase.from('teachers').select('id, ism').in('id', idlar('t:')) : bosh,
    idlar('p:').length ? supabase.from('profiles').select('id, ism').in('id', idlar('p:')) : bosh,
    idlar('b:').length ? supabase.from('boshqa_xodimlar').select('id, ism').in('id', idlar('b:').map(Number)) : bosh,
  ])
  for (const [p, r] of [['t', tIsm], ['p', pIsm], ['b', bIsm]] as const) {
    for (const x of (r.data ?? []) as { id: string | number; ism: string }[]) xodimIsm.set(`${p}:${x.id}`, x.ism)
  }
  const xodimlar: Oluvchi[] = [...new Set(xarajatXodim.values())]
    .map((k) => ({ kalit: k, ism: xodimIsm.get(k) ?? '—' }))
    .sort((a, b) => a.ism.localeCompare(b.ism))

  let sorov = supabase
    .from('xarajatlar')
    .select('id, sana, toifa, summa, izoh, bekor, bekor_sabab, kiritgan, profiles(ism)')
    .gte('sana', dan)
    .lte('sana', gacha)
  if (toifa) sorov = sorov.eq('toifa', toifa)
  if (kim) sorov = sorov.eq('kiritgan', kim)
  if (holat) sorov = sorov.eq('bekor', holat === 'bekor')
  if (xodim) {
    const ids = [...xarajatXodim].filter(([, k]) => k === xodim).map(([id]) => id)
    sorov = sorov.in('id', ids.length ? ids : [-1])
  }
  if (q) {
    const toza = q.replace(/[,()*%\\"]/g, ' ').trim()
    const raqam = /^#?\d+$/.test(toza) ? toza.replace('#', '') : null
    if (toza) sorov = sorov.or(raqam ? `id.eq.${raqam},izoh.ilike.*${toza}*` : `izoh.ilike.*${toza}*`)
  }

  const [{ data }, { data: moliyaXom }] = await Promise.all([
    sorov.order('sana', { ascending: false }).order('id', { ascending: false }),
    supabase.rpc('oylik_moliya', { p_davr: davr }),
  ])

  const royxat = (data ?? []) as unknown as Xarajat[]
  const mo: Moliya = moliyaXom ?? { tushum: 0, xarajat: 0, foyda: 0, toifalar: [] }
  const foyda = Number(mo.foyda)
  const maxToifa = Math.max(1, ...mo.toifalar.map((t) => Number(t.summa)))
  const toifaNomi = (t: string) => royxatNomi(toifalar, t)
  const filtrda = !!(toifa || q || kim || xodim || holat || oraliq)
  const faollar = royxat.filter((x) => !x.bekor)
  const filtrJami = faollar.reduce((a, x) => a + Number(x.summa), 0)
  const davrMatn = oraliq ? `${fDan ? sana(dan) : '…'} – ${fGacha ? sana(gacha) : '…'}` : davrNomi(davr)

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Xarajatlar"
        izoh={`${davrMatn} · ${faollar.length} ta yozuv`}
      />

      <Card className="flex flex-col gap-3 px-5 py-4">
        <JonliForma className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Maydon nom="Oy">
            <input type="month" name="davr" defaultValue={davr} className={kirishKlass} />
          </Maydon>
          <Maydon nom="Sanadan" izoh="to‘ldirilsa, oy o‘rniga">
            <input type="date" name="dan" defaultValue={fDan ?? ''} className={kirishKlass} />
          </Maydon>
          <Maydon nom="Sanagacha">
            <input type="date" name="gacha" defaultValue={fGacha ?? ''} className={kirishKlass} />
          </Maydon>
          <Maydon nom="Toifa">
            <select name="toifa" defaultValue={toifa ?? ''} className={kirishKlass}>
              <option value="">Hamma toifa</option>
              {toifalar.map((t) => (
                <option key={t.kalit} value={t.kalit}>{t.nom}</option>
              ))}
            </select>
          </Maydon>
          <Maydon nom="Xodim" izoh="maosh/avans kimga berilgan">
            <select name="xodim" defaultValue={xodim ?? ''} className={kirishKlass}>
              <option value="">Hamma xodim</option>
              {xodimlar.map((x) => (
                <option key={x.kalit} value={x.kalit}>{x.ism}</option>
              ))}
            </select>
          </Maydon>
          <Maydon nom="Kim yozgan">
            <select name="kim" defaultValue={kim ?? ''} className={kirishKlass}>
              <option value="">Hamma</option>
              {[...kiritganlar].sort((a, b) => a[1].localeCompare(b[1])).map(([id, ism]) => (
                <option key={id} value={id}>{ism}</option>
              ))}
            </select>
          </Maydon>
          <Maydon nom="Holat">
            <select name="holat" defaultValue={holat ?? ''} className={kirishKlass}>
              <option value="">Hammasi</option>
              <option value="faol">Faol</option>
              <option value="bekor">Bekor qilingan</option>
            </select>
          </Maydon>
          <Maydon nom="Qidirish">
            <input name="q" defaultValue={q} placeholder="Izoh yoki #raqam" className={kirishKlass} />
          </Maydon>
        </JonliForma>
        {filtrda && (
          <a href={`/crm/xarajatlar?davr=${davr}`} className="self-start text-[12px] text-ink-3 hover:text-ink">
            Filtrni tozalash ×
          </a>
        )}
      </Card>

      <Xabar ok={s.ok} xato={s.xato} />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Stat
          label={`${davrNomi(davr)} tushumi`}
          value={pul(mo.tushum)}
          sub="tasdiqlangan to‘lovlar · so‘m"
          href={`/crm/hisobotlar/royxat?tur=tushum&kim=tasdiqlangan&dan=${dan}&gacha=${gacha}`}
        />
        <Stat label="Xarajat" value={pul(mo.xarajat)} sub="bekor qilinmaganlar · so‘m" ton="accent" href={`/crm/xarajatlar?davr=${davr}&b=xarajat`} />
        <Stat
          label="Sof foyda"
          value={pul(foyda)}
          sub="tushum − xarajat · so‘m"
          ton={foyda < 0 ? 'brand' : 'ok'}
          border={foyda < 0 ? 'brand' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <Card className="flex flex-col">
          <CardHeader title="Yozuvlar" meta={`${faollar.length} ta · ${pul(filtrJami)} so‘m${filtrda ? ' · filtr bo‘yicha' : ''}`} />
          {royxat.length === 0 ? (
            <div className="px-5 pb-5">
              <Empty>{filtrda ? 'Filtr bo‘yicha xarajat topilmadi.' : 'Bu oyda xarajat yozilmagan.'}</Empty>
            </div>
          ) : (
            <ul className="flex flex-col">
              {royxat.map((x) => (
                <li key={x.id} data-belgi={x.bekor ? undefined : "xarajat"} className="flex flex-col gap-2 border-t border-line-soft px-5 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
                        {toifaNomi(x.toifa)}
                        {x.bekor && <Badge>bekor</Badge>}
                      </span>
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-3">
                        #{x.id} · {sana(x.sana)}
                        {x.profiles?.ism ? ` · ${x.profiles.ism}` : ''}
                        {xarajatXodim.has(x.id) ? ` · → ${xodimIsm.get(xarajatXodim.get(x.id)!) ?? '—'}` : ''}
                      </span>
                      {x.izoh && <span className="text-[12.5px] text-ink-2">{x.izoh}</span>}
                      {x.bekor && x.bekor_sabab && <span className="text-[12px] text-ink-3">Sabab: {x.bekor_sabab}</span>}
                    </div>
                    <span
                      className={`tnum font-[family-name:var(--font-mono)] text-[14px] font-semibold ${x.bekor ? 'text-ink-4 line-through' : ''}`}
                    >
                      {pul(x.summa)}
                    </span>
                  </div>
                  {yozadi && !x.bekor && (
                    <details>
                      <summary className="cursor-pointer text-[12px] text-ink-3 hover:text-ink">Bekor qilish</summary>
                      <form action={xarajatBekor} className="mt-2 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="id" value={x.id} />
                        <input type="hidden" name="qaytish" value={joriy} />
                        <Maydon nom="Sabab">
                          <input name="sabab" required placeholder="Masalan: ikki marta yozilgan" className={kirishKlass} />
                        </Maydon>
                        <Yuborish tur="xavfli" kutish="…">Bekor qilish</Yuborish>
                      </form>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {yozadi && (
            <Card className="flex flex-col">
              <CardHeader title="Xarajat qo‘shish" />
              <form action={xarajatQosh} className="flex flex-col gap-3 px-5 pb-5">
                <input type="hidden" name="qaytish" value={joriy} />
                <Maydon nom="Toifa">
                  <select name="toifa" required defaultValue={toifa ?? ''} className={kirishKlass}>
                    <option value="" disabled>
                      Tanlang…
                    </option>
                    {royxatVariantlari(toifalar).map((t) => (
                      <option key={t.kalit} value={t.kalit}>
                        {t.nom}
                      </option>
                    ))}
                  </select>
                </Maydon>
                <Maydon nom="Summa" izoh="Masalan: 3500000, 3500 ming yoki 3.5 mln">
                  <input name="summa" required inputMode="numeric" className={kirishKlass} />
                </Maydon>
                <Maydon nom="Sana">
                  <input type="date" name="sana" required defaultValue={bugunToshkent()} className={kirishKlass} />
                </Maydon>
                <Maydon nom="Izoh">
                  <input name="izoh" placeholder="Masalan: oktabr ijarasi" className={kirishKlass} />
                </Maydon>
                <Yuborish kutish="Yozilmoqda…">Yozish</Yuborish>
              </form>
            </Card>
          )}

          <Card className="flex flex-col">
            <CardHeader title="Toifalar bo‘yicha" meta="so‘m" />
            <div className="flex flex-col gap-2.5 px-5 pb-5">
              {mo.toifalar.length === 0 ? (
                <Empty>Hali xarajat yo‘q.</Empty>
              ) : (
                mo.toifalar.map((t) => (
                  <a key={t.toifa} href={`/crm/xarajatlar?davr=${davr}&toifa=${t.toifa}`} className="block hover:opacity-80">
                    <BarRow label={`${toifaNomi(t.toifa)} · ${t.soni}`} value={Number(t.summa)} max={maxToifa} />
                  </a>
                ))
              )}
              {toifa && (
                <a href={`/crm/xarajatlar?davr=${davr}`} className="text-[12px] text-ink-3 hover:text-ink">
                  Hamma toifani ko‘rsatish →
                </a>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

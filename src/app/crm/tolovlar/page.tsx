import Link from 'next/link'
import { IconPayments, IconDebt, IconWoblr } from '@/components/icons'
import { talabRol, tasdiqlaydimi, adminmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Stat, Badge, Empty, Button } from '@/components/ui'
import { Sarlavha, Ulanmagan, Sahifalash } from '@/components/crm'
import { Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { pul, sana, davrNomi, joriyDavr } from '@/lib/format'
import { tolovTasdiqla, tolovBekor } from './actions'
import type { PaymentMethod, DashboardStats } from '@/lib/types'
import { qidiruvTuri } from '@/lib/qidiruv'
import { JonliForma } from '@/components/jonli-forma'

export const metadata = { title: 'To‘lovlar' }
export const dynamic = 'force-dynamic'

const SAHIFA_SONI = 30

const USUL_NOMI: Record<PaymentMethod, string> = {
  naqd: 'Naqd',
  karta: 'Karta',
  click: 'Click',
  payme: 'Payme',
}

type Sorov = {
  filtr?: string
  davr?: string
  usul?: string
  q?: string
  sahifa?: string
  ok?: string
  xato?: string
}

type Tolov = {
  id: number
  sana: string
  davr: string
  summa: number
  usul: PaymentMethod | null
  tasdiqlangan: boolean
  tasdiqlangan_vaqt: string | null
  bekor: boolean
  bekor_sabab: string | null
  izoh: string | null
  manba: string
  students: { id: string; fish: string } | null
  enrollments: { groups: { nom: string } | null } | null
}

export default async function Tolovlar({ searchParams }: { searchParams: Promise<Sorov> }) {
  const profil = await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="To‘lovlar" />

  const s = await searchParams
  const filtr = (['tasdiqlanmagan', 'bekor'] as const).find((f) => f === s.filtr) ?? 'hammasi'
  const davr = /^\d{4}-\d{2}$/.test(s.davr ?? '') ? s.davr! : ''
  const usul = (['naqd', 'karta', 'click', 'payme'] as const).find((u) => u === s.usul)
  const qidiruv = (s.q ?? '').trim()
  const sahifa = Math.max(1, Number(s.sahifa ?? 1) || 1)
  const boshi = (sahifa - 1) * SAHIFA_SONI

  const direktor = tasdiqlaydimi(profil.rol)
  const bekorQila = adminmi(profil.rol)

  const supabase = await createClient()

  const tanlov =
    'id, sana, davr, summa, usul, tasdiqlangan, tasdiqlangan_vaqt, bekor, bekor_sabab, izoh, manba, ' +
    (qidiruv ? 'students!inner(id, fish)' : 'students(id, fish)') +
    ', enrollments(groups(nom))'

  let soorov = supabase.from('payments').select(tanlov, { count: 'exact' })

  if (filtr === 'tasdiqlanmagan') soorov = soorov.eq('tasdiqlangan', false).eq('bekor', false)
  else if (filtr === 'bekor') soorov = soorov.eq('bekor', true)
  if (davr) soorov = soorov.eq('davr', davr)
  if (usul) soorov = soorov.eq('usul', usul)
  // To'lovda telefon yo'q — raqam yozilsa ism sifatida emas, hech narsa topilmaydi; ID va ism yetarli
  const qt = qidiruvTuri(qidiruv)
  if (qt?.turi === 'id') soorov = soorov.ilike('student_id', qt.naqsh)
  else if (qt) soorov = soorov.ilike('students.fish', qt.naqsh)

  const [{ data, count }, { data: panel }] = await Promise.all([
    soorov.order('sana', { ascending: false }).order('id', { ascending: false }).range(boshi, boshi + SAHIFA_SONI - 1),
    supabase.from('v_dashboard').select('*').maybeSingle(),
  ])

  const tolovlar = (data ?? []) as unknown as Tolov[]
  const p = panel as DashboardStats | null
  const kutayotgan = tolovlar.filter((t) => !t.tasdiqlangan && !t.bekor)
  const joriy = `/crm/tolovlar?${new URLSearchParams(
    Object.entries({ filtr: filtr === 'hammasi' ? '' : filtr, davr, usul: usul ?? '', q: qidiruv, sahifa: sahifa > 1 ? String(sahifa) : '' })
      .filter(([, v]) => v) as [string, string][],
  ).toString()}`

  const bolim = (f: string, nom: string) => (
    <Link
      href={f === 'hammasi' ? '/crm/tolovlar' : `/crm/tolovlar?filtr=${f}`}
      className={`flex min-h-11 items-center rounded-[9px] border px-4 text-[13px] transition ${
        filtr === f ? 'border-brand bg-brand-soft text-ink' : 'border-line text-ink-3 hover:text-ink'
      }`}
    >
      {nom}
    </Link>
  )

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom={direktor && filtr === 'tasdiqlanmagan' ? 'Tasdiqlash' : 'To‘lovlar'}
        izoh={`${count ?? 0} ta yozuv`}
        amal={<Button href="/crm/tolovlar/yangi">To‘lov qo‘shish</Button>}
      />

      <Xabar ok={s.ok} xato={s.xato} />

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <Stat label={`${davrNomi(joriyDavr())} tushumi`} value={p?.joriy_oy_tushumi ?? 0} sub={`${p?.joriy_oy_tolovlari ?? 0} ta to‘lov`} ton="ok" Icon={IconPayments} />
        <Stat
          label="Tasdiq kutmoqda"
          value={p?.tasdiqlanmagan_summa ?? 0}
          sub={`${p?.tasdiqlanmagan_soni ?? 0} ta to‘lov`}
          ton={(p?.tasdiqlanmagan_soni ?? 0) > 0 ? 'accent' : 'ok'}
          border={(p?.tasdiqlanmagan_soni ?? 0) > 0 ? 'accent' : undefined}
        />
        <Stat label="Jami qarz" value={p?.jami_qarz ?? 0} sub={`${p?.qarzdorlar ?? 0} qarzdor`} ton="brand" Icon={IconDebt} />
        <Stat label="Chegirma" value={p?.chegirma ?? 0} sub="shu oy" ton="accent" Icon={IconWoblr} />
      </div>

      <div className="flex flex-wrap gap-2">
        {bolim('hammasi', 'Hammasi')}
        {bolim('tasdiqlanmagan', 'Tasdiqlanmagan')}
        {bolim('bekor', 'Bekor qilingan')}
      </div>

      <JonliForma className="flex flex-wrap items-end gap-2.5">
        {filtr !== 'hammasi' && <input type="hidden" name="filtr" value={filtr} />}
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
          <span className="lbl">O‘quvchi</span>
          <input name="q" type="search" autoComplete="off" defaultValue={qidiruv} placeholder="Ism yoki ID…" className={kirishKlass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="lbl">Oy</span>
          <input type="month" name="davr" defaultValue={davr} className={kirishKlass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="lbl">Usul</span>
          <select name="usul" defaultValue={usul ?? ''} className={kirishKlass}>
            <option value="">Hammasi</option>
            {Object.entries(USUL_NOMI).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
      </JonliForma>

      {/* Direktor: sahifadagi hamma kutayotganni bir bosishda */}
      {direktor && kutayotgan.length > 1 && (
        <form action={tolovTasdiqla} className="flex flex-wrap items-center justify-between gap-3 rounded-[11px] border border-accent-line bg-accent-soft px-4 py-3">
          <input type="hidden" name="qaytish" value={joriy} />
          {kutayotgan.map((t) => (
            <input key={t.id} type="hidden" name="id" value={t.id} />
          ))}
          <span className="text-[13px]">
            Shu sahifada <b>{kutayotgan.length} ta</b> to‘lov tasdiq kutmoqda —{' '}
            {pul(kutayotgan.reduce((a, t) => a + Number(t.summa), 0))} so‘m
          </span>
          <Yuborish tur="ok" kutish="Tasdiqlanmoqda…">Hammasini tasdiqlash</Yuborish>
        </form>
      )}

      <Card className="flex flex-col">
        {tolovlar.length === 0 ? (
          <div className="p-5">
            <Empty>
              {filtr === 'tasdiqlanmagan'
                ? 'Tasdiq kutayotgan to‘lov yo‘q.'
                : qidiruv || davr || usul
                  ? 'Shu shartlarga mos to‘lov topilmadi.'
                  : 'Hali to‘lov yo‘q.'}
            </Empty>
          </div>
        ) : (
          <ul className="flex flex-col">
            {tolovlar.map((t) => (
              <li key={t.id} className="flex flex-col gap-2.5 border-b border-line-soft px-5 py-3.5 last:border-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    {t.students ? (
                      <Link href={`/crm/oquvchilar/${t.students.id}`} className="truncate text-[13.5px] font-semibold hover:text-brand">
                        {t.students.fish}
                      </Link>
                    ) : (
                      <span className="text-[13.5px] font-semibold">—</span>
                    )}
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-3">
                      #{t.id} · {sana(t.sana)} · {davrNomi(t.davr)} uchun
                      {t.enrollments?.groups?.nom ? ` · ${t.enrollments.groups.nom}` : ''}
                    </span>
                    {t.izoh && <span className="text-[12px] text-ink-3">{t.izoh}</span>}
                    {t.bekor && t.bekor_sabab && (
                      <span className="text-[12px] text-brand">Bekor sababi: {t.bekor_sabab}</span>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`tnum font-[family-name:var(--font-mono)] text-[15px] ${t.bekor ? 'text-ink-4 line-through' : ''}`}>
                      {pul(t.summa)}
                    </span>
                    <span className="flex flex-wrap justify-end gap-1.5">
                      <Badge ton="jim">{t.usul ? USUL_NOMI[t.usul] : 'usul [ANIQLANMAGAN]'}</Badge>
                      {t.bekor ? (
                        <Badge ton="brand">bekor</Badge>
                      ) : t.tasdiqlangan ? (
                        <Badge ton="ok" nuqta>tasdiqlangan</Badge>
                      ) : (
                        <Badge ton="accent" nuqta>kutilmoqda</Badge>
                      )}
                    </span>
                  </div>
                </div>

                {!t.bekor && (direktor || bekorQila) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {direktor && !t.tasdiqlangan && (
                      <form action={tolovTasdiqla}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="qaytish" value={joriy} />
                        <Yuborish tur="ok" kutish="…">Tasdiqlash</Yuborish>
                      </form>
                    )}
                    {bekorQila && (
                      <details className="group">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-[9px] border border-line px-4 text-[13px] text-ink-3 transition hover:text-ink">
                          Bekor qilish
                        </summary>
                        <form action={tolovBekor} className="mt-2 flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="qaytish" value={joriy} />
                          <input name="sabab" required placeholder="Sababi (majburiy)" className={`${kirishKlass} sm:w-64`} />
                          <Yuborish tur="xavfli" kutish="…">Bekor qilish</Yuborish>
                        </form>
                      </details>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Sahifalash
        yol="/crm/tolovlar"
        sorov={{ filtr: filtr === 'hammasi' ? undefined : filtr, davr: davr || undefined, usul, q: qidiruv || undefined }}
        sahifa={sahifa}
        jami={count ?? 0}
        soni={SAHIFA_SONI}
      />
    </div>
  )
}

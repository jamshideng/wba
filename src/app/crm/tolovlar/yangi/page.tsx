import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, FormaBolim, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { IconArrowLeft, IconSearch } from '@/components/icons'
import { pul, joriyDavr, bugunToshkent, telefon } from '@/lib/format'
import { tolovQosh } from '../actions'
import { qidiruvTuri, telefonFiltri } from '@/lib/qidiruv'
import { JonliForma } from '@/components/jonli-forma'

export const metadata = { title: 'To‘lov qo‘shish' }
export const dynamic = 'force-dynamic'

type Sorov = { oquvchi?: string; q?: string; xato?: string }

export default async function TolovQosh({ searchParams }: { searchParams: Promise<Sorov> }) {
  await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="To‘lov qo‘shish" />

  const s = await searchParams
  const supabase = await createClient()
  const oquvchiId = (s.oquvchi ?? '').toUpperCase()

  /* ── 1-qadam: o'quvchini tanlash ── */
  if (!oquvchiId) {
    const q = (s.q ?? '').trim()
    let topilganlar: { id: string; fish: string; shaxsiy_tel: string | null; ota_tel: string | null }[] = []

    const qt = qidiruvTuri(q)
    if (qt) {
      let soorov = supabase.from('students').select('id, fish, shaxsiy_tel, ota_tel').eq('holat', 'faol')
      if (qt.turi === 'id') soorov = soorov.ilike('id', qt.naqsh)
      else if (qt.turi === 'tel') soorov = soorov.or(telefonFiltri(qt.naqsh))
      else soorov = soorov.ilike('fish', qt.naqsh)
      const { data } = await soorov.order('fish').limit(20)
      topilganlar = data ?? []
    }

    return (
      <div className="flex max-w-2xl flex-col gap-4 px-5 py-5 lg:px-7">
        <Link href="/crm/tolovlar" className="flex items-center gap-2 text-[13px] text-ink-3 hover:text-ink">
          <IconArrowLeft size={15} /> To‘lovlar
        </Link>
        <Sarlavha nom="To‘lov qo‘shish" izoh="1 / 2 · kim to‘ladi" />
        <Xabar xato={s.xato} />

        <JonliForma className="flex gap-2.5">
          <span className="flex min-h-11 flex-1 items-center gap-2.5 rounded-[9px] border border-line bg-surface px-3">
            <IconSearch size={15} />
            <input
              name="q"
              type="search"
              autoComplete="off"
              defaultValue={q}
              autoFocus
              placeholder="Ism, ID yoki telefon…"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-4"
            />
          </span>
        </JonliForma>

        {q && (
          <Card className="flex flex-col">
            {topilganlar.length === 0 ? (
              <div className="p-5">
                <Empty>“{q}” bo‘yicha faol o‘quvchi topilmadi.</Empty>
              </div>
            ) : (
              <ul>
                {topilganlar.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/crm/tolovlar/yangi?oquvchi=${o.id}`}
                      className="flex min-h-12 items-center justify-between gap-3 border-b border-line-soft px-5 py-2.5 last:border-0 hover:bg-surface-2"
                    >
                      <span className="truncate text-[13.5px] font-semibold">{o.fish}</span>
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-3">
                        {o.id} · {telefon(o.shaxsiy_tel ?? o.ota_tel)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    )
  }

  /* ── 2-qadam: guruh, summa, usul ── */
  const [{ data: oquvchi }, { data: yozilishlar }, { data: balans }] = await Promise.all([
    supabase.from('students').select('id, fish').eq('id', oquvchiId).maybeSingle(),
    supabase
      .from('enrollments')
      .select('id, holat, groups(nom, oylik_narx)')
      .eq('student_id', oquvchiId)
      .neq('holat', 'tugagan'),
    supabase.from('v_enrollment_balance').select('enrollment_id, qarz').eq('student_id', oquvchiId),
  ])

  if (!oquvchi) {
    return (
      <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
        <Sarlavha nom="To‘lov qo‘shish" />
        <Card className="p-5"><Empty>O‘quvchi topilmadi: {oquvchiId}</Empty></Card>
      </div>
    )
  }

  type Yozilish = { id: string; groups: { nom: string; oylik_narx: number } | null }
  const yList = (yozilishlar ?? []) as unknown as Yozilish[]
  const qarz = new Map(((balans ?? []) as { enrollment_id: string; qarz: number }[]).map((b) => [b.enrollment_id, Number(b.qarz) || 0]))

  return (
    <div className="flex max-w-2xl flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href="/crm/tolovlar/yangi" className="flex items-center gap-2 text-[13px] text-ink-3 hover:text-ink">
        <IconArrowLeft size={15} /> Boshqa o‘quvchi
      </Link>
      <Sarlavha nom={oquvchi.fish} izoh={`2 / 2 · to‘lov · ${oquvchi.id}`} />
      <Xabar xato={s.xato} />

      <form action={tolovQosh} className="flex flex-col gap-4">
        <input type="hidden" name="student_id" value={oquvchi.id} />
        <input type="hidden" name="qaytish" value={`/crm/oquvchilar/${oquvchi.id}`} />

        <FormaBolim nom="Qaysi guruh uchun">
          {yList.length === 0 ? (
            <Empty>Faol guruhi yo‘q — to‘lov guruhga bog‘lanmay yoziladi.</Empty>
          ) : (
            <div className="flex flex-col gap-2">
              {yList.map((y, i) => (
                <label
                  key={y.id}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] border border-line px-4 py-2.5 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
                >
                  <input type="radio" name="enrollment_id" value={y.id} defaultChecked={i === 0} className="size-4" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13.5px] font-semibold">{y.groups?.nom ?? '—'}</span>
                    <span className="text-[11.5px] text-ink-3">oyiga {pul(y.groups?.oylik_narx ?? 0)}</span>
                  </span>
                  <span className={`tnum font-[family-name:var(--font-mono)] text-[12.5px] ${(qarz.get(y.id) ?? 0) > 0 ? 'text-brand' : 'text-ok'}`}>
                    {(qarz.get(y.id) ?? 0) > 0 ? `qarz ${pul(qarz.get(y.id))}` : 'qarzi yo‘q'}
                  </span>
                </label>
              ))}
            </div>
          )}
        </FormaBolim>

        <FormaBolim nom="To‘lov">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Maydon nom="Summa" izoh="650000 yoki qisqa: 650 (minglarda), 1.2 mln">
              <input name="summa" required inputMode="decimal" placeholder="650 000" className={kirishKlass} />
            </Maydon>
            <Maydon nom="Usul">
              <select name="usul" required defaultValue="" className={kirishKlass}>
                <option value="" disabled>Tanlang…</option>
                <option value="naqd">Naqd</option>
                <option value="karta">Karta</option>
                <option value="click">Click</option>
                <option value="payme">Payme</option>
              </select>
            </Maydon>
            <Maydon nom="Qaysi oy uchun">
              <input type="month" name="davr" required defaultValue={joriyDavr()} className={kirishKlass} />
            </Maydon>
            <Maydon nom="To‘langan sana">
              <input type="date" name="sana" required defaultValue={bugunToshkent()} max={bugunToshkent()} className={kirishKlass} />
            </Maydon>
          </div>
          <Maydon nom="Izoh">
            <input name="izoh" placeholder="Ixtiyoriy" className={kirishKlass} />
          </Maydon>
        </FormaBolim>

        <p className="text-[12px] text-ink-3">
          To‘lov “tasdiq kutilmoqda” holatida yoziladi — uni direktor tasdiqlaydi.
        </p>

        <Yuborish>To‘lovni yozish</Yuborish>
      </form>
    </div>
  )
}

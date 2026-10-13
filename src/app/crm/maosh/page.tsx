import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Empty, Badge } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { JonliForma } from '@/components/jonli-forma'
import { pul, davrNomi, joriyDavr } from '@/lib/format'
import type { MaoshHarakat, UstozMaosh } from '@/lib/types'
import { stavkaSaqla, harakatQosh, harakatBekor } from './actions'

export const metadata = { title: 'Maosh' }
export const dynamic = 'force-dynamic'

const TURLAR: Record<MaoshHarakat['turi'], string> = { avans: 'Avans', bonus: 'Bonus', jarima: 'Jarima' }

const vaqtFmt = new Intl.DateTimeFormat('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit' })

/**
 * Ustoz maoshi (0066, SoffCRM'dan). Qoida (Jamshid, 13.10): oyda o'qigan
 * har bir o'quvchi (shu oy fakturasi bor qatnashuv) × ustoz stavkasi,
 * minus avans, plus bonus, minus jarima. Hisob bazada — ustoz_maosh().
 *
 * Faqat admin va direktor (Jamshid, 13.10: ustoz panelida ko'rinmaydi).
 * Ustoz o'z maoshini ham ko'rmaydi — huquq bazada ham yopiq.
 */
export default async function Maosh({
  searchParams,
}: {
  searchParams: Promise<{ davr?: string; ok?: string; xato?: string }>
}) {
  await talabRol('admin', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Maosh" />

  const s = await searchParams
  const davr = /^\d{4}-(0[1-9]|1[0-2])$/.test(s.davr ?? '') ? s.davr! : joriyDavr()
  const yozadi = true
  const joriy = `/crm/maosh?davr=${davr}`

  const supabase = await createClient()
  const [{ data: maoshXom, error: xato }, { data: harakatXom }] = await Promise.all([
    supabase.rpc('ustoz_maosh', { p_davr: davr }),
    supabase
      .from('maosh_harakatlar')
      .select('id, teacher_id, davr, turi, summa, izoh, bekor, bekor_sabab, created_at')
      .eq('davr', davr)
      .order('id', { ascending: false }),
  ])

  const qatorlar = (maoshXom ?? []) as UstozMaosh[]
  const harakatlar = (harakatXom ?? []) as MaoshHarakat[]
  const ismi = new Map(qatorlar.map((q) => [q.teacher_id, q.ism]))
  const jami = qatorlar.reduce((a, q) => a + (q.yakuniy === null ? 0 : Number(q.yakuniy)), 0)
  const jamiOquvchi = qatorlar.reduce((a, q) => a + Number(q.oquvchilar), 0)
  const stavkasiz = qatorlar.filter((q) => q.stavka === null).length

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Maosh"
        izoh={`${davrNomi(davr)} · o‘quvchi soni × stavka`}
        amal={
          <JonliForma className="flex items-end gap-2">
            <input type="month" name="davr" defaultValue={davr} className={kirishKlass} aria-label="Oy" />
          </JonliForma>
        }
      />

      <Xabar ok={s.ok} xato={s.xato ?? (xato ? 'Maoshni o‘qib bo‘lmadi.' : undefined)} />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Stat label={`${davrNomi(davr)} · jami`} value={pul(jami)} sub="to‘lanadigan maosh · so‘m" />
        <Stat label="O‘quvchilar" value={jamiOquvchi} sub="shu oy fakturasi borlar" />
        <Stat
          label="Stavkasiz"
          value={stavkasiz}
          sub={stavkasiz ? 'maosh [ANIQLANMAGAN]' : 'hammasiga belgilangan'}
          ton={stavkasiz ? 'brand' : 'ok'}
          border={stavkasiz ? 'brand' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <Card className="flex flex-col">
          <CardHeader title="Ustozlar" meta="so‘m" />
          {qatorlar.length === 0 ? (
            <div className="px-5 pb-5">
              <Empty>Bu oyda ustoz yo‘q.</Empty>
            </div>
          ) : (
            <ul className="flex flex-col">
              {qatorlar.map((q) => (
                <li key={q.teacher_id} className="flex flex-col gap-2.5 border-t border-line-soft px-5 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <Link href={`/crm/ustozlar/${q.teacher_id}`} className="text-[13.5px] font-semibold hover:underline">
                        {q.ism}
                      </Link>
                      <span className="tnum text-[12px] text-ink-3">
                        {q.stavka === null
                          ? `${q.oquvchilar} o‘quvchi · stavka belgilanmagan`
                          : `${q.oquvchilar} o‘quvchi × ${pul(q.stavka)} = ${pul(q.hisob ?? 0)}`}
                      </span>
                      {(Number(q.avans) > 0 || Number(q.bonus) > 0 || Number(q.jarima) > 0) && (
                        <span className="tnum flex flex-wrap gap-x-3 text-[12px]">
                          {Number(q.avans) > 0 && <span className="text-ink-2">avans −{pul(q.avans)}</span>}
                          {Number(q.bonus) > 0 && <span className="text-ok">bonus +{pul(q.bonus)}</span>}
                          {Number(q.jarima) > 0 && <span className="text-brand">jarima −{pul(q.jarima)}</span>}
                        </span>
                      )}
                    </div>
                    {q.yakuniy === null ? (
                      <Badge>aniqlanmagan</Badge>
                    ) : (
                      <span className="tnum font-[family-name:var(--font-mono)] text-[15px] font-semibold">{pul(q.yakuniy)}</span>
                    )}
                  </div>
                  {yozadi && (
                    <details>
                      <summary className="cursor-pointer text-[12px] text-ink-3 hover:text-ink">Stavkani o‘zgartirish</summary>
                      <form action={stavkaSaqla} className="mt-2 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="teacher_id" value={q.teacher_id} />
                        <input type="hidden" name="qaytish" value={joriy} />
                        <Maydon nom="Bitta o‘quvchi uchun" izoh="Bo‘sh qoldirilsa — maosh hisoblanmaydi">
                          <input
                            name="qiymati"
                            inputMode="numeric"
                            defaultValue={q.stavka ?? ''}
                            placeholder="Masalan: 50000"
                            className={kirishKlass}
                          />
                        </Maydon>
                        <Yuborish kutish="…">Saqlash</Yuborish>
                      </form>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {yozadi && qatorlar.length > 0 && (
            <Card className="flex flex-col">
              <CardHeader title="Avans, bonus yoki jarima" meta={davrNomi(davr)} />
              <form action={harakatQosh} className="flex flex-col gap-3 px-5 pb-5">
                <input type="hidden" name="qaytish" value={joriy} />
                <input type="hidden" name="davr" value={davr} />
                <Maydon nom="Ustoz">
                  <select name="teacher_id" required defaultValue="" className={kirishKlass}>
                    <option value="" disabled>
                      Tanlang…
                    </option>
                    {qatorlar.map((q) => (
                      <option key={q.teacher_id} value={q.teacher_id}>
                        {q.ism}
                      </option>
                    ))}
                  </select>
                </Maydon>
                <Maydon nom="Turi">
                  <select name="turi" required defaultValue="" className={kirishKlass}>
                    <option value="" disabled>
                      Tanlang…
                    </option>
                    <option value="avans">Avans (ayiriladi)</option>
                    <option value="bonus">Bonus (qo‘shiladi)</option>
                    <option value="jarima">Jarima (ayiriladi)</option>
                  </select>
                </Maydon>
                <Maydon nom="Summa" izoh="Masalan: 300000 yoki 300 ming">
                  <input name="summa" required inputMode="numeric" className={kirishKlass} />
                </Maydon>
                <Maydon nom="Izoh">
                  <input name="izoh" placeholder="Masalan: darsga kech qoldi" className={kirishKlass} />
                </Maydon>
                <Yuborish kutish="Yozilmoqda…">Yozish</Yuborish>
              </form>
            </Card>
          )}

          <Card className="flex flex-col">
            <CardHeader title="Yozuvlar" meta={`${harakatlar.filter((h) => !h.bekor).length} ta`} />
            {harakatlar.length === 0 ? (
              <div className="px-5 pb-5">
                <Empty>Bu oyda avans, bonus yoki jarima yo‘q.</Empty>
              </div>
            ) : (
              <ul className="flex flex-col">
                {harakatlar.map((h) => (
                  <li key={h.id} className="flex flex-col gap-1.5 border-t border-line-soft px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
                          {TURLAR[h.turi]}
                          {h.bekor && <Badge>bekor</Badge>}
                        </span>
                        <span className="truncate text-[11.5px] text-ink-3">
                          {ismi.get(h.teacher_id) ?? h.teacher_id} · {vaqtFmt.format(new Date(h.created_at))}
                          {h.izoh ? ` · ${h.izoh}` : ''}
                        </span>
                        {h.bekor && h.bekor_sabab && <span className="text-[11.5px] text-ink-3">Sabab: {h.bekor_sabab}</span>}
                      </span>
                      <span
                        className={`tnum font-[family-name:var(--font-mono)] text-[13px] font-semibold ${
                          h.bekor ? 'text-ink-4 line-through' : h.turi === 'bonus' ? 'text-ok' : 'text-brand'
                        }`}
                      >
                        {h.turi === 'bonus' ? '+' : '−'}
                        {pul(h.summa)}
                      </span>
                    </div>
                    {yozadi && !h.bekor && (
                      <details>
                        <summary className="cursor-pointer text-[12px] text-ink-3 hover:text-ink">Bekor qilish</summary>
                        <form action={harakatBekor} className="mt-2 flex flex-wrap items-end gap-2">
                          <input type="hidden" name="id" value={h.id} />
                          <input type="hidden" name="qaytish" value={joriy} />
                          <Maydon nom="Sabab">
                            <input name="sabab" required placeholder="Masalan: xato yozilgan" className={kirishKlass} />
                          </Maydon>
                          <Yuborish tur="xavfli" kutish="…">
                            Bekor qilish
                          </Yuborish>
                        </form>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

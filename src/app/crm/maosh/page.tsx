import Link from 'next/link'
import { redirect } from 'next/navigation'
import { talabProfil, adminmi, tasdiqlaydimi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Empty, Badge } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { JonliForma } from '@/components/jonli-forma'
import { pul, davrNomi, joriyDavr } from '@/lib/format'
import type { MaoshHarakat, UstozMaosh } from '@/lib/types'
import { stavkaSaqla, harakatQosh, harakatBekor, oyTasdiqla, oyQaytaOch } from './actions'

export const metadata = { title: 'Maosh' }
export const dynamic = 'force-dynamic'

const TURLAR: Record<MaoshHarakat['turi'], string> = { avans: 'Avans', bonus: 'Bonus', jarima: 'Jarima', tuzatish: 'Tuzatish' }

const vaqtFmt = new Intl.DateTimeFormat('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit' })

/** Harakatning maoshga ta'siri: avans/jarima −, bonus +, tuzatish o'z ishorasi bilan */
function tasir(h: Pick<MaoshHarakat, 'turi' | 'summa'>): number {
  const s = Number(h.summa)
  return h.turi === 'avans' || h.turi === 'jarima' ? -s : s
}

/**
 * Ustoz maoshi (0075, Jamshid 17.10). Har o'quvchi uchun:
 * stavka ÷ N (oydagi darslar, kamida 12) × hisobga olinadigan darslar —
 * ketma-ket 3+ qoldirilgani ayiriladi. Zamena darsi o'rinbosarga.
 * Ustiga avans (−), bonus (+), jarima (−), tuzatish (±). Hisob bazada.
 *
 * Admin/direktor — hamma ustoz. Ustoz o'zinikini /crm/maosh/men da ko'radi.
 * Oy tugagach direktor tasdiqlaydi → xarajatlarga tushadi, oy qulflanadi.
 */
export default async function Maosh({
  searchParams,
}: {
  searchParams: Promise<{ davr?: string; ok?: string; xato?: string }>
}) {
  const profil = await talabProfil()
  if (!adminmi(profil.rol)) redirect('/crm/maosh/men')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Maosh" />

  const s = await searchParams
  const davr = /^\d{4}-(0[1-9]|1[0-2])$/.test(s.davr ?? '') ? s.davr! : joriyDavr()
  const joriy = `/crm/maosh?davr=${davr}`
  const direktor = tasdiqlaydimi(profil.rol)
  const tugagan = davr < joriyDavr()

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
  const tasdiqlangan = qatorlar.some((q) => q.tasdiqlangan)
  const yozadi = !tasdiqlangan
  const ismi = new Map(qatorlar.map((q) => [q.teacher_id, q.ism]))
  const jami = qatorlar.reduce((a, q) => a + Number(q.yakuniy), 0)
  const jamiOquvchi = qatorlar.reduce((a, q) => a + Number(q.oquvchilar), 0)
  const aniqmas = qatorlar.filter((q) => q.aniqmas).length

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Maosh"
        izoh={`${davrNomi(davr)} · stavka ÷ darslar × qatnashgan darslar`}
        amal={
          <JonliForma className="flex items-end gap-2">
            <input type="month" name="davr" defaultValue={davr} className={kirishKlass} aria-label="Oy" />
          </JonliForma>
        }
      />

      <Xabar ok={s.ok} xato={s.xato ?? (xato ? 'Maoshni o‘qib bo‘lmadi.' : undefined)} />

      <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2 text-[13.5px] font-semibold">
            {tasdiqlangan ? <Badge ton="ok">tasdiqlangan</Badge> : <Badge ton="accent">hisoblanmoqda</Badge>}
            {davrNomi(davr)}
          </span>
          <span className="text-[12px] text-ink-3">
            {tasdiqlangan
              ? 'Direktor tasdiqlagan, maoshlar xarajatlarga yozilgan. O‘zgartirish uchun direktor oyni qayta ochadi.'
              : tugagan
                ? 'Oy tugagan. Hisobni tekshiring, xato bo‘lsa tuzatish kiriting, keyin direktor tasdiqlaydi.'
                : 'Har davomatdan keyin avtomatik yangilanadi. Oy tugagach direktor tasdiqlaydi.'}
          </span>
        </div>
        {direktor && !tasdiqlangan && tugagan && (
          <form action={oyTasdiqla}>
            <input type="hidden" name="davr" value={davr} />
            <input type="hidden" name="qaytish" value={joriy} />
            <Yuborish tur="ok" kutish="Tasdiqlanmoqda…">
              Tasdiqlash va xarajatga yozish
            </Yuborish>
          </form>
        )}
        {direktor && tasdiqlangan && (
          <details>
            <summary className="cursor-pointer text-[12.5px] text-ink-3 hover:text-ink">Oyni qayta ochish</summary>
            <form action={oyQaytaOch} className="mt-2 flex flex-wrap items-end gap-2">
              <input type="hidden" name="davr" value={davr} />
              <input type="hidden" name="qaytish" value={joriy} />
              <Maydon nom="Sabab">
                <input name="sabab" required placeholder="Masalan: davomat xato edi" className={kirishKlass} />
              </Maydon>
              <Yuborish tur="xavfli" kutish="…">
                Qayta ochish
              </Yuborish>
            </form>
          </details>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Stat label={`${davrNomi(davr)} · jami`} value={pul(jami)} sub="to‘lanadigan maosh · so‘m" />
        <Stat label="O‘quvchilar" value={jamiOquvchi} sub="hisobga kirgan qatnashuvlar" />
        <Stat
          label="Stavkasiz"
          value={aniqmas}
          sub={aniqmas ? 'stavka belgilanmagan guruh bor' : 'hammasiga belgilangan'}
          ton={aniqmas ? 'brand' : 'ok'}
          border={aniqmas ? 'brand' : undefined}
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
                      <Link
                        href={`/crm/maosh/${q.teacher_id}?davr=${davr}`}
                        className="text-[13.5px] font-semibold hover:underline"
                      >
                        {q.ism}
                      </Link>
                      <span className="tnum text-[12px] text-ink-3">
                        {q.stavka === null
                          ? `${q.oquvchilar} o‘quvchi · stavka belgilanmagan`
                          : `${q.oquvchilar} o‘quvchi · stavka ${pul(q.stavka)} · hisob ${pul(q.hisob)}`}
                      </span>
                      {(Number(q.avans) > 0 || Number(q.bonus) > 0 || Number(q.jarima) > 0 || Number(q.tuzatish) !== 0) && (
                        <span className="tnum flex flex-wrap gap-x-3 text-[12px]">
                          {Number(q.avans) > 0 && <span className="text-ink-2">avans −{pul(q.avans)}</span>}
                          {Number(q.bonus) > 0 && <span className="text-ok">bonus +{pul(q.bonus)}</span>}
                          {Number(q.jarima) > 0 && <span className="text-brand">jarima −{pul(q.jarima)}</span>}
                          {Number(q.tuzatish) !== 0 && (
                            <span className="text-ink-2">
                              tuzatish {Number(q.tuzatish) > 0 ? '+' : '−'}
                              {pul(Math.abs(Number(q.tuzatish)))}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-2">
                      {q.aniqmas && <Badge>aniqlanmagan</Badge>}
                      <span className="tnum font-[family-name:var(--font-mono)] text-[15px] font-semibold">{pul(q.yakuniy)}</span>
                    </span>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-[12px] text-ink-3 hover:text-ink">Stavkani o‘zgartirish</summary>
                    <form action={stavkaSaqla} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="teacher_id" value={q.teacher_id} />
                      <input type="hidden" name="qaytish" value={joriy} />
                      <Maydon nom="Bitta o‘quvchi uchun (oyiga)" izoh="Bo‘sh qoldirilsa — maosh hisoblanmaydi">
                        <input
                          name="qiymati"
                          inputMode="numeric"
                          defaultValue={q.stavka ?? ''}
                          placeholder="Masalan: 220000"
                          className={kirishKlass}
                        />
                      </Maydon>
                      <Yuborish kutish="…">Saqlash</Yuborish>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {yozadi && qatorlar.length > 0 && (
            <Card className="flex flex-col">
              <CardHeader title="Avans, bonus, jarima yoki tuzatish" meta={davrNomi(davr)} />
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
                    <option value="tuzatish_plus">Tuzatish — qo‘shish</option>
                    <option value="tuzatish_minus">Tuzatish — ayirish</option>
                  </select>
                </Maydon>
                <Maydon nom="Summa" izoh="Masalan: 300000 yoki 300 ming">
                  <input name="summa" required inputMode="numeric" className={kirishKlass} />
                </Maydon>
                <Maydon nom="Izoh" izoh="Tuzatishda sabab majburiy">
                  <input name="izoh" placeholder="Masalan: davomat xato belgilangan" className={kirishKlass} />
                </Maydon>
                <Yuborish kutish="Yozilmoqda…">Yozish</Yuborish>
              </form>
            </Card>
          )}

          <Card className="flex flex-col">
            <CardHeader title="Yozuvlar" meta={`${harakatlar.filter((h) => !h.bekor).length} ta`} />
            {harakatlar.length === 0 ? (
              <div className="px-5 pb-5">
                <Empty>Bu oyda avans, bonus, jarima yoki tuzatish yo‘q.</Empty>
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
                          h.bekor ? 'text-ink-4 line-through' : tasir(h) > 0 ? 'text-ok' : 'text-brand'
                        }`}
                      >
                        {tasir(h) > 0 ? '+' : '−'}
                        {pul(Math.abs(Number(h.summa)))}
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

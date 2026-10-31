import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, Badge, Empty } from '@/components/ui'
import { Maydon, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { pul, sana, bugunToshkent } from '@/lib/format'
import { maoshTolovQosh, maoshTolovBekor } from './actions'

type Holat = { tur: string; kim: string; ism: string; lavozim: string; hisob: number; avans: number; maosh: number; qoldi: number }
type Tolov = {
  id: number
  turi: 'avans' | 'maosh'
  teacher_id: string | null
  profile_id: string | null
  boshqa_xodim_id: number | null
  summa: number
  sana: string
  izoh: string | null
}

const kalit = (t: Tolov) =>
  t.teacher_id ? `ustoz:${t.teacher_id}` : t.profile_id ? `xodim:${t.profile_id}` : `boshqa:${t.boshqa_xodim_id}`

/** Oy uchun kimga qancha hisoblandi, berildi va qoldi. To'lov xarajatga berilgan sana bilan tushadi (0112). */
export async function MaoshTolovlari({ davr, qaytish }: { davr: string; qaytish: string }) {
  const supabase = await createClient()
  const [{ data: holatXom, error }, { data: tolovXom }] = await Promise.all([
    supabase.rpc('maosh_tolov_holati', { p_davr: davr }),
    supabase
      .from('maosh_tolovlar')
      .select('id, turi, teacher_id, profile_id, boshqa_xodim_id, summa, sana, izoh')
      .eq('davr', davr)
      .eq('bekor', false)
      .order('sana'),
  ])
  const holat = (holatXom ?? []) as Holat[]
  const tolovlar = (tolovXom ?? []) as Tolov[]
  const jamiQoldi = holat.reduce((a, h) => a + Math.max(0, Number(h.qoldi)), 0)

  return (
    <Card className="flex flex-col">
      <CardHeader title="To‘lovlar" meta={`qoldi ${pul(jamiQoldi)} so‘m`} />
      {error ? (
        <div className="px-5 pb-5"><Empty>To‘lovlarni o‘qib bo‘lmadi.</Empty></div>
      ) : holat.length === 0 ? (
        <div className="px-5 pb-5"><Empty>Bu oyda hisob yoki to‘lov yo‘q.</Empty></div>
      ) : (
        <ul className="flex flex-col">
          {holat.map((h) => {
            const qoldi = Number(h.qoldi)
            const berildi = Number(h.avans) + Number(h.maosh)
            const uniki = tolovlar.filter((t) => kalit(t) === `${h.tur}:${h.kim}`)
            return (
              <li key={`${h.tur}:${h.kim}`} className="flex flex-col gap-2 border-t border-line-soft px-5 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-[13.5px] font-semibold">{h.ism}</span>
                    <span className="tnum text-[12px] text-ink-3">
                      {h.lavozim} · hisoblandi {pul(h.hisob)}
                      {Number(h.avans) > 0 && ` · avans ${pul(h.avans)}`}
                      {Number(h.maosh) > 0 && ` · maosh ${pul(h.maosh)}`}
                    </span>
                  </span>
                  {qoldi > 0 ? (
                    <Badge ton="accent">qoldi {pul(qoldi)}</Badge>
                  ) : berildi > 0 && qoldi === 0 ? (
                    <Badge ton="ok">olindi</Badge>
                  ) : qoldi < 0 ? (
                    <Badge ton="brand">ortiqcha {pul(-qoldi)}</Badge>
                  ) : (
                    <Badge ton="jim">hisob yo‘q</Badge>
                  )}
                </div>
                <details>
                  <summary className="cursor-pointer text-[12px] text-ink-3 hover:text-ink">
                    To‘lov kiritish{uniki.length > 0 ? ` · ${uniki.length} ta to‘lov` : ''}
                  </summary>
                  <div className="mt-2 flex flex-col gap-2">
                    {uniki.map((t) => (
                      <form key={t.id} action={maoshTolovBekor} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="qaytish" value={qaytish} />
                        <span className="tnum min-w-0 flex-1">
                          {sana(t.sana)} · {t.turi === 'avans' ? 'avans' : 'maosh'} · {pul(t.summa)}
                          {t.izoh ? ` · ${t.izoh}` : ''}
                        </span>
                        <input name="sabab" required placeholder="Bekor sababi" aria-label="Bekor sababi" className={`${kirishKlass} w-36`} />
                        <Yuborish tur="ikkilamchi" kutish="…">Bekor</Yuborish>
                      </form>
                    ))}
                    <form action={maoshTolovQosh} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="tur" value={h.tur} />
                      <input type="hidden" name="kim" value={h.kim} />
                      <input type="hidden" name="davr" value={davr} />
                      <input type="hidden" name="qaytish" value={qaytish} />
                      <Maydon nom="Turi">
                        <select name="turi" required defaultValue={h.tur === 'ustoz' ? 'avans' : 'maosh'} className={kirishKlass}>
                          <option value="avans">Avans</option>
                          <option value="maosh">Maosh</option>
                        </select>
                      </Maydon>
                      <Maydon nom="Summa">
                        <input name="summa" required inputMode="numeric" defaultValue={qoldi > 0 ? qoldi : ''} className={kirishKlass} />
                      </Maydon>
                      <Maydon nom="Berilgan sana">
                        <input type="date" name="sana" required max={bugunToshkent()} defaultValue={bugunToshkent()} className={kirishKlass} />
                      </Maydon>
                      <Maydon nom="Izoh">
                        <input name="izoh" className={kirishKlass} />
                      </Maydon>
                      <Yuborish kutish="…">Kiritish</Yuborish>
                    </form>
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

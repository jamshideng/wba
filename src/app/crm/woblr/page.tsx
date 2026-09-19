import Link from 'next/link'
import { talabProfil, getUstoz, adminmi, staffmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { woblrBer } from './actions'
import { davrNomi, joriyDavr } from '@/lib/format'
import { xatoMatni } from '@/lib/kiritish'
import type { LeaderboardRow } from '@/lib/types'

export const metadata = { title: 'Woblar' }
export const dynamic = 'force-dynamic'

/**
 * Woblar reytingi. Woblar — o'quvchini rag'batlantiruvchi mukofot birligi; darsda davomat bilan birga yoki shu yerda beriladi
 * (/crm/davomat). Reyting funksiya orqali olinadi: faqat ism va ball —
 * telefon, qarz, davomat chiqmaydi.
 *
 * Kim nimani ko'radi (Q6, bazada ham tekshiriladi — 0018):
 *   o'quvchi — butun markaz va o'zi o'qiydigan fan(lar); boshqa fan yo'q
 *   ustoz    — butun markaz, o'z fanlari va o'z guruhlari
 *   xodim    — hammasi
 * Tanlov bitta `k` parametrida: "markaz", "fan:ingliz-tili", "guruh:G05".
 */
type Korinish = { k: string; nom: string; guruh: string | null; fan: string | null }

export default async function Woblr({
  searchParams,
}: {
  searchParams: Promise<{ k?: string; guruh?: string; davr?: string; ok?: string; xato?: string }>
}) {
  const profil = await talabProfil()
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Woblar" />

  const s = await searchParams
  const supabase = await createClient()
  const oquvchimi = profil.rol === 'oquvchi'

  // RLS: ustozga o'z guruhlari, o'quvchiga o'zi o'qiydigan guruhlar, xodimga hammasi
  const { data: guruhlar } = await supabase
    .from('groups')
    .select('id, nom, subject_id, subjects(nom)')
    .eq('holat', 'faol')
    .order('nom')
  const gList = (guruhlar ?? []) as unknown as { id: string; nom: string; subject_id: string | null; subjects: { nom: string } | null }[]

  const fanlar = new Map<string, string>()
  for (const g of gList) if (g.subject_id) fanlar.set(g.subject_id, g.subjects?.nom ?? g.subject_id)

  const markaz: Korinish = { k: 'markaz', nom: 'Butun markaz', guruh: null, fan: null }
  const fanKorinish: Korinish[] = [...fanlar]
    .sort((a, b) => a[1].localeCompare(b[1], 'uz'))
    .map(([id, nom]) => ({ k: `fan:${id}`, nom, guruh: null, fan: id }))
  // O'quvchiga guruh bo'yicha tanlov berilmaydi — reyting markaz va fan bo'yicha (Q6)
  const guruhKorinish: Korinish[] = oquvchimi ? [] : gList.map((g) => ({ k: `guruh:${g.id}`, nom: g.nom, guruh: g.id, fan: null }))
  const hammasi = [markaz, ...fanKorinish, ...guruhKorinish]

  // Eski havolalar (?guruh=G05) ham ishlasin. Ustoz odatda o'z guruhida
  // woblar beradi — shuning uchun unga birinchi guruh ochiladi.
  const soralgan = s.k ?? (s.guruh ? `guruh:${s.guruh}` : undefined)
  const tanlov =
    hammasi.find((v) => v.k === soralgan) ??
    (profil.rol === 'ustoz' && guruhKorinish[0] ? guruhKorinish[0] : markaz)
  const guruh = tanlov.guruh
  const davr = s.davr === 'hammasi' ? null : /^\d{4}-\d{2}$/.test(s.davr ?? '') ? s.davr! : joriyDavr()

  const { data, error: reytingXato } = await supabase.rpc('woblr_leaderboard', {
    p_group: tanlov.guruh,
    p_fan: tanlov.fan,
    p_davr: davr,
  })
  const reyting = (data ?? []) as LeaderboardRow[]

  const { data: maxBall } = await supabase.from('settings').select('qiymat').eq('kalit', 'woblr.max_ball_dars').maybeSingle()

  /* Woblar berish huquqi: ustoz (o'z o'quvchisiga) yoki admin.
     Ro'yxatni RLS cheklaydi — ustozga faqat o'z guruhlari keladi. */
  const ustoz = await getUstoz()
  const beraOladi = Boolean(ustoz) || adminmi(profil.rol)

  const { data: qatnashuvchilar } = beraOladi && guruh
    ? await supabase
        .from('enrollments')
        .select('student_id, students(fish)')
        .eq('group_id', guruh)
        .neq('holat', 'tugagan')
    : { data: [] }

  const oquvchilar = ((qatnashuvchilar ?? []) as unknown as { student_id: string; students: { fish: string } | null }[])
    .map((e) => ({ id: e.student_id, fish: e.students?.fish ?? e.student_id }))
    .sort((a, b) => a.fish.localeCompare(b.fish, 'uz'))

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Woblar reytingi"
        izoh={`${tanlov.nom} · ${davr ? davrNomi(davr) : 'hamma vaqt'}`}
      />

      <Xabar ok={s.ok} xato={s.xato ?? (reytingXato ? xatoMatni(reytingXato) : undefined)} />

      <form className="flex flex-wrap items-end gap-2.5">
        <Maydon nom="Reyting">
          <select name="k" defaultValue={tanlov.k} className={kirishKlass}>
            <option value={markaz.k}>{markaz.nom}</option>
            {fanKorinish.length > 0 && (
              <optgroup label={oquvchimi ? 'Mening fanim' : 'Fan bo‘yicha'}>
                {fanKorinish.map((v) => (
                  <option key={v.k} value={v.k}>{v.nom}</option>
                ))}
              </optgroup>
            )}
            {guruhKorinish.length > 0 && (
              <optgroup label="Guruh bo‘yicha">
                {guruhKorinish.map((v) => (
                  <option key={v.k} value={v.k}>{v.nom}</option>
                ))}
              </optgroup>
            )}
          </select>
        </Maydon>
        <Maydon nom="Oy">
          <select name="davr" defaultValue={davr ?? 'hammasi'} className={kirishKlass}>
            <option value={joriyDavr()}>{davrNomi(joriyDavr())}</option>
            {davr && davr !== joriyDavr() && <option value={davr}>{davrNomi(davr)}</option>}
            <option value="hammasi">Hamma vaqt</option>
          </select>
        </Maydon>
        <button type="submit" className="min-h-11 rounded-[9px] border border-line px-5 text-[13.5px] text-ink-2 hover:text-ink">
          Ko‘rsatish
        </button>
      </form>

      <Card className="flex flex-col">
        <CardHeader title="Reyting" meta={`${reyting.length} o‘quvchi`} />
        {reyting.length === 0 ? (
          <div className="px-5 pb-5">
            <Empty>Bu davrda hali woblar berilmagan. Woblar davomat ekranida yoki pastdagi bo‘limda beriladi.</Empty>
          </div>
        ) : (
          <ol>
            {reyting.map((r) => (
              <li key={r.student_id} className="flex items-center gap-3 border-t border-line-soft px-5 py-3">
                <span
                  className={`tnum flex size-9 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-display)] text-[14px] font-bold ${
                    r.orin <= 3 ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-3'
                  }`}
                >
                  {r.orin}
                </span>
                {/* Profil faqat xodimga ochiq — ustoz va o'quvchiga oddiy ism */}
                {!staffmi(profil.rol) ? (
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{r.fish}</span>
                ) : (
                  <Link href={`/crm/oquvchilar/${r.student_id}`} className="min-w-0 flex-1 truncate text-[13.5px] font-semibold hover:text-brand">
                    {r.fish}
                  </Link>
                )}
                <Badge ton={r.ball > 0 ? 'accent' : 'brand'}>
                  {r.ball > 0 ? `+${r.ball}` : r.ball} W
                </Badge>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {beraOladi && guruh && oquvchilar.length > 0 && (
        <Card className="flex flex-col">
          <CardHeader title="Woblar berish" meta="davomatdan keyin ham beriladi" />
          <form action={woblrBer} className="grid gap-3 px-5 pb-5 sm:grid-cols-[2fr_1fr_1.2fr_1.5fr_auto] sm:items-end">
            <input type="hidden" name="guruh" value={guruh} />
            <Maydon nom="O‘quvchi">
              <select name="student_id" required defaultValue="" className={kirishKlass}>
                <option value="" disabled>Tanlang…</option>
                {oquvchilar.map((o) => (
                  <option key={o.id} value={o.id}>{o.fish}</option>
                ))}
              </select>
            </Maydon>
            <Maydon nom="Woblar" izoh="−10…+10">
              <input name="ball" type="number" min={-10} max={10} step={1} defaultValue={1} required className={kirishKlass} />
            </Maydon>
            <Maydon nom="Sabab">
              <select name="sabab" defaultValue="faollik" className={kirishKlass}>
                <option value="faollik">Faollik</option>
                <option value="uy_vazifasi">Uy vazifasi</option>
                <option value="yordam">Yordam berdi</option>
                <option value="qoida">Qoida buzdi</option>
                <option value="boshqa">Boshqa</option>
              </select>
            </Maydon>
            <Maydon nom="Izoh">
              <input name="izoh" placeholder="Ixtiyoriy" className={kirishKlass} />
            </Maydon>
            <Yuborish>Berish</Yuborish>
          </form>
        </Card>
      )}

      {/* Woblar beradiganlar uchun eslatma — o'quvchiga keraksiz */}
      {beraOladi && (
        <p className="text-[12px] text-ink-3">
          Bir darsda eng ko‘p woblar: {maxBall?.qiymat != null ? String(maxBall.qiymat) : '[ANIQLANMAGAN]'} ·
          bazadagi chegara −10…+10.
        </p>
      )}
    </div>
  )
}

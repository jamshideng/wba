import Link from 'next/link'
import { IconMedal } from '@/components/icons'
import { talabProfil, adminmi, staffmi, getUstoz } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Badge, Card, CardHeader, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { JonliForma } from '@/components/jonli-forma'
import { Yuborish } from '@/components/yuborish'
import { SanaKiritish } from '@/components/sana-kiritish'
import { xatoMatni } from '@/lib/kiritish'
import { guruhUstozsiz } from '@/lib/format'
import {
  ballTon,
  davrNomi,
  type FanReytingQatori,
  type GuruhReytingQatori,
  type ReytingDavr,
  type ReytingTarixQatori,
  type ReytingTur,
} from '@/lib/reyting'
import { reytingHisobla } from './actions'

export const metadata = { title: 'Reyting' }
export const dynamic = 'force-dynamic'

/** 1–3-o'rin raqam o'rniga medal */
const MEDAL = [
  { nom: 'oltin', sinf: 'bg-oltin-soft text-oltin' },
  { nom: 'kumush', sinf: 'bg-kumush-soft text-kumush' },
  { nom: 'bronza', sinf: 'bg-bronza-soft text-bronza' },
] as const

type Variant = { k: string; nom: string; guruh: string | null; fan: string | null }
type Qator = (GuruhReytingQatori | FanReytingQatori) & { yangi?: boolean; guruh?: string | null }

const son = (x: number | null | undefined) => (x == null ? '—' : String(Number(x)))

/**
 * O'quvchi reytingi (0139). Snapshot — har hafta (yakshanba kechasi) va har oy
 * (keyingi oyning N-sanasi) hisoblanadi; bu sahifa faqat o'qiydi.
 *
 * Kim nimani ko'radi (bazada ham tekshiriladi):
 *   o'quvchi / ota-ona — o'z guruhi to'liq + o'z o'rni, fan bo'yicha top 10 + o'z o'rni, tarix;
 *                        boshqalarning faqat ismi va umumiy bali;
 *   ustoz   — o'z guruhlari to'liq, o'z fanlari top 10;
 *   xodim   — hammasi; rahbariyat qo'lda qayta hisoblaydi.
 * Butun markaz bo'yicha reyting yo'q.
 */
export default async function Reyting({
  searchParams,
}: {
  searchParams: Promise<{ tur?: string; d?: string; k?: string; f?: string; ok?: string; xato?: string }>
}) {
  const profil = await talabProfil()
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Reyting" />

  const s = await searchParams
  const tur: ReytingTur = s.tur === 'oylik' ? 'oylik' : 'haftalik'
  const supabase = await createClient()
  const xodim = staffmi(profil.rol)
  const rahbar = adminmi(profil.rol)

  // Sinov davri (0139): o'quvchi reytingi hozircha faqat rahbariyatga. Bazada ham yopiq.
  if (!rahbar) {
    const { data: ochiq } = await supabase.rpc('reyting_ochiqmi', {})
    if (!ochiq) {
      return (
        <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
          <Sarlavha nom="Reyting" />
          <Empty>Reyting sinov bosqichida — tez orada shu yerda ko‘rinadi.</Empty>
        </div>
      )
    }
  }

  // Kimning nomidan: o'quvchi — o'zi, ota-ona — tanlangan farzandi
  let men: string | null = null
  let farzandlar: { id: string; fish: string }[] = []
  if (profil.rol === 'oquvchi') {
    const { data } = await supabase.from('students').select('id').eq('profile_id', profil.id).maybeSingle()
    men = (data?.id as string | undefined) ?? null
  } else if (profil.rol === 'ota_ona') {
    const { data } = await supabase.from('students').select('id, fish').eq('ota_ona_id', profil.id).order('fish')
    farzandlar = (data ?? []) as { id: string; fish: string }[]
    men = farzandlar.find((x) => x.id === s.f)?.id ?? farzandlar[0]?.id ?? null
  }

  const { data: dXom, error: dXato } = await supabase.rpc('reyting_davrlari', { p_tur: tur })
  const davrlar = (dXom ?? []) as ReytingDavr[]
  const davr = davrlar.find((x) => String(x.id) === s.d) ?? davrlar[0] ?? null

  // Tarix va o'quvchining shu davrdagi guruh/fanlari
  const { data: tXom } = men ? await supabase.rpc('reyting_tarixim', { p_student: men }) : { data: [] }
  const tarix = (tXom ?? []) as ReytingTarixQatori[]

  // Tanlov variantlari
  const guruhV: Variant[] = []
  const fanV: Variant[] = []
  if (men) {
    for (const r of tarix.filter((x) => davr && x.davr_id === davr.id)) {
      if (!guruhV.some((v) => v.guruh === r.group_id)) guruhV.push({ k: `guruh:${r.group_id}`, nom: r.guruh, guruh: r.group_id, fan: null })
      if (r.subject_id && !fanV.some((v) => v.fan === r.subject_id)) fanV.push({ k: `fan:${r.subject_id}`, nom: r.fan ?? r.subject_id, guruh: null, fan: r.subject_id })
    }
  } else if (xodim || profil.rol === 'ustoz') {
    const ustoz = xodim ? null : await getUstoz()
    const { data: gXom } = await supabase.from('groups').select('id, nom, subject_id, teacher_id, subjects(nom)').eq('holat', 'faol').order('nom')
    const gList = ((gXom ?? []) as unknown as { id: string; nom: string; subject_id: string | null; teacher_id: string | null; subjects: { nom: string } | null }[])
      .filter((g) => xodim || g.teacher_id === ustoz?.id)
    for (const g of gList) {
      guruhV.push({ k: `guruh:${g.id}`, nom: xodim ? g.nom : guruhUstozsiz(g.nom), guruh: g.id, fan: null })
      if (g.subject_id && !fanV.some((v) => v.fan === g.subject_id)) fanV.push({ k: `fan:${g.subject_id}`, nom: g.subjects?.nom ?? g.subject_id, guruh: null, fan: g.subject_id })
    }
    fanV.sort((a, b) => a.nom.localeCompare(b.nom, 'uz'))
  }
  const tanlov = [...guruhV, ...fanV].find((v) => v.k === s.k) ?? guruhV[0] ?? fanV[0] ?? null

  let qatorlar: Qator[] = []
  let xato: string | undefined = dXato ? xatoMatni(dXato) : undefined
  if (davr && tanlov) {
    const { data, error } = tanlov.guruh
      ? await supabase.rpc('reyting_guruh', { p_davr: davr.id, p_group: tanlov.guruh, p_student: men })
      : await supabase.rpc('reyting_fan', { p_davr: davr.id, p_fan: tanlov.fan!, p_student: men })
    if (error) xato = xatoMatni(error)
    // bir fanda ikki guruh bo'lsa o'zi ikki marta chiqmasin
    qatorlar = ((data ?? []) as Qator[]).filter((q, i, a) => a.findIndex((x) => x.student_id === q.student_id) === i)
  }
  const fanmi = Boolean(tanlov?.fan)
  const yopiqFan = fanmi && !xodim
  const toliq = qatorlar.some((q) => !q.menmi && q.davomat != null)
  const oylik = tur === 'oylik'
  const qaytish = `/crm/reyting?tur=${tur}${davr ? `&d=${davr.id}` : ''}${tanlov ? `&k=${encodeURIComponent(tanlov.k)}` : ''}${s.f ? `&f=${s.f}` : ''}`

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha
        nom="Reyting"
        izoh={davr ? `${davrNomi(tur, davr.dan, davr.gacha)}${tanlov ? ` · ${tanlov.nom}` : ''}` : tur === 'oylik' ? 'oylik' : 'haftalik'}
      />
      <Xabar ok={s.ok} xato={s.xato ?? xato} />

      <JonliForma className="flex flex-wrap items-end gap-2.5">
        {farzandlar.length > 1 && (
          <Maydon nom="Farzand">
            <select name="f" defaultValue={men ?? ''} className={kirishKlass}>
              {farzandlar.map((x) => (
                <option key={x.id} value={x.id}>{x.fish}</option>
              ))}
            </select>
          </Maydon>
        )}
        <Maydon nom="Davr turi">
          <select name="tur" defaultValue={tur} className={kirishKlass}>
            <option value="haftalik">Haftalik</option>
            <option value="oylik">Oylik</option>
          </select>
        </Maydon>
        {davrlar.length > 0 && (
          <Maydon nom={oylik ? 'Oy' : 'Hafta'}>
            <select name="d" defaultValue={davr ? String(davr.id) : ''} className={kirishKlass}>
              {davrlar.map((x) => (
                <option key={x.id} value={x.id}>{davrNomi(tur, x.dan, x.gacha)}</option>
              ))}
            </select>
          </Maydon>
        )}
        {(guruhV.length > 0 || fanV.length > 0) && (
          <Maydon nom="Reyting">
            <select name="k" defaultValue={tanlov?.k ?? ''} className={kirishKlass}>
              {guruhV.length > 0 && (
                <optgroup label="Guruh bo‘yicha">
                  {guruhV.map((v) => <option key={v.k} value={v.k}>{v.nom}</option>)}
                </optgroup>
              )}
              {fanV.length > 0 && (
                <optgroup label="Fan bo‘yicha">
                  {fanV.map((v) => <option key={v.k} value={v.k}>{v.nom}</option>)}
                </optgroup>
              )}
            </select>
          </Maydon>
        )}
      </JonliForma>

      {!davr ? (
        <Empty>
          {oylik ? 'Oylik' : 'Haftalik'} reyting hali hisoblanmagan. Haftalik reyting har yakshanba kechasi,
          oylik — keyingi oyning belgilangan sanasida hisoblanadi.
        </Empty>
      ) : !tanlov ? (
        <Empty>Bu davrda reytingda qatnashgan guruh yo‘q.</Empty>
      ) : (
        <Card className="flex flex-col">
          <CardHeader
            title={yopiqFan ? 'Fan bo‘yicha · eng yaxshi 10 ta' : fanmi ? 'Fan bo‘yicha' : 'Guruh ichida'}
            meta={oylik ? 'oylik test · davomat · darsdagi woblar' : 'davomat · darsdagi woblar'}
            action={
              <span className="flex size-8 items-center justify-center text-accent" title="Reyting">
                <IconMedal size={22} />
              </span>
            }
          />
          {qatorlar.length === 0 ? (
            <div className="px-5 pb-5"><Empty>Bu tanlovda reyting yo‘q.</Empty></div>
          ) : (
            <ol>
              {qatorlar.map((r, i) => {
                const ajratish = yopiqFan && r.menmi && (r.orin == null || r.orin > 10)
                const omillar = r.davomat != null
                return (
                  <li
                    key={r.student_id}
                    className={`flex items-center gap-3 px-5 py-3 ${ajratish ? 'mt-1 border-t-2 border-dashed border-line bg-surface-2' : i ? 'border-t border-line-soft' : ''} ${r.menmi ? 'bg-accent-soft/40' : ''}`}
                  >
                    {r.orin == null ? (
                      <span className="flex w-9 shrink-0 justify-center"><Badge>yangi</Badge></span>
                    ) : r.orin <= 3 ? (
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${MEDAL[r.orin - 1].sinf}`} title={`${r.orin}-o‘rin · ${MEDAL[r.orin - 1].nom}`}>
                        <IconMedal size={22} />
                        <span className="sr-only">{r.orin}-o‘rin</span>
                      </span>
                    ) : (
                      <span className="tnum flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 font-[family-name:var(--font-display)] text-[14px] font-bold text-ink-3">
                        {r.orin}
                      </span>
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      {xodim ? (
                        <Link href={`/crm/oquvchilar/${r.student_id}`} className="truncate text-[13.5px] font-semibold hover:text-brand">{r.fish}</Link>
                      ) : (
                        <span className="truncate text-[13.5px] font-semibold">
                          {r.fish}
                          {r.menmi && <span className="ml-1.5 text-[12px] font-normal text-ink-3">· {profil.rol === 'ota_ona' ? 'farzandingiz' : 'siz'}</span>}
                        </span>
                      )}
                      {omillar && (
                        <span className="truncate text-[11.5px] text-ink-3">
                          davomat {son(r.davomat)}% · woblar {son(r.woblar)}
                          {oylik && ` · test ${r.test == null ? 'o‘tkazilmagan' : `${son(r.test)}%`}`}
                          {r.darslar != null && ` · ${r.kelgan}/${r.darslar} dars`}
                          {fanmi && r.guruh && ` · ${xodim ? r.guruh : guruhUstozsiz(r.guruh)}`}
                        </span>
                      )}
                    </span>
                    <span className={`tnum w-14 shrink-0 text-right font-[family-name:var(--font-display)] text-[19px] font-extrabold ${r.orin == null ? 'text-ink-3' : ballTon(r.umumiy) === 'ok' ? 'text-ok' : ballTon(r.umumiy) === 'accent' ? 'text-accent' : 'text-brand'}`}>
                      {son(r.umumiy)}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
          {!toliq && qatorlar.length > 0 && (
            <p className="border-t border-line-soft px-5 py-2.5 text-[11.5px] text-ink-3">
              Boshqa o‘quvchilarning faqat umumiy bali ko‘rinadi. “Yangi” — davrda darslar kam, o‘rin berilmaydi.
            </p>
          )}
        </Card>
      )}

      {men && (
        <Card className="flex flex-col">
          <CardHeader title="Tarix" meta="har davrdagi o‘rin" />
          {tarix.length === 0 ? (
            <div className="px-5 pb-5"><Empty>Hali reyting hisoblanmagan.</Empty></div>
          ) : (
            <ul>
              {tarix.map((t) => (
                <li key={`${t.davr_id}-${t.group_id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-soft px-5 py-2.5 text-[13px]">
                  <span className="w-28 shrink-0 font-semibold">{davrNomi(t.tur, t.dan, t.gacha)}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-2">{t.fan ?? guruhUstozsiz(t.guruh)}</span>
                  {t.yangi ? (
                    <Badge>yangi</Badge>
                  ) : (
                    <span className="text-ink-2">
                      guruhda <b>{t.orin_guruh}</b>/{t.guruh_soni}
                      {t.orin_fan != null && <> · fanda <b>{t.orin_fan}</b>-o‘rin</>}
                    </span>
                  )}
                  <Badge ton={ballTon(t.umumiy)}>{son(t.umumiy)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {rahbar && (
        <Card className="flex flex-col">
          <CardHeader
            title="Hisoblash"
            meta="odatda avtomatik: haftalik — yakshanba kechasi, oylik — N-sana kechasi"
            action={<Link href="/crm/reyting/ustozlar" className="text-[12.5px] font-semibold text-accent hover:text-brand">Ustozlar reytingi →</Link>}
          />
          <form action={reytingHisobla} className="flex flex-wrap items-end gap-2.5 px-5 pb-5">
            <input type="hidden" name="qaytish" value={qaytish} />
            <Maydon nom="Davr turi">
              <select name="tur" defaultValue={tur} className={kirishKlass}>
                <option value="haftalik">Haftalik</option>
                <option value="oylik">Oylik</option>
              </select>
            </Maydon>
            <Maydon nom="Davr ichidagi kun" izoh="bo‘sh — joriy hafta / o‘tgan oy">
              <SanaKiritish name="sana" className={kirishKlass} />
            </Maydon>
            <Yuborish tur="ikkilamchi" kutish="Hisoblanmoqda…">Hisoblash</Yuborish>
            <p className="w-full text-[11.5px] text-ink-3">
              Shu davr avval hisoblangan bo‘lsa, joriy sozlamalar bilan qayta hisoblanadi. Tugamagan davr hisoblanmaydi.{' '}
              <Link href="/crm/sozlamalar/reyting" className="font-semibold text-accent hover:text-brand">Sozlamalar</Link>
            </p>
          </form>
        </Card>
      )}
    </div>
  )
}

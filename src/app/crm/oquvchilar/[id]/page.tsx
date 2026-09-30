import Link from 'next/link'
import { notFound } from 'next/navigation'
import { talabRol, staffmi, adminmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Stat, Badge, Empty, Button } from '@/components/ui'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { guruhgaBiriktir, guruhdanChiqar, chegirmaOzgartir, tuzatishQosh, tuzatishBekor } from '../actions'
import { ChegirmaMaydonlari } from '../bolaklar'
import { HisobForma } from '@/components/hisob'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { IconArrowLeft, IconPhone } from '@/components/icons'
import { pul, sana, telefon, jadval, davrNomi, joriyDavr, bugunToshkent } from '@/lib/format'
import type { StudentStatus, PaymentMethod, AttendanceStatus } from '@/lib/types'

export const metadata = { title: 'O‘quvchi profili' }
export const dynamic = 'force-dynamic'

const HOLAT_NOMI: Record<StudentStatus, string> = {
  faol: 'Faol',
  tanaffus: 'Tanaffus',
  ketgan: 'Ketgan',
}

const USUL_NOMI: Record<PaymentMethod, string> = {
  naqd: 'Naqd',
  karta: 'Karta',
  click: 'Click',
  payme: 'Payme',
}

const DAVOMAT_NOMI: Record<AttendanceStatus, string> = {
  keldi: 'Keldi',
  kechikdi: 'Kechikdi',
  sababli: 'Sababli',
  kelmadi: 'Kelmadi',
}

export default async function OquvchiProfil({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  const [{ id }, xabar] = await Promise.all([params, searchParams])
  // Ustozda faqat botdagi huquq: davomat, guruhlari, woblar. O'quvchi
  // profili (telefonlar, to'lovlar) — xodim ishi.
  const profil = await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="O‘quvchi profili" />

  const supabase = await createClient()
  const pulKoradi = staffmi(profil.rol)

  const { data: oquvchi } = await supabase
    .from('students')
    .select('id, fish, tugilgan_sana, ota_tel, ona_tel, shaxsiy_tel, qoshilgan_sana, holat, izoh, profile_id')
    .eq('id', id)
    .maybeSingle()

  if (!oquvchi) notFound()

  const davr = joriyDavr()

  const [
    { data: yozilishlar },
    { data: balans },
    { data: tolovlar },
    { data: davomat },
    { data: woblr },
    { data: barchaGuruhlar },
    { data: tuzatishlar },
  ] = await Promise.all([
    supabase
      .from('enrollments')
      .select(
        'id, group_id, boshlandi, tugadi, holat, chegirma_summa, chegirma_oy, chegirma2_summa, chegirma2_oy, chegirma_sabab, groups(nom, boshlanish, tugash, kunlar, oylik_narx, teachers(ism))',
      )
      .eq('student_id', id)
      .order('boshlandi', { ascending: false }),
    supabase.from('v_enrollment_balance').select('enrollment_id, hisoblangan, tolangan, qarz').eq('student_id', id),
    pulKoradi
      ? supabase
          .from('payments')
          .select('id, sana, davr, summa, usul, tasdiqlangan, bekor, izoh, manba')
          .eq('student_id', id)
          .order('sana', { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] }),
    supabase.from('v_attendance_monthly').select('davr, group_id, darslar, kelgan, foiz').eq('student_id', id).order('davr', { ascending: false }).limit(6),
    supabase.from('v_woblr_balance').select('jami_ball, sarflangan, balans').eq('student_id', id).maybeSingle(),
    pulKoradi
      ? supabase.from('groups').select('id, nom').eq('holat', 'faol').order('nom')
      : Promise.resolve({ data: [] as { id: string; nom: string }[] }),
    // RLS: pulni ko'radiganlar; o'quvchining yozilishlari bo'yicha
    pulKoradi
      ? supabase
          .from('tuzatishlar')
          .select('id, enrollment_id, davr, summa, sabab, bekor, bekor_sabab, created_at, enrollments!inner(student_id)')
          .eq('enrollments.student_id', id)
          .order('davr', { ascending: false })
          .order('id', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  /* Hisobi bormi — email profilda turadi (0012), RLS uni adminga ko'rsatadi */
  const { data: hisob } = pulKoradi && oquvchi.profile_id
    ? await supabase.from('profiles').select('email').eq('id', oquvchi.profile_id).maybeSingle()
    : { data: null }

  /* Ota-ona hisobi bormi — profiles.oquvchi_id bo'yicha (0019) */
  const { data: otaOnaHisob } = pulKoradi
    ? await supabase.from('profiles').select('email, ism').eq('oquvchi_id', oquvchi.id).eq('rol', 'ota_ona').maybeSingle()
    : { data: null }

  type Yozilish = {
    id: string
    group_id: string
    boshlandi: string
    tugadi: string | null
    holat: string
    chegirma_summa: number
    chegirma_oy: number | null
    chegirma2_summa: number
    chegirma2_oy: number | null
    chegirma_sabab: string | null
    groups: {
      nom: string
      boshlanish: string
      tugash: string
      kunlar: number[]
      oylik_narx: number
      teachers: { ism: string } | null
    } | null
  }

  const yList = (yozilishlar ?? []) as unknown as Yozilish[]
  const bMap = new Map(
    ((balans ?? []) as { enrollment_id: string; hisoblangan: number; tolangan: number; qarz: number }[]).map(
      (b) => [b.enrollment_id, b],
    ),
  )

  type TuzatishQatori = { id: number; enrollment_id: string; davr: string; summa: number; sabab: string; bekor: boolean; bekor_sabab: string | null }
  const tuzList = (tuzatishlar ?? []) as unknown as TuzatishQatori[]
  const tuzatishAdmin = adminmi(profil.rol)

  const jamiQarz = [...bMap.values()].reduce((a, b) => a + (Number(b.qarz) || 0), 0)
  const jamiTolangan = [...bMap.values()].reduce((a, b) => a + (Number(b.tolangan) || 0), 0)

  type Tolov = {
    id: number
    sana: string
    davr: string
    summa: number
    usul: PaymentMethod | null
    tasdiqlangan: boolean
    bekor: boolean
    izoh: string | null
    manba: string
  }
  const tList = (tolovlar ?? []) as unknown as Tolov[]

  type Davomat = { davr: string; group_id: string; darslar: number; kelgan: number; foiz: number }
  const dList = (davomat ?? []) as unknown as Davomat[]

  const w = (woblr ?? null) as { jami_ball: number; sarflangan: number; balans: number } | null

  const telefonlar = [
    oquvchi.shaxsiy_tel ? { nom: 'Shaxsiy', raqam: oquvchi.shaxsiy_tel } : null,
    oquvchi.ota_tel ? { nom: 'Ota', raqam: oquvchi.ota_tel } : null,
    oquvchi.ona_tel ? { nom: 'Ona', raqam: oquvchi.ona_tel } : null,
  ].filter((x): x is { nom: string; raqam: string } => Boolean(x))

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Link
        href="/crm/oquvchilar"
        className="flex items-center gap-2 text-[13px] text-ink-3 transition hover:text-ink"
      >
        <IconArrowLeft size={15} />
        O‘quvchilar
      </Link>

      <Sarlavha
        nom={oquvchi.fish}
        izoh={
          <>
            {oquvchi.id} · qo‘shilgan {sana(oquvchi.qoshilgan_sana)}
            {oquvchi.tugilgan_sana ? ` · tug‘ilgan ${sana(oquvchi.tugilgan_sana)}` : ''}
          </>
        }
        amal={
          <div className="flex flex-wrap items-center gap-2">
            <Badge ton={oquvchi.holat === 'faol' ? 'ok' : oquvchi.holat === 'tanaffus' ? 'accent' : 'jim'}>
              {HOLAT_NOMI[oquvchi.holat as StudentStatus]}
            </Badge>
            {pulKoradi && (
              <>
                <Button href={`/crm/oquvchilar/${oquvchi.id}/tahrir`} variant="ikkilamchi">
                  Tahrirlash
                </Button>
                <Button href={`/crm/tolovlar/yangi?oquvchi=${oquvchi.id}`}>To‘lov qo‘shish</Button>
              </>
            )}
          </div>
        }
      />

      <Xabar ok={xabar.ok} xato={xabar.xato} />

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {pulKoradi && (
          <>
            <Stat label="Qarz" value={jamiQarz} sub="so‘m" ton={jamiQarz > 0 ? 'brand' : 'ok'} border={jamiQarz > 0 ? 'brand' : undefined} />
            <Stat label="Jami to‘langan" value={jamiTolangan} sub="so‘m" />
          </>
        )}
        <Stat
          label="Guruhlari"
          value={yList.filter((y) => y.holat !== 'tugagan').length}
          sub={`jami ${yList.length} ta yozilish`}
        />
        <Stat
          label="Woblar"
          value={w ? Number(w.balans) : 0}
          sub={w ? `jami ${Number(w.jami_ball)} woblar olgan` : 'hali woblar berilmagan'}
          ton="accent"
        />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* ── Guruhlari ── */}
        <Card className="flex flex-col">
          <CardHeader title="Guruhlari" meta={`${yList.length} ta`} />
          <div className="flex flex-col gap-2.5 px-5 pb-4">
            {yList.length === 0 ? (
              <Empty>Hech qaysi guruhga yozilmagan.</Empty>
            ) : (
              yList.map((y) => {
                const b = bMap.get(y.id)
                const qarz = Number(b?.qarz ?? 0)
                return (
                  <div
                    key={y.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-[10px] border border-line px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-[13.5px] font-semibold">{y.groups?.nom ?? '—'}</span>
                      <span className="text-[12px] text-ink-3">
                        {y.groups?.teachers?.ism ?? '[ANIQLANMAGAN]'} ·{' '}
                        {jadval(y.groups?.boshlanish ?? null, y.groups?.tugash ?? null, y.groups?.kunlar ?? null)}
                      </span>
                      <span className="text-[12px] text-ink-3">
                        {sana(y.boshlandi)} dan {y.tugadi ? `${sana(y.tugadi)} gacha` : 'hozirgacha'}
                        {y.chegirma_summa > 0 && (
                          <>
                            {' · chegirma '}
                            {pul(y.chegirma_summa)}
                            {y.chegirma_oy === null ? ' (doimiy)' : ` (${y.chegirma_oy} oy)`}
                            {y.chegirma2_summa > 0 &&
                              ` → ${pul(y.chegirma2_summa)}${y.chegirma2_oy === null ? ' (doimiy)' : ` (${y.chegirma2_oy} oy)`}`}
                          </>
                        )}
                      </span>
                    </div>

                    {pulKoradi && (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="lbl">oyiga {pul(y.groups?.oylik_narx ?? 0)}</span>
                        <span
                          className={`tnum font-[family-name:var(--font-mono)] text-[13px] ${
                            qarz > 0 ? 'text-brand' : 'text-ok'
                          }`}
                        >
                          {qarz > 0 ? `qarz ${pul(qarz)}` : 'qarzi yo‘q'}
                        </span>
                      </div>
                    )}

                    {pulKoradi && y.holat !== 'tugagan' && (
                      <details className="w-full">
                        <summary className="cursor-pointer text-[12px] text-ink-3 hover:text-ink">Chegirmani o‘zgartirish</summary>
                        <form action={chegirmaOzgartir} className="mt-2 flex flex-col gap-2">
                          <input type="hidden" name="student_id" value={oquvchi.id} />
                          <input type="hidden" name="enrollment_id" value={y.id} />
                          <ChegirmaMaydonlari qiymat={y} ochiq sarlavha="Bosqichlar" />
                          <p className="text-[11.5px] text-ink-3">
                            Saqlanganda hamma oylar yangi chegirma bilan qayta hisoblanadi (Sheets’dagi kabi).
                          </p>
                          <Yuborish kutish="…">Chegirmani saqlash</Yuborish>
                        </form>
                      </details>
                    )}

                    {pulKoradi && tuzList.some((t) => t.enrollment_id === y.id) && (
                      <div className="flex w-full flex-col gap-1.5 rounded-[9px] bg-surface-2 px-3 py-2.5">
                        <span className="lbl">Tuzatishlar (oydan ayirilgan)</span>
                        {tuzList
                          .filter((t) => t.enrollment_id === y.id)
                          .map((t) => (
                            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                              <span className={t.bekor ? 'text-ink-4 line-through' : ''}>
                                {davrNomi(t.davr)} · −{pul(t.summa)} · {t.sabab}
                              </span>
                              {t.bekor ? (
                                <span className="text-[11px] text-ink-4">bekor{t.bekor_sabab ? `: ${t.bekor_sabab}` : ''}</span>
                              ) : (
                                tuzatishAdmin && (
                                  <form action={tuzatishBekor}>
                                    <input type="hidden" name="student_id" value={oquvchi.id} />
                                    <input type="hidden" name="id" value={t.id} />
                                    <button type="submit" className="min-h-11 px-2 text-[12px] text-ink-3 transition hover:text-brand">
                                      Bekor qilish
                                    </button>
                                  </form>
                                )
                              )}
                            </div>
                          ))}
                      </div>
                    )}

                    {tuzatishAdmin && y.holat !== 'tugagan' && (
                      <details className="w-full">
                        <summary className="cursor-pointer text-[12px] text-ink-3 hover:text-ink">Tuzatish — shu oydan ayirish</summary>
                        <form action={tuzatishQosh} className="mt-2 flex flex-col gap-2">
                          <input type="hidden" name="student_id" value={oquvchi.id} />
                          <input type="hidden" name="enrollment_id" value={y.id} />
                          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr]">
                            <Maydon nom="Oy">
                              <input type="month" name="davr" required defaultValue={davr} className={kirishKlass} />
                            </Maydon>
                            <Maydon nom="Ayiriladi">
                              <input name="summa" required inputMode="decimal" placeholder="150 000" className={kirishKlass} />
                            </Maydon>
                            <Maydon nom="Sabab">
                              <input name="sabab" required placeholder="Masalan: kasal, 3 dars" className={kirishKlass} />
                            </Maydon>
                          </div>
                          <p className="text-[11.5px] text-ink-3">
                            Faqat tanlangan oy uchun: o‘sha oyning to‘lovidan ayiriladi, keyingi oylar o‘zgarmaydi (Sheets’dagi “Tuzatishlar” kabi).
                          </p>
                          <Yuborish kutish="…">Tuzatishni yozish</Yuborish>
                        </form>
                      </details>
                    )}

                    {pulKoradi && y.holat !== 'tugagan' && (
                      <details className="w-full">
                        <summary className="cursor-pointer text-[12px] text-ink-3 hover:text-ink">Guruhdan chiqarish</summary>
                        <form action={guruhdanChiqar} className="mt-2 flex flex-wrap items-end gap-2">
                          <input type="hidden" name="student_id" value={oquvchi.id} />
                          <input type="hidden" name="enrollment_id" value={y.id} />
                          <Maydon nom="Oxirgi kuni" izoh="Keyingi oylar hisobdan olinadi">
                            <input type="date" name="sana" required defaultValue={bugunToshkent()} min={y.boshlandi} className={kirishKlass} />
                          </Maydon>
                          <Yuborish tur="xavfli" kutish="…">Chiqarish</Yuborish>
                        </form>
                      </details>
                    )}
                  </div>
                )
              })
            )}

            {pulKoradi && (
              <details className="rounded-[10px] border border-dashed border-line px-4 py-3">
                <summary className="cursor-pointer text-[13px] font-semibold text-ink-2">+ Guruhga biriktirish</summary>
                <form action={guruhgaBiriktir} className="mt-3 flex flex-col gap-3">
                  <input type="hidden" name="student_id" value={oquvchi.id} />
                  <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                    <Maydon nom="Guruh">
                      <select name="group_id" required defaultValue="" className={kirishKlass}>
                        <option value="" disabled>Tanlang…</option>
                        {((barchaGuruhlar ?? []) as { id: string; nom: string }[])
                          .filter((g) => !yList.some((y) => y.group_id === g.id && y.holat !== 'tugagan'))
                          .map((g) => (
                            <option key={g.id} value={g.id}>{g.nom}</option>
                          ))}
                      </select>
                    </Maydon>
                    <Maydon nom="Boshlagan sana">
                      <input type="date" name="boshlandi" defaultValue={bugunToshkent()} className={kirishKlass} />
                    </Maydon>
                  </div>
                  <ChegirmaMaydonlari />
                  <Yuborish>Biriktirish</Yuborish>
                </form>
              </details>
            )}
          </div>
        </Card>

        {/* ── Aloqa ── */}
        <Card className="flex flex-col">
          <CardHeader title="Aloqa" />
          <div className="flex flex-col gap-2 px-5 pb-4">
            {telefonlar.length === 0 ? (
              <Empty>Telefon raqami yozilmagan.</Empty>
            ) : (
              telefonlar.map((t) => (
                <a
                  key={t.nom}
                  href={`tel:${t.raqam}`}
                  className="flex min-h-11 items-center gap-3 rounded-[10px] border border-line px-4 transition hover:border-ink-3"
                >
                  <IconPhone size={15} />
                  <span className="flex-1 font-[family-name:var(--font-mono)] text-[13px]">
                    {telefon(t.raqam)}
                  </span>
                  <span className="lbl">{t.nom}</span>
                </a>
              ))
            )}
            {oquvchi.izoh && (
              <p className="rounded-[10px] border border-dashed border-line px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
                {oquvchi.izoh}
              </p>
            )}

            {pulKoradi && (
              <HisobForma
                turi="oquvchi"
                nishon={oquvchi.id}
                ism={oquvchi.fish}
                bormi={Boolean(oquvchi.profile_id)}
                email={hisob?.email ?? null}
              />
            )}

            {pulKoradi && (
              <HisobForma
                turi="ota_ona"
                nishon={oquvchi.id}
                ism={oquvchi.fish}
                bormi={Boolean(otaOnaHisob)}
                email={otaOnaHisob?.email ?? null}
              />
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* ── To'lov tarixi ── */}
        {pulKoradi && (
          <Card className="flex flex-col">
            <CardHeader title="To‘lov tarixi" meta="oxirgi 12 ta" />
            <div className="flex flex-col px-5 pb-4">
              {tList.length === 0 ? (
                <Empty>Hali to‘lov yo‘q.</Empty>
              ) : (
                tList.map((t) => (
                  <div
                    key={t.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-soft py-2.5 last:border-0"
                  >
                    <span className="tnum font-[family-name:var(--font-mono)] text-[11.5px] text-ink-3">
                      {sana(t.sana)}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[12.5px]">
                        {davrNomi(t.davr)} uchun
                        {t.usul ? ` · ${USUL_NOMI[t.usul]}` : ' · usul [ANIQLANMAGAN]'}
                      </span>
                      {(t.bekor || !t.tasdiqlangan) && (
                        <span className="text-[11px] text-ink-3">
                          {t.bekor ? 'bekor qilingan' : 'direktor tasdig‘i kutilmoqda'}
                        </span>
                      )}
                    </span>
                    <span
                      className={`tnum font-[family-name:var(--font-mono)] text-[13px] ${
                        t.bekor ? 'text-ink-4 line-through' : t.tasdiqlangan ? 'text-ok' : 'text-accent'
                      }`}
                    >
                      {pul(t.summa)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* ── Davomat ── */}
        <Card className="flex flex-col">
          <CardHeader title="Davomat" meta={davrNomi(davr)} />
          <div className="flex flex-col gap-2 px-5 pb-4">
            {dList.length === 0 ? (
              <Empty>Hali davomat belgilanmagan.</Empty>
            ) : (
              dList.map((d) => (
                <div
                  key={`${d.davr}-${d.group_id}`}
                  className="flex items-center justify-between gap-3 border-b border-line-soft py-2 last:border-0"
                >
                  <span className="text-[12.5px]">{davrNomi(d.davr)}</span>
                  <span className="flex items-center gap-2.5">
                    <span className="text-[11.5px] text-ink-3">
                      {d.kelgan} / {d.darslar} dars
                    </span>
                    <Badge ton={d.foiz >= 80 ? 'ok' : d.foiz >= 60 ? 'accent' : 'brand'}>
                      {d.foiz}%
                    </Badge>
                  </span>
                </div>
              ))
            )}
            <p className="lbl pt-1">
              {DAVOMAT_NOMI.keldi} va {DAVOMAT_NOMI.kechikdi} — kelgan deb sanaladi
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

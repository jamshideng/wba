import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { talabProfil, adminmi } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Badge, Button } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { IconArrowLeft } from '@/components/icons'
import { pul, sana, bugunToshkent, davrNomi } from '@/lib/format'
import { oquvchiQaytar } from '../../actions'

export const metadata = { title: 'Arxivdan qaytarish' }
export const dynamic = 'force-dynamic'

type Yozilish = {
  id: string
  group_id: string
  boshlandi: string
  tugadi: string | null
  chegirma_summa: number
  chegirma_oy: number | null
  chegirma2_summa: number
  chegirma2_oy: number | null
  chegirma_sabab: string | null
  groups: { nom: string; oylik_narx: number; holat: string; subject_id: string | null } | null
}

type Q = { q?: string; g?: string; s?: string; c1?: string; c1oy?: string; c2?: string; c2oy?: string; cs?: string; so?: string; xato?: string }

/** Keyingi kun (YYYY-MM-DD) */
function ertasi(d: string): string {
  const x = new Date(`${d}T00:00:00Z`)
  x.setUTCDate(x.getUTCDate() + 1)
  return x.toISOString().slice(0, 10)
}

/**
 * Arxivdan qaytarish ustasi (Jamshid, 07.11): savollar tugma bilan —
 * 1) qaysi guruh (oldingisi / boshqa / guruhsiz), 2) qaysi kundan,
 * 3) to'lov sozlamasi (chegirma, eski hisob), 4) tasdiq. Admin bola
 * qaysi holatda qaytganini aniq ko'rib qo'yadi.
 */
export default async function Qaytarish({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Q>
}) {
  const profil = await talabProfil()
  if (!adminmi(profil.rol) && profil.rol !== 'qabulxona') redirect('/crm?xato=huquq')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Arxivdan qaytarish" />
  const [{ id }, s] = await Promise.all([params, searchParams])
  const asos = `/crm/oquvchilar/${id}/qaytarish`

  const supabase = await createClient()
  const [{ data: oq }, { data: yXom }, { data: gXom }] = await Promise.all([
    supabase.from('students').select('id, fish, holat, arxiv_sana').eq('id', id).maybeSingle(),
    supabase
      .from('enrollments')
      .select('id, group_id, boshlandi, tugadi, chegirma_summa, chegirma_oy, chegirma2_summa, chegirma2_oy, chegirma_sabab, groups(nom, oylik_narx, holat, subject_id)')
      .eq('student_id', id)
      .order('boshlandi', { ascending: false }),
    supabase.from('groups').select('id, nom, oylik_narx, subject_id').eq('holat', 'faol').order('nom'),
  ])
  if (!oq) notFound()
  if (oq.holat !== 'ketgan') redirect(`/crm/oquvchilar/${id}`)

  const yozilishlar = (yXom ?? []) as unknown as Yozilish[]
  const guruhlar = (gXom ?? []) as { id: string; nom: string; oylik_narx: number; subject_id: string | null }[]
  const { data: bXom } = yozilishlar.length
    ? await supabase.from('v_enrollment_balance').select('enrollment_id, qarz').in('enrollment_id', yozilishlar.map((y) => y.id))
    : { data: [] }
  const qarz = new Map(((bXom ?? []) as { enrollment_id: string; qarz: number }[]).map((b) => [b.enrollment_id, Number(b.qarz)]))

  // Oldingi guruhlari (har biri bir marta, oxirgi yozilishi bilan), faqat ochiq guruhlar
  const oldingi = new Map<string, Yozilish>()
  for (const y of yozilishlar) if (!oldingi.has(y.group_id) && y.groups?.holat === 'faol') oldingi.set(y.group_id, y)

  const qadam = s.q ?? '1'
  const g = s.g && s.g !== 'yoq' ? s.g : null
  const guruh = g ? guruhlar.find((x) => x.id === g) ?? null : null
  const oxirgi = g ? yozilishlar.find((y) => y.group_id === g && y.tugadi) ?? null : null
  const minSana = oxirgi?.tugadi ? ertasi(oxirgi.tugadi) : undefined
  const bugun = bugunToshkent()
  const tanlanganSana = s.s ?? (minSana && minSana > bugun ? minSana : bugun)
  // Chegirma: oldin shu guruhda bo'lgan bo'lsa — o'sha qiymatlar
  const cheg = oxirgi ?? yozilishlar[0] ?? null
  const hal = (k: keyof Q, eski: string) => s[k] ?? eski
  const yolQ = (qq: Record<string, string | undefined>) => {
    const u = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...s, xato: undefined, ...qq })) if (v != null && v !== '') u.set(k, v)
    return `${asos}?${u.toString()}`
  }
  const eskiQarz = [...qarz.values()].reduce((a, b) => a + b, 0)
  // Shu fandan ketgan oyining o'zida qaytyaptimi (0124) — shu oy summasi qo'lda
  const eskiFan = guruh
    ? yozilishlar
        .filter((y) => y.tugadi && (y.groups?.subject_id ?? null) === guruh.subject_id)
        .sort((a, b) => b.tugadi!.localeCompare(a.tugadi!))[0] ?? null
    : null
  const shuOy = Boolean(eskiFan?.tugadi && eskiFan.tugadi.slice(0, 7) === tanlanganSana.slice(0, 7))

  const Tugma = ({ href, nom, izoh }: { href: string; nom: string; izoh?: string }) => (
    <Link href={href} className="flex min-h-14 flex-col justify-center gap-0.5 rounded-[11px] border border-line bg-surface px-4 py-3 transition hover:border-brand hover:bg-surface-2">
      <span className="text-[13.5px] font-semibold">{nom}</span>
      {izoh && <span className="text-[12px] text-ink-3">{izoh}</span>}
    </Link>
  )

  return (
    <div className="flex max-w-2xl flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href={`/crm/oquvchilar/${id}`} className="flex items-center gap-2 text-[13px] text-ink-3 transition hover:text-ink">
        <IconArrowLeft size={15} />
        {oq.fish}
      </Link>
      <Sarlavha nom="Arxivdan qaytarish" izoh={`${oq.fish} (${oq.id})${oq.arxiv_sana ? ` · arxivda ${sana(oq.arxiv_sana)} dan` : ''}`} />
      <Xabar xato={s.xato} />

      {qadam === '1' && (
        <Card className="flex flex-col">
          <CardHeader title="1. Qaysi guruhda o‘qiydi?" />
          <div className="flex flex-col gap-2 px-5 pb-5">
            {[...oldingi.values()].map((y) => (
              <Tugma
                key={y.group_id}
                href={yolQ({ q: '2', g: y.group_id, s: undefined })}
                nom={`Oldingi guruhida qoladi: ${y.groups!.nom}`}
                izoh={`${sana(y.boshlandi)} – ${y.tugadi ? sana(y.tugadi) : 'hozir'} o‘qigan`}
              />
            ))}
            <Tugma href={yolQ({ q: '1b' })} nom="Boshqa guruhga qo‘shiladi" izoh="Guruhni ro‘yxatdan tanlaysiz" />
            <Tugma href={yolQ({ q: '4', g: 'yoq', s: undefined })} nom="Hozircha guruhsiz" izoh="Faqat faol bo‘ladi, guruhni keyin biriktirasiz" />
          </div>
        </Card>
      )}

      {qadam === '1b' && (
        <Card className="flex flex-col">
          <CardHeader title="1. Qaysi guruhga?" />
          <form method="get" action={asos} className="flex flex-col gap-3 px-5 pb-5">
            <input type="hidden" name="q" value="2" />
            <Maydon nom="Guruh">
              <select name="g" required defaultValue={g ?? ''} className={kirishKlass}>
                <option value="" disabled>Tanlang…</option>
                {guruhlar.map((x) => (
                  <option key={x.id} value={x.id}>{x.nom} · {pul(x.oylik_narx)}</option>
                ))}
              </select>
            </Maydon>
            <div className="flex gap-2">
              <Button href={yolQ({ q: '1' })} variant="ikkilamchi">Orqaga</Button>
              <Yuborish kutish="…">Davom etish</Yuborish>
            </div>
          </form>
        </Card>
      )}

      {qadam === '2' && guruh && (
        <Card className="flex flex-col">
          <CardHeader title="2. Qaysi kundan qaytadi?" meta={guruh.nom} />
          <form method="get" action={asos} className="flex flex-col gap-3 px-5 pb-5">
            <input type="hidden" name="q" value="3" />
            <input type="hidden" name="g" value={guruh.id} />
            <Maydon
              nom="Guruhga qo‘shilgan sana"
              izoh={minSana ? `Bu guruhdan ${sana(oxirgi!.tugadi)} da chiqqan — undan keyingi kun bo‘lsin. Oradagi kunlar hisoblanmaydi.` : 'Shu kundan hisob va davomat boshlanadi.'}
            >
              <input type="date" name="s" required min={minSana} defaultValue={tanlanganSana} className={kirishKlass} />
            </Maydon>
            <div className="flex gap-2">
              <Button href={yolQ({ q: oldingi.has(guruh.id) ? '1' : '1b' })} variant="ikkilamchi">Orqaga</Button>
              <Yuborish kutish="…">Davom etish</Yuborish>
            </div>
          </form>
        </Card>
      )}

      {qadam === '3' && guruh && (
        <Card className="flex flex-col">
          <CardHeader title="3. To‘lov sozlamasi" meta={`${guruh.nom} · oyiga ${pul(guruh.oylik_narx)}`} />
          <form method="get" action={asos} className="flex flex-col gap-3 px-5 pb-5">
            <input type="hidden" name="q" value="4" />
            <input type="hidden" name="g" value={guruh.id} />
            <input type="hidden" name="s" value={tanlanganSana} />
            {eskiQarz !== 0 && (
              <p className="rounded-[9px] bg-surface-2 px-3 py-2 text-[12.5px]">
                Eski hisobi: {eskiQarz > 0 ? <b className="text-brand">qarz {pul(eskiQarz)}</b> : <b className="text-ok">ortiqcha {pul(-eskiQarz)}</b>} — o‘sha yozilishda qoladi.
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Maydon nom="1-chegirma (oyiga)" izoh="Bo‘sh — chegirmasiz">
                <input name="c1" inputMode="numeric" defaultValue={hal('c1', cheg?.chegirma_summa ? String(cheg.chegirma_summa) : '')} className={kirishKlass} />
              </Maydon>
              <Maydon nom="Necha oy" izoh="Bo‘sh — muddatsiz">
                <input name="c1oy" inputMode="numeric" defaultValue={hal('c1oy', cheg?.chegirma_summa && cheg.chegirma_oy ? String(cheg.chegirma_oy) : '')} className={kirishKlass} />
              </Maydon>
              <Maydon nom="2-chegirma (oyiga)">
                <input name="c2" inputMode="numeric" defaultValue={hal('c2', cheg?.chegirma2_summa ? String(cheg.chegirma2_summa) : '')} className={kirishKlass} />
              </Maydon>
              <Maydon nom="Necha oy">
                <input name="c2oy" inputMode="numeric" defaultValue={hal('c2oy', cheg?.chegirma2_summa && cheg.chegirma2_oy ? String(cheg.chegirma2_oy) : '')} className={kirishKlass} />
              </Maydon>
            </div>
            <Maydon nom="Chegirma sababi">
              <input name="cs" defaultValue={hal('cs', cheg?.chegirma_sabab ?? '')} className={kirishKlass} />
            </Maydon>
            {shuOy && (
              <div className="flex flex-col gap-2 rounded-[9px] border border-accent/40 bg-surface-2 px-3 py-3">
                <span className="text-[12.5px] text-ink-2">
                  Bu fandan <b>{sana(eskiFan!.tugadi!)}</b> da ketgan va <b>shu oyning o‘zida</b> qaytyapti. Eski yozuvdagi {davrNomi(tanlanganSana.slice(0, 7))} hisobi
                  (tuzatish bilan) o‘z joyida qoladi.
                </span>
                <Maydon nom={`${davrNomi(tanlanganSana.slice(0, 7))} uchun yana qancha to‘laydi?`} izoh={`Masalan, qolgan darslar uchun. 0 dan ${pul(guruh.oylik_narx)} gacha`}>
                  <input name="so" required inputMode="numeric" defaultValue={s.so ?? ''} placeholder="Masalan: 300 000" className={kirishKlass} />
                </Maydon>
              </div>
            )}
            {cheg && (cheg.chegirma_summa > 0 || cheg.chegirma2_summa > 0) && !s.c1 && (
              <p className="text-[11.5px] text-ink-3">Oldingi yozilishdagi chegirma qo‘yildi — kerak bo‘lmasa o‘chiring.</p>
            )}
            <div className="flex gap-2">
              <Button href={yolQ({ q: '2' })} variant="ikkilamchi">Orqaga</Button>
              <Yuborish kutish="…">Davom etish</Yuborish>
            </div>
          </form>
        </Card>
      )}

      {qadam === '4' && (
        <Card className="flex flex-col">
          <CardHeader title="4. Tekshiring va tasdiqlang" />
          <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 px-5 pb-4 text-[13px]">
            <dt className="text-ink-3">Guruh</dt>
            <dd className="font-semibold">{guruh ? guruh.nom : <Badge>guruhsiz</Badge>}</dd>
            {guruh && (
              <>
                <dt className="text-ink-3">Qaysi kundan</dt>
                <dd className="font-semibold">{sana(tanlanganSana)}</dd>
                <dt className="text-ink-3">Oylik narx</dt>
                <dd>{pul(guruh.oylik_narx)}</dd>
                <dt className="text-ink-3">Chegirma</dt>
                <dd>
                  {s.c1 ? `${pul(s.c1)}${s.c1oy ? ` · ${s.c1oy} oy` : ' · muddatsiz'}` : 'yo‘q'}
                  {s.c2 ? ` + ${pul(s.c2)}${s.c2oy ? ` · ${s.c2oy} oy` : ' · muddatsiz'}` : ''}
                  {s.cs ? ` · ${s.cs}` : ''}
                </dd>
                {shuOy && (
                  <>
                    <dt className="text-ink-3">{davrNomi(tanlanganSana.slice(0, 7))} uchun</dt>
                    <dd className="font-semibold">{s.so ? `${pul(Number(s.so.replace(/\D/g, '')))} (ketgan oyida qaytdi)` : <span className="text-brand">kiritilmagan — orqaga qayting</span>}</dd>
                  </>
                )}
              </>
            )}
            {eskiQarz !== 0 && (
              <>
                <dt className="text-ink-3">Eski hisob</dt>
                <dd>{eskiQarz > 0 ? `qarz ${pul(eskiQarz)}` : `ortiqcha ${pul(-eskiQarz)}`} (saqlanadi)</dd>
              </>
            )}
          </dl>
          <p className="px-5 pb-3 text-[12px] text-ink-3">
            Eski davomat o‘z sanalarida qoladi. {guruh ? 'Yangi hisob va davomat tanlangan kundan boshlanadi.' : 'Guruhni keyin profildan biriktirasiz.'}
          </p>
          <form action={oquvchiQaytar} className="flex gap-2 px-5 pb-5">
            <input type="hidden" name="student_id" value={id} />
            {guruh && (
              <>
                <input type="hidden" name="group_id" value={guruh.id} />
                <input type="hidden" name="boshlandi" value={tanlanganSana} />
                <input type="hidden" name="chegirma_summa" value={s.c1 ?? ''} />
                <input type="hidden" name="chegirma_oy" value={s.c1oy ?? ''} />
                <input type="hidden" name="chegirma2_summa" value={s.c2 ?? ''} />
                <input type="hidden" name="chegirma2_oy" value={s.c2oy ?? ''} />
                <input type="hidden" name="chegirma_sabab" value={s.cs ?? ''} />
                {shuOy && <input type="hidden" name="shu_oy" value={s.so ?? ''} />}
              </>
            )}
            <Button href={yolQ({ q: guruh ? '3' : '1' })} variant="ikkilamchi">Orqaga</Button>
            <Yuborish tur="ok" kutish="Qaytarilmoqda…">Arxivdan qaytarish</Yuborish>
          </form>
        </Card>
      )}
    </div>
  )
}

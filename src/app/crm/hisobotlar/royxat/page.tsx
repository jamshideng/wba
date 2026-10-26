import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { IconArrowLeft } from '@/components/icons'
import { davrNomi, sana, pul } from '@/lib/format'

export const metadata = { title: 'Hisobot ro‘yxati' }
export const dynamic = 'force-dynamic'

/**
 * Manba havolasi (26.10, Jamshid): hisobotdagi raqamni tashkil qilgan
 * qatorlar. Shartlar bazada (hisobot_royxat, 0103) — hisobot bilan bir xil,
 * soni (yoki summa yig'indisi) raqamga teng.
 *
 * vaqt: 'hozir' — hozirgi holat, 'oy' — davr, 'oraliq' — dan..gacha.
 * kim: 'fan' — fan nomi, 'guruh' — guruh (ixtiyoriy), 'ustoz' — ustoz.
 */
type Turi = { nom: string; sana: string | null; vaqt: 'hozir' | 'oy' | 'oraliq'; kim?: 'fan' | 'guruh' | 'ustoz' | 'filtr' | 'balans'; summa?: string; bolim: string }
const BOLIM_YOL: Record<string, string> = {
  oquvchilar: '/crm/hisobotlar?bolim=oquvchilar',
  davomat: '/crm/hisobotlar?bolim=davomat',
  ustozlar: '/crm/hisobotlar?bolim=ustozlar',
  moliya: '/crm/hisobotlar?bolim=moliya',
  umumiy: '/crm/hisobotlar',
}
/** kim: 'filtr' — qo'shimcha shart nomi */
const FILTR_NOMI: Record<string, string> = {
  tasdiqlanmagan: 'tasdiqlanmaganlar', tasdiqlangan: 'tasdiqlanganlar', naqd: 'naqd', click: 'Click', terminal: 'terminal', payme: 'Payme', aniqlanmagan: 'usuli aniqlanmagan',
  kutilmoqda: 'kutilmoqda', yozildi: 'o‘quvchi bo‘ldi', kelmadi: 'kelmadi', rad: 'rad etdi',
}
const TURLAR = {
  faol_bola: { nom: 'Faol bolalar', sana: null, vaqt: 'hozir', bolim: 'oquvchilar' },
  faol_fan: { nom: 'Faol — fan bo‘yicha', sana: 'Qo‘shilgan', vaqt: 'hozir', bolim: 'oquvchilar' },
  ikki_fanli: { nom: '2 fanga qatnaydi', sana: null, vaqt: 'hozir', bolim: 'oquvchilar' },
  vip: { nom: 'VIP yozilishlar', sana: 'Qo‘shilgan', vaqt: 'hozir', bolim: 'oquvchilar' },
  arxiv: { nom: 'Arxivdagi bolalar', sana: 'Arxivga', vaqt: 'hozir', bolim: 'oquvchilar' },
  fan: { nom: 'faol yozilishlar', sana: 'Qo‘shilgan', vaqt: 'hozir', kim: 'fan', bolim: 'oquvchilar' },
  yangi_bola: { nom: 'Yangi bolalar', sana: 'Birinchi kun', vaqt: 'oy', bolim: 'oquvchilar' },
  yangi_fan: { nom: 'Yangi yozilishlar (fan)', sana: 'Qo‘shilgan', vaqt: 'oy', bolim: 'oquvchilar' },
  ketgan_bola: { nom: 'Ketgan bolalar', sana: 'Arxivga', vaqt: 'oy', bolim: 'oquvchilar' },
  tugagan_fan: { nom: 'Tugagan yozilishlar (fan)', sana: 'Tugadi', vaqt: 'oy', bolim: 'oquvchilar' },
  oy_faol_bola: { nom: 'Oy oxirida faol bolalar', sana: null, vaqt: 'oy', bolim: 'oquvchilar' },
  oy_faol_fan: { nom: 'Oy oxirida faol — fan bo‘yicha', sana: 'Qo‘shilgan', vaqt: 'oy', bolim: 'oquvchilar' },
  probniy: { nom: 'Kelgan lidlar (probniy)', sana: 'Kelgan', vaqt: 'oy', bolim: 'oquvchilar' },
  probniy_yozildi: { nom: 'Lid → o‘quvchi bo‘lganlar', sana: 'Kelgan', vaqt: 'oy', bolim: 'oquvchilar' },
  dav_kutilgan: { nom: 'Belgi bo‘lishi kerak', sana: 'Dars', vaqt: 'oraliq', kim: 'guruh', bolim: 'davomat' },
  dav_keldi: { nom: 'Keldi (kechikkanlar bilan)', sana: 'Dars', vaqt: 'oraliq', kim: 'guruh', bolim: 'davomat' },
  dav_kechikdi: { nom: 'Kechikib keldi', sana: 'Dars', vaqt: 'oraliq', kim: 'guruh', bolim: 'davomat' },
  dav_kelmadi: { nom: 'Kelmadi', sana: 'Dars', vaqt: 'oraliq', kim: 'guruh', bolim: 'davomat' },
  dav_sababli: { nom: 'Sababli', sana: 'Dars', vaqt: 'oraliq', kim: 'guruh', bolim: 'davomat' },
  dav_belgisiz: { nom: 'Belgilanmagan', sana: 'Dars', vaqt: 'oraliq', kim: 'guruh', bolim: 'davomat' },
  dav_dars: { nom: 'Jadvaldagi darslar', sana: 'Dars', vaqt: 'oraliq', kim: 'guruh', bolim: 'davomat' },
  dav_dars_otildi: { nom: 'Davomat qo‘yilgan darslar', sana: 'Dars', vaqt: 'oraliq', kim: 'guruh', bolim: 'davomat' },
  dav_dars_qilinmagan: { nom: 'Davomat qo‘yilmagan darslar', sana: 'Dars', vaqt: 'oraliq', kim: 'guruh', bolim: 'davomat' },
  ustoz_oquvchi: { nom: 'o‘quvchilari (faol yozilishlar)', sana: 'Qo‘shilgan', vaqt: 'hozir', kim: 'ustoz', bolim: 'ustozlar' },
  ustoz_qarz: { nom: 'guruhlaridagi qarzlar', sana: null, vaqt: 'hozir', kim: 'ustoz', summa: 'Qarz', bolim: 'ustozlar' },
  ustoz_dars: { nom: 'davomat qo‘yilgan darslari', sana: 'Dars', vaqt: 'oraliq', kim: 'ustoz', bolim: 'ustozlar' },
  ustoz_belgi: { nom: 'darslaridagi belgilar', sana: 'Dars', vaqt: 'oraliq', kim: 'ustoz', bolim: 'ustozlar' },
  ustoz_kelgan: { nom: 'darslariga kelganlar', sana: 'Dars', vaqt: 'oraliq', kim: 'ustoz', bolim: 'ustozlar' },
  ustoz_tushum: { nom: 'guruhlariga to‘lovlar', sana: 'To‘lov', vaqt: 'oraliq', kim: 'ustoz', summa: 'Summa', bolim: 'ustozlar' },
  ustoz_oy_tushum: { nom: 'guruhlariga shu oy uchun to‘lovlar', sana: 'To‘lov', vaqt: 'oy', kim: 'ustoz', summa: 'Summa', bolim: 'moliya' },
  balans_tolangan: { nom: 'to‘langan (yozilishlar bo‘yicha)', sana: null, vaqt: 'hozir', kim: 'balans', summa: 'Summa', bolim: 'ustozlar' },
  balans_qarz: { nom: 'qarz (yozilishlar bo‘yicha)', sana: null, vaqt: 'hozir', kim: 'balans', summa: 'Summa', bolim: 'ustozlar' },
  ustoz_otkazilgan: { nom: 'o‘tkazilgan darslar', sana: 'Dars', vaqt: 'oraliq', kim: 'ustoz', bolim: 'ustozlar' },
  ustoz_woblar: { nom: 'bergan woblar', sana: 'Berilgan', vaqt: 'oraliq', kim: 'ustoz', summa: 'Ball', bolim: 'ustozlar' },
  ortacha_fan: { nom: 'O‘qigan yoki to‘lagan (bola × fan)', sana: null, vaqt: 'oy', kim: 'fan', bolim: 'moliya' },
  ortacha_tolov: { nom: 'Shu oy uchun to‘lovlar', sana: 'To‘lov', vaqt: 'oy', kim: 'fan', summa: 'Summa', bolim: 'moliya' },
  tushum: { nom: 'To‘lovlar (tushum)', sana: 'To‘lov', vaqt: 'oraliq', kim: 'filtr', summa: 'Summa', bolim: 'umumiy' },
  belgi: { nom: 'Davomat belgilari', sana: 'Dars', vaqt: 'oraliq', bolim: 'umumiy' },
  belgi_kelgan: { nom: 'Kelganlar (kechikkan bilan)', sana: 'Dars', vaqt: 'oraliq', bolim: 'umumiy' },
  yangi_yozilish: { nom: 'Yangi yozilishlar', sana: 'Qo‘shilgan', vaqt: 'oraliq', bolim: 'umumiy' },
  dars_kutilgan: { nom: 'Jadval bo‘yicha darslar', sana: 'Dars', vaqt: 'oraliq', bolim: 'umumiy' },
  dars_qilinmagan: { nom: 'Davomat qilinmagan darslar', sana: 'Dars', vaqt: 'oraliq', bolim: 'umumiy' },
  lid: { nom: 'Lidlar (probniy)', sana: 'Kelgan', vaqt: 'oraliq', kim: 'filtr', bolim: 'umumiy' },
} as const satisfies Record<string, Turi>
type Tur = keyof typeof TURLAR

const BOLIM_NOMI: Record<string, string> = { oquvchilar: 'O‘quvchilar', davomat: 'Davomat', ustozlar: 'Ustozlar', moliya: 'Moliya' }

type Qator = {
  kalit: string
  student_id: string | null
  lead_id: string | null
  fish: string
  group_id: string | null
  guruh: string | null
  sana: string | null
  summa: number | null
}

/** PostgREST bir so'rovda ko'pi bilan 1000 qator beradi — ro'yxat to'liq bo'lsin (raqam = ro'yxat) */
async function hammasiniOl<T>(sorov: (dan: number, gacha: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const natija: T[] = []
  for (let dan = 0; dan < 50_000; dan += 1000) {
    const { data } = await sorov(dan, dan + 999)
    natija.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return natija
}

const kunmi = (x: string | undefined) => (/^\d{4}-\d{2}-\d{2}$/.test(x ?? '') ? x! : null)

export default async function HisobotRoyxat({
  searchParams,
}: {
  searchParams: Promise<{ tur?: string; davr?: string; kim?: string; dan?: string; gacha?: string }>
}) {
  await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Hisobot ro‘yxati" />

  const s = await searchParams
  const tur: Tur = (Object.keys(TURLAR) as Tur[]).find((t) => t === s.tur) ?? 'faol_bola'
  const t: Turi = TURLAR[tur]
  const davr = t.vaqt === 'oy' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s.davr ?? '') ? s.davr! : null
  const dan = t.vaqt === 'oraliq' ? kunmi(s.dan) : null
  const gacha = t.vaqt === 'oraliq' ? kunmi(s.gacha) : null
  const kim = t.kim ? (s.kim ?? '').slice(0, 100) || null : null

  const supabase = await createClient()
  const [data, { data: kimNomi }] = await Promise.all([
    t.vaqt === 'oraliq' && (!dan || !gacha)
      ? Promise.resolve([] as Qator[])
      : hammasiniOl((a, b) =>
          supabase.rpc('hisobot_royxat', { p_tur: tur, p_davr: davr, p_kim: kim, p_dan: dan, p_gacha: gacha }).order('kalit').range(a, b) as unknown as PromiseLike<{ data: Qator[] | null }>,
        ),
    t.kim === 'ustoz' && kim
      ? supabase.from('teachers').select('ism').eq('id', kim).maybeSingle()
      : t.kim === 'balans' && kim?.startsWith('u:')
        ? supabase.from('teachers').select('ism').eq('id', kim.slice(2)).maybeSingle()
        : t.kim === 'balans' && kim?.startsWith('g:')
          ? supabase.from('groups').select('ism:nom').eq('id', kim.slice(2)).maybeSingle()
      : t.kim === 'guruh' && kim
        ? supabase.from('groups').select('ism:nom').eq('id', kim).maybeSingle()
        : Promise.resolve({ data: null }),
  ])
  const qatorlar = data.sort(
    (a, b) => (b.sana ?? '').localeCompare(a.sana ?? '') || a.fish.localeCompare(b.fish, 'uz'),
  )
  const jamiSumma = t.summa ? qatorlar.reduce((a, q) => a + Number(q.summa ?? 0), 0) : null
  const egasi = (kimNomi as { ism: string } | null)?.ism ?? (t.kim === 'fan' ? kim : t.kim === 'filtr' && kim ? (FILTR_NOMI[kim] ?? kim) : null)
  const nom = (t.kim === 'ustoz' || t.kim === 'fan' || t.kim === 'balans') && (egasi ?? kim) ? `${egasi ?? kim} — ${t.nom}` : egasi ? `${t.nom} · ${egasi}` : t.nom
  const vaqtMatn = davr ? davrNomi(davr) : dan && gacha ? `${sana(dan)} — ${sana(gacha)}` : 'hozirgi holat'

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href={BOLIM_YOL[t.bolim]} className="flex items-center gap-2 text-[13px] text-ink-3 transition hover:text-ink">
        <IconArrowLeft size={15} />
        Hisobotlar{BOLIM_NOMI[t.bolim] ? ` · ${BOLIM_NOMI[t.bolim]}` : ''}
      </Link>
      <Sarlavha
        nom={nom}
        izoh={`${vaqtMatn} · ${qatorlar.length} ta${jamiSumma !== null ? ` · jami ${t.summa === 'Ball' ? jamiSumma : `${pul(jamiSumma)} so‘m`}` : ''}`}
      />
      <Card className="flex flex-col overflow-hidden">
        {qatorlar.length === 0 ? (
          <div className="p-5">
            <Empty>Ro‘yxat bo‘sh.</Empty>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            {qatorlar.map((q, i) => {
              // Dars/belgi qatori — jurnalning aynan o'sha kuni (va o'quvchi katagi)
              const jurnal =
                q.group_id && q.sana && t.sana === 'Dars'
                  ? `/crm/davomat/${q.group_id}?oy=${q.sana.slice(0, 7)}&b=${q.student_id ? `k:${q.student_id}@${q.sana}` : `kun:${q.sana}`}`
                  : null
              return (
                <li key={q.kalit} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-2.5 text-[13px]">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="tnum w-7 shrink-0 text-right text-[11.5px] text-ink-4">{i + 1}.</span>
                    {q.lead_id ? (
                      <Link href={`/crm/lidlar?b=lid:${q.lead_id}`} className="font-semibold hover:text-brand hover:underline">
                        {q.fish}
                      </Link>
                    ) : q.student_id ? (
                      <Link href={`/crm/oquvchilar/${q.student_id}`} className="font-semibold hover:text-brand hover:underline">
                        {q.fish}
                      </Link>
                    ) : jurnal ? (
                      <Link href={jurnal} className="font-semibold hover:text-brand hover:underline">
                        {q.fish}
                      </Link>
                    ) : (
                      <span className="font-semibold">{q.fish}</span>
                    )}
                    {q.student_id && <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-4">{q.student_id}</span>}
                  </span>
                  <span className="flex flex-wrap items-baseline gap-x-3 text-[12px] text-ink-3">
                    {q.group_id && q.student_id ? (
                      <Link href={`/crm/guruhlar/${q.group_id}`} className="max-w-[320px] truncate hover:text-ink hover:underline">
                        {q.guruh ?? q.group_id}
                      </Link>
                    ) : (
                      q.guruh && q.student_id && <span className="max-w-[420px] truncate">{q.guruh}</span>
                    )}
                    {t.sana && q.sana && (
                      jurnal ? (
                        <Link href={jurnal} className="tnum hover:text-ink hover:underline">
                          {t.sana}: {sana(q.sana)} · jurnal
                        </Link>
                      ) : (
                        <span className="tnum">
                          {t.sana}: {sana(q.sana)}
                        </span>
                      )
                    )}
                    {t.summa && (
                      <span className="tnum font-[family-name:var(--font-mono)] text-[13px] text-ink">
                        {t.summa === 'Ball' ? Number(q.summa) : pul(Number(q.summa ?? 0))}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

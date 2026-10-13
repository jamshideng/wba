import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader, Badge, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { pul, telefon, sanaQisqa, guruhQisqa } from '@/lib/format'
import type { StudentStatus, TakroriyJuft } from '@/lib/types'
import { birlashtir, boshqaOdam } from './actions'

export const metadata = { title: 'Takroriy o‘quvchilar' }
export const dynamic = 'force-dynamic'

const HOLAT: Record<StudentStatus, string> = { faol: 'faol', tanaffus: 'tanaffusda', ketgan: 'arxivda' }

type Oquvchi = {
  id: string
  fish: string
  holat: StudentStatus
  shaxsiy_tel: string | null
  ota_tel: string | null
  ona_tel: string | null
  qoshilgan_sana: string
  profile_id: string | null
}

/**
 * Takroriy o'quvchilar (0067). Sheets'da bitta odam ikki ID bilan yozilgan
 * bo'lishi mumkin — telefon va o'xshash ism bo'yicha shubhali juftliklar.
 * Admin ko'rib: birlashtiradi (qaysi ID asosiy qolishini tanlaydi) yoki
 * "boshqa odam" deb belgilaydi. Faqat admin va direktor.
 */
export default async function Takroriy({ searchParams }: { searchParams: Promise<{ ok?: string; xato?: string }> }) {
  await talabRol('admin', 'direktor')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Takroriy o‘quvchilar" />
  const xabar = await searchParams

  const supabase = await createClient()
  const { data: juftXom, error } = await supabase.rpc('takroriy_oquvchilar')
  const juftlar = (juftXom ?? []) as TakroriyJuft[]
  const idlar = [...new Set(juftlar.flatMap((j) => [j.a_id, j.b_id]))]

  const [{ data: oqXom }, { data: yozXom }, { data: balXom }] = idlar.length
    ? await Promise.all([
        supabase
          .from('students')
          .select('id, fish, holat, shaxsiy_tel, ota_tel, ona_tel, qoshilgan_sana, profile_id')
          .in('id', idlar),
        supabase.from('enrollments').select('student_id, holat, groups(nom)').in('student_id', idlar).neq('holat', 'tugagan'),
        supabase.from('v_student_balance').select('student_id, qarz').in('student_id', idlar),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  const oq = new Map(((oqXom ?? []) as Oquvchi[]).map((o) => [o.id, o]))
  const guruhlar = new Map<string, string[]>()
  for (const y of (yozXom ?? []) as unknown as { student_id: string; groups: { nom: string } | null }[]) {
    guruhlar.set(y.student_id, [...(guruhlar.get(y.student_id) ?? []), guruhQisqa(y.groups?.nom ?? '')])
  }
  const qarz = new Map(((balXom ?? []) as { student_id: string; qarz: number }[]).map((b) => [b.student_id, Number(b.qarz)]))

  const Karta = ({ id }: { id: string }) => {
    const o = oq.get(id)
    if (!o) return <span className="text-[12px] text-ink-3">{id}</span>
    const g = guruhlar.get(id) ?? []
    const q = qarz.get(id) ?? 0
    return (
      <div className="flex min-w-0 flex-col gap-1 rounded-[10px] border border-line-soft px-3.5 py-3">
        <Link href={`/crm/oquvchilar/${o.id}`} className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold hover:underline">
          {o.fish}
          <span className="font-[family-name:var(--font-mono)] text-[11px] font-normal text-ink-3">{o.id}</span>
        </Link>
        <span className="flex flex-wrap gap-1.5">
          <Badge ton={o.holat === 'faol' ? 'ok' : 'jim'}>{HOLAT[o.holat]}</Badge>
          {o.profile_id && <Badge ton="brand">login bor</Badge>}
          {q > 0 && <Badge ton="brand">qarz {pul(q)}</Badge>}
        </span>
        <span className="text-[12px] text-ink-2">{g.length ? g.join(' + ') : 'guruhda emas'}</span>
        <span className="tnum text-[11.5px] text-ink-3">
          shaxsiy {telefon(o.shaxsiy_tel)} · ota {telefon(o.ota_tel)} · ona {telefon(o.ona_tel)}
        </span>
        <span className="text-[11.5px] text-ink-3">qo‘shilgan: {sanaQisqa(o.qoshilgan_sana)}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Sarlavha nom="Takroriy o‘quvchilar" izoh={`${juftlar.length} ta shubhali juftlik · telefon va o‘xshash ism bo‘yicha`} />
      <Xabar ok={xabar.ok} xato={xabar.xato ?? (error ? xatoMatniOddiy(error.message) : undefined)} />

      <p className="rounded-[10px] border border-dashed border-line px-4 py-3 text-[12.5px] text-ink-2">
        Birlashtirilganda ikkinchi ID’ning guruhlari, to‘lovlari, davomati, woblari, Telegram va ota-ona hisoblari
        asosiy ID’ga o‘tadi. Ikkinchi ID o‘chirilmaydi — “Birlashtirildi” sababi bilan arxivga tushadi. Faqat ota-ona
        telefoni bir xil bo‘lsa (aka-uka) — bu yerda chiqmaydi.
      </p>

      {juftlar.length === 0 ? (
        <Card className="px-5 py-5">
          <Empty>Takroriy o‘quvchi topilmadi.</Empty>
        </Card>
      ) : (
        juftlar.map((j) => (
          <Card key={`${j.a_id}-${j.b_id}`} className="flex flex-col">
            <CardHeader title={j.sabab || 'o‘xshash'} meta={`o‘xshashlik ${Math.round(Number(j.oxshashlik) * 100)}%`} />
            <div className="grid grid-cols-1 gap-3 px-5 sm:grid-cols-2">
              <Karta id={j.a_id} />
              <Karta id={j.b_id} />
            </div>
            <div className="flex flex-wrap items-center gap-2 px-5 py-4">
              {[
                [j.a_id, j.b_id],
                [j.b_id, j.a_id],
              ].map(([asosiy, ikkinchi]) => (
                <details key={asosiy} className="min-w-0">
                  <summary className="flex min-h-11 cursor-pointer items-center rounded-[10px] border border-line px-4 text-[13px] text-ink-2 hover:text-ink">
                    {asosiy} qolsin, {ikkinchi} unga qo‘shilsin
                  </summary>
                  <form action={birlashtir} className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="asosiy" value={asosiy} />
                    <input type="hidden" name="ikkinchi" value={ikkinchi} />
                    <span className="text-[12px] text-ink-3">
                      {ikkinchi} ning hamma yozuvlari {asosiy} ga o‘tadi, {ikkinchi} arxivga tushadi.
                    </span>
                    <Yuborish tur="xavfli" kutish="Birlashtirilmoqda…">
                      Ha, birlashtir
                    </Yuborish>
                  </form>
                </details>
              ))}
              <form action={boshqaOdam}>
                <input type="hidden" name="a" value={j.a_id} />
                <input type="hidden" name="b" value={j.b_id} />
                <Yuborish tur="ikkilamchi" kutish="…">
                  Boshqa-boshqa odam
                </Yuborish>
              </form>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

function xatoMatniOddiy(m: string): string {
  return m.includes('Faqat') ? m : 'Ro‘yxatni o‘qib bo‘lmadi.'
}

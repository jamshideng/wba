import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Empty } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { IconArrowLeft } from '@/components/icons'
import { pul, davrNomi, joriyDavr } from '@/lib/format'

export const metadata = { title: 'Hisob tafsiloti' }
export const dynamic = 'force-dynamic'

/**
 * Manba havolasi (26.10, Jamshid): moliya kartasidagi raqamni tashkil
 * qilgan qatorlar. Yig'indi hisobotdagi raqamga teng (0103 — hisobot_moliya
 * bilan bir xil qoida).
 */
const TURLAR = {
  hisoblangan: { nom: 'To‘lashi kerak', ustun: 'hisoblangan' },
  chegirma: { nom: 'Chegirma', ustun: 'chegirma' },
  vip: { nom: 'VIP chegirma', ustun: 'vip' },
  chegirma_jami: { nom: 'Berilgan chegirma (VIP bilan)', ustun: 'chegirma_jami' },
  tuzatish: { nom: 'Tuzatish', ustun: 'tuzatish' },
  keyingi: { nom: 'Keyingi oy kutilmoqda', ustun: 'summa' },
} as const
type Tur = keyof typeof TURLAR

type Qator = {
  enrollment_id: string
  student_id: string
  fish: string
  group_id: string | null
  guruh: string | null
  qiymat: number
  tolangan: number | null
}

export default async function HisobTafsilot({ searchParams }: { searchParams: Promise<{ tur?: string; davr?: string }> }) {
  await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Hisob tafsiloti" />

  const s = await searchParams
  const tur: Tur = (Object.keys(TURLAR) as Tur[]).find((t) => t === s.tur) ?? 'hisoblangan'
  const davr = /^\d{4}-(0[1-9]|1[0-2])$/.test(s.davr ?? '') ? s.davr! : joriyDavr()
  const supabase = await createClient()

  let qatorlar: Qator[]
  if (tur === 'keyingi') {
    const { data } = await supabase.rpc('keyingi_oy_tafsilot')
    qatorlar = ((data ?? []) as { enrollment_id: string; student_id: string; fish: string; group_id: string | null; guruh: string | null; summa: number }[])
      .map((r) => ({ ...r, qiymat: Number(r.summa), tolangan: null }))
  } else {
    const { data } = await supabase.rpc('hisob_tafsilot', { p_davr: davr })
    qatorlar = (
      (data ?? []) as {
        enrollment_id: string; student_id: string; fish: string; group_id: string | null; guruh: string | null
        hisoblangan: number; chegirma: number; vip: number; tuzatish: number; tolangan: number
      }[]
    ).map((r) => ({
      ...r,
      qiymat:
        tur === 'chegirma_jami'
          ? Number(r.chegirma) + Number(r.vip)
          : Number(r[TURLAR[tur].ustun as 'hisoblangan' | 'chegirma' | 'vip' | 'tuzatish']),
      tolangan: Number(r.tolangan),
    }))
  }
  // Nolinchi qatorlar raqamga ta'sir qilmaydi — ro'yxatda faqat hissasi borlar
  qatorlar = qatorlar.filter((q) => q.qiymat !== 0).sort((a, b) => b.qiymat - a.qiymat)
  const jami = qatorlar.reduce((a, q) => a + q.qiymat, 0)
  const nom = TURLAR[tur].nom

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href="/crm/hisobotlar?bolim=moliya" className="flex items-center gap-2 text-[13px] text-ink-3 transition hover:text-ink">
        <IconArrowLeft size={15} />
        Hisobotlar · Moliya
      </Link>
      <Sarlavha
        nom={nom}
        izoh={`${tur === 'keyingi' ? 'faol yozilishlar' : davrNomi(davr)} · ${qatorlar.length} ta yozilish · jami ${pul(jami)} so‘m`}
      />
      <Card className="flex flex-col overflow-hidden">
        {qatorlar.length === 0 ? (
          <div className="p-5">
            <Empty>Bu davrda yozuv yo‘q.</Empty>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead className="border-b border-line bg-surface-2/60">
                <tr className="text-left">
                  <th className="lbl px-5 py-2.5 font-normal">O‘quvchi</th>
                  <th className="lbl px-3 py-2.5 font-normal">Guruh</th>
                  <th className="lbl px-3 py-2.5 text-right font-normal">{nom}</th>
                  {tur !== 'keyingi' && <th className="lbl px-5 py-2.5 text-right font-normal">To‘langan</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {qatorlar.map((q) => (
                  <tr key={q.enrollment_id}>
                    <td className="px-5 py-2.5">
                      <Link href={`/crm/oquvchilar/${q.student_id}`} className="font-semibold hover:text-brand hover:underline">
                        {q.fish}
                      </Link>
                      <span className="ml-2 font-[family-name:var(--font-mono)] text-[11px] text-ink-4">{q.student_id}</span>
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-2.5 text-ink-2">
                      {q.group_id ? (
                        <Link href={`/crm/guruhlar/${q.group_id}`} className="hover:text-ink hover:underline">
                          {q.guruh ?? q.group_id}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right font-[family-name:var(--font-mono)]">{pul(q.qiymat)}</td>
                    {tur !== 'keyingi' && (
                      <td className="tnum px-5 py-2.5 text-right font-[family-name:var(--font-mono)] text-ink-3">{pul(q.tolangan ?? 0)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-line font-bold">
                <tr>
                  <td className="px-5 py-2.5" colSpan={2}>
                    Jami
                  </td>
                  <td className="tnum px-3 py-2.5 text-right font-[family-name:var(--font-mono)]">{pul(jami)}</td>
                  {tur !== 'keyingi' && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

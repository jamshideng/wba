import Link from 'next/link'
import { notFound } from 'next/navigation'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, FormaBolim, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { IconArrowLeft } from '@/components/icons'
import { bugunToshkent, sana } from '@/lib/format'
import { oquvchiTahrir } from '../../actions'
import { TelefonMaydonlari } from '../../bolaklar'
import { HolatMaydoni } from './holat-maydoni'

export const metadata = { title: 'O‘quvchini tahrirlash' }
export const dynamic = 'force-dynamic'

export default async function OquvchiTahrir({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ xato?: string }>
}) {
  await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="O‘quvchini tahrirlash" />

  const [{ id }, { xato }] = await Promise.all([params, searchParams])
  const supabase = await createClient()
  const { data: o } = await supabase
    .from('students')
    .select('id, fish, ismi, familiya, tugilgan_sana, ota_tel, ona_tel, shaxsiy_tel, holat, izoh, qaytish_sana, tanaffus_sabab, qoshilgan_sana')
    .eq('id', id)
    .maybeSingle()

  if (!o) notFound()

  // Guruhga qo'shilgan sanalar (0090) — o'zgarsa oylik hisob bazada qayta yoziladi
  const { data: yozilishlar } = await supabase
    .from('enrollments')
    .select('id, boshlandi, tugadi, holat, groups(nom)')
    .eq('student_id', o.id)
    .order('boshlandi')
  const yList = (yozilishlar ?? []) as unknown as { id: string; boshlandi: string; tugadi: string | null; holat: string; groups: { nom: string } | null }[]

  return (
    <div className="flex max-w-2xl flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href={`/crm/oquvchilar/${o.id}`} className="flex items-center gap-2 text-[13px] text-ink-3 hover:text-ink">
        <IconArrowLeft size={15} /> {o.fish}
      </Link>
      <Sarlavha nom="Tahrirlash" izoh={o.id} />
      <Xabar xato={xato} />

      <form action={oquvchiTahrir} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={o.id} />

        <FormaBolim nom="Shaxsiy ma’lumot">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Maydon nom="Ism">
              <input name="ismi" required defaultValue={o.ismi} className={kirishKlass} />
            </Maydon>
            <Maydon nom="Familiya" izoh="Ixtiyoriy">
              <input name="familiya" defaultValue={o.familiya ?? ''} className={kirishKlass} />
            </Maydon>
            <Maydon nom="Tug‘ilgan sana">
              <input name="tugilgan_sana" type="date" max={bugunToshkent()} defaultValue={o.tugilgan_sana ?? ''} className={kirishKlass} />
            </Maydon>
          </div>
          <TelefonMaydonlari qiymat={o} />
          <Maydon nom="Izoh">
            <input name="izoh" defaultValue={o.izoh ?? ''} className={kirishKlass} />
          </Maydon>
          <HolatMaydoni holat={o.holat} qaytish={o.qaytish_sana} sabab={o.tanaffus_sabab} bugun={bugunToshkent()} />
        </FormaBolim>

        <FormaBolim nom="Qo‘shilgan sana">
          {yList.length === 0 ? (
            <Maydon nom="Markazga qo‘shilgan sana">
              <input name="qoshilgan_sana" type="date" required max={bugunToshkent()} defaultValue={o.qoshilgan_sana} className={kirishKlass} />
            </Maydon>
          ) : (
            <>
              {yList.map((y) => (
                <Maydon key={y.id} nom={`${y.groups?.nom ?? 'Guruh'}${y.tugadi ? ` · ${sana(y.tugadi)} da chiqqan` : ''}`}>
                  <input type="hidden" name={`eski_${y.id}`} value={y.boshlandi} />
                  <input name={`sana_${y.id}`} type="date" required max={y.tugadi ?? bugunToshkent()} defaultValue={y.boshlandi} className={kirishKlass} />
                </Maydon>
              ))}
              <p className="text-[12px] leading-snug text-ink-3">
                Guruhga qo‘shilgan sana o‘zgarsa, oylik hisob shu sanadan qayta yoziladi: oldingi oylar hisobdan olinadi, yetishmagan oylar qo‘shiladi. Olib tashlanadigan oyga to‘lov bo‘lsa, sana saqlanmaydi.
              </p>
            </>
          )}
        </FormaBolim>

        <Yuborish>Saqlash</Yuborish>
      </form>
    </div>
  )
}

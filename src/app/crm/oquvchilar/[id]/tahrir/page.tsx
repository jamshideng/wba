import Link from 'next/link'
import { notFound } from 'next/navigation'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, FormaBolim, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { IconArrowLeft } from '@/components/icons'
import { bugunToshkent } from '@/lib/format'
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
    .select('id, fish, tugilgan_sana, ota_tel, ona_tel, shaxsiy_tel, holat, izoh, qaytish_sana, tanaffus_sabab')
    .eq('id', id)
    .maybeSingle()

  if (!o) notFound()

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
            <Maydon nom="Ism familya">
              <input name="fish" required defaultValue={o.fish} className={kirishKlass} />
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

        <Yuborish>Saqlash</Yuborish>
      </form>
    </div>
  )
}

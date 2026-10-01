import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, FormaBolim, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { IconArrowLeft } from '@/components/icons'
import { bugunToshkent } from '@/lib/format'
import { oquvchiQosh } from '../actions'
import { ChegirmaMaydonlari, TelefonMaydonlari } from '../bolaklar'

export const metadata = { title: 'Yangi o‘quvchi' }
export const dynamic = 'force-dynamic'

export default async function YangiOquvchi({ searchParams }: { searchParams: Promise<{ xato?: string }> }) {
  await talabRol('admin', 'direktor', 'qabulxona')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Yangi o‘quvchi" />

  const { xato } = await searchParams
  const supabase = await createClient()
  const { data: guruhlar } = await supabase.from('groups').select('id, nom').eq('holat', 'faol').order('nom')

  return (
    <div className="flex max-w-2xl flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href="/crm/oquvchilar" className="flex items-center gap-2 text-[13px] text-ink-3 hover:text-ink">
        <IconArrowLeft size={15} /> O‘quvchilar
      </Link>
      <Sarlavha nom="Yangi o‘quvchi" izoh="ID o‘zi beriladi" />
      <Xabar xato={xato} />

      <form action={oquvchiQosh} className="flex flex-col gap-4">
        <FormaBolim nom="Shaxsiy ma’lumot">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
            <Maydon nom="Ism familya">
              <input name="fish" required autoFocus className={kirishKlass} />
            </Maydon>
            <Maydon nom="Tug‘ilgan sana">
              <input name="tugilgan_sana" type="date" max={bugunToshkent()} className={kirishKlass} />
            </Maydon>
          </div>
          <TelefonMaydonlari />
          <Maydon nom="Izoh">
            <input name="izoh" placeholder="Ixtiyoriy" className={kirishKlass} />
          </Maydon>
        </FormaBolim>

        <FormaBolim nom="Guruh">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
            <Maydon nom="Guruh" izoh="Keyin ham biriktirsa bo‘ladi">
              <select name="group_id" defaultValue="" className={kirishKlass}>
                <option value="">Hozircha guruhsiz</option>
                {(guruhlar ?? []).map((g) => (
                  <option key={g.id} value={g.id}>{g.nom}</option>
                ))}
              </select>
            </Maydon>
            <Maydon nom="Boshlagan sana" izoh="O‘tgan oylar ham hisoblanadi">
              <input name="boshlandi" type="date" defaultValue={bugunToshkent()} className={kirishKlass} />
            </Maydon>
          </div>
          <ChegirmaMaydonlari />
        </FormaBolim>

        <Yuborish>O‘quvchini qo‘shish</Yuborish>
      </form>
    </div>
  )
}

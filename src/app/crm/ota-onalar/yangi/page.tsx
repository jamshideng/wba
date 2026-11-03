import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { IconArrowLeft } from '@/components/icons'
import { Card } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { kirishKlass, Maydon, Xabar } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { ParolMaydon } from '@/components/parol-maydon'
import { otaOnaYarat } from '@/app/crm/hisoblar/actions'
import { FarzandTanlash } from '@/components/farzand-tanlash'

export const metadata = { title: 'Yangi ota-ona' }
export const dynamic = 'force-dynamic'

/** 0116 — ota-ona hisobini alohida yaratish (o'quvchi yaratilgandek); farzand ixtiyoriy */
export default async function YangiOtaOna({ searchParams }: { searchParams: Promise<{ ok?: string; xato?: string; farzand?: string }> }) {
  await talabRol('admin', 'direktor', 'manager')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Yangi ota-ona" />
  const s = await searchParams
  const supabase = await createClient()
  // Ota-onasi biriktirilmagan faol o'quvchilar
  const { data } = await supabase.from('students').select('id, fish').is('ota_ona_id', null).neq('holat', 'ketgan').order('fish')
  const boshlar = (data ?? []) as { id: string; fish: string }[]
  // 0117 — sinov darsidagi, hali o'quvchi bo'lmagan va ota-onasi yo'q bolalar
  const { data: lXom } = await supabase
    .from('leads')
    .select('id, ism')
    .is('student_id', null)
    .is('ota_ona_id', null)
    .not('holat', 'in', '(xato,rad)')
    .order('ism')
  const sinovdagilar = (lXom ?? []) as { id: string; ism: string }[]

  return (
    <div className="flex max-w-2xl flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href="/crm/ota-onalar" className="inline-flex min-h-11 items-center gap-1.5 self-start text-[13px] text-ink-3 hover:text-ink">
        <IconArrowLeft size={16} /> Ota-onalar
      </Link>
      <Sarlavha nom="Yangi ota-ona" izoh="hisob ochish" />
      <Xabar ok={s.ok} xato={s.xato} />
      <Card className="p-5">
        <form action={otaOnaYarat} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Maydon nom="Ism">
              <input name="ism" required maxLength={40} placeholder="Ism" className={kirishKlass} />
            </Maydon>
            <Maydon nom="Familiya">
              <input name="familiya" required maxLength={40} placeholder="Familiya" className={kirishKlass} />
            </Maydon>
          </div>
          <Maydon nom="Telefon raqami">
            <input name="telefon" required inputMode="tel" placeholder="90 123 45 67" className={kirishKlass} />
          </Maydon>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Maydon nom="Login" izoh="Oddiy so‘z, masalan: ota-ali">
              <input name="email" required autoComplete="off" placeholder="ota-ali" className={kirishKlass} />
            </Maydon>
            <ParolMaydon />
          </div>
          <Maydon nom="Farzand" izoh="Majburiy: o‘quvchi yoki sinov darsidagi bola. Qolgan farzandlar keyin biriktiriladi.">
            <FarzandTanlash
              oquvchilar={boshlar}
              sinovdagilar={sinovdagilar}
              tanlangan={s.farzand ? (/^[SL]:/.test(s.farzand) ? s.farzand : `S:${s.farzand}`) : undefined}
            />
          </Maydon>
          <Yuborish>Hisob ochish</Yuborish>
        </form>
      </Card>
    </div>
  )
}

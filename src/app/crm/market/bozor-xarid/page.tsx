import { redirect } from 'next/navigation'
import { talabProfil } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, Button } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Xabar } from '@/components/forma'
import { Woblar } from '../bolaklar'
import { BozorXaridForma } from './forma'

export const metadata = { title: 'An’anaviy bozordan sotib olish · Woblar market' }
export const dynamic = 'force-dynamic'

/**
 * An'anaviy bozor (0063): Marketga qo'yilmagan narsalar. O'quvchi nima olganini
 * va necha woblar ekanini o'zi yozadi → woblar yechiladi → chek → admin beradi.
 */
export default async function BozorXarid({ searchParams }: { searchParams: Promise<{ xato?: string }> }) {
  const profil = await talabProfil()
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="An’anaviy bozor" />
  if (profil.rol !== 'oquvchi') redirect('/crm/market')

  const s = await searchParams
  const supabase = await createClient()
  const { data: men } = await supabase.from('students').select('id').eq('profile_id', profil.id).maybeSingle()
  const { data: bal } = men
    ? await supabase.from('v_woblr_balance').select('balans').eq('student_id', men.id).maybeSingle()
    : { data: null }
  const balans = Number(bal?.balans ?? 0) || 0

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-5 py-5">
      <Sarlavha nom="An’anaviy bozordan sotib olish" izoh="Marketda yo‘q narsalar uchun" amal={<Button href="/crm/market" variant="ikkilamchi">Marketga qaytish</Button>} />
      <Xabar xato={s.xato} />

      <Card className="flex items-center justify-between gap-3 border-accent-line! bg-accent-soft! px-5 py-4">
        <span className="lbl">Sizning woblaringiz</span>
        <Woblar son={balans} katta />
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <p className="text-[13px] leading-relaxed text-ink-2">
          Bozorda olgan narsangizni va uning narxini (woblarda) yozing, keyin <b>To‘lov qilish</b> ni bosing.
          Woblar hisobingizdan yechiladi va chek chiqadi — chekni adminga ko‘rsatib, narsangizni olib keting.
        </p>
        <BozorXaridForma balans={balans} />
      </Card>
    </div>
  )
}

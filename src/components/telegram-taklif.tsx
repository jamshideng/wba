import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui'
import { Yuborish } from '@/components/yuborish'
import { telegramUlash } from '@/app/crm/profil/actions'
import { BOT_NOMI } from '@/lib/telegram'

/**
 * O'quvchi / ota-ona bosh sahifasida: botga hali ulanmagan bo'lsa —
 * "Telegramga ulaning" kartasi (bir bosishda, 0021 token). Ulangan
 * bo'lsa hech narsa chiqmaydi. RLS faqat o'z ulanishini beradi.
 */
export async function TelegramTaklif({ kim }: { kim: 'oquvchi' | 'ota_ona' }) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('telegram_ulanish')
    .select('id', { count: 'exact', head: true })
    .eq('holat', 'faol')
    .eq('kim', kim)
  if (count) return null

  return (
    <Card className="flex flex-col gap-3 border-accent-line p-5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold">Telegram botga ulaning</div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
          Woblar, qarz, darslar va markaz e’lonlari @{BOT_NOMI} da darhol keladi. Tugmani bosing — bot ochiladi,
          <b> Start</b> ni bosing va tayyor.
        </p>
      </div>
      <form action={telegramUlash}>
        <Yuborish kutish="Ochilmoqda…">Telegramga ulash</Yuborish>
      </form>
    </Card>
  )
}

import Link from 'next/link'
import { talabRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { supabaseSozlanganmi } from '@/lib/supabase/env'
import { Card, CardHeader } from '@/components/ui'
import { Sarlavha, Ulanmagan } from '@/components/crm'
import { Maydon, Xabar, kirishKlass } from '@/components/forma'
import { IconArrowLeft } from '@/components/icons'
import { Yuborish } from '@/components/yuborish'
import { SanaKiritish } from '@/components/sana-kiritish'
import { VAZN_GURUHLARI, type ReytingSozlama } from '@/lib/reyting'
import { reytingSozlamaSaqla } from './actions'

export const metadata = { title: 'Reyting sozlamalari' }
export const dynamic = 'force-dynamic'

/** Sozlamalar → Reyting (0138): vaznlar, chegaralar, koeffitsientlar — kodsiz o'zgartiriladi. */
export default async function ReytingSozlamalari({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; xato?: string }>
}) {
  await talabRol('admin', 'direktor', 'manager')
  if (!supabaseSozlanganmi()) return <Ulanmagan nom="Reyting sozlamalari" />

  const s = await searchParams
  const supabase = await createClient()
  const { data } = await supabase.rpc('reyting_sozlama', {})
  const r = (data ?? {}) as ReytingSozlama

  const sonMaydon = (nom: string, kalit: keyof ReytingSozlama, izoh: string, qadam = '1') => (
    <Maydon nom={nom} izoh={izoh}>
      <input name={kalit} type="number" step={qadam} min="0" required defaultValue={String(r[kalit] ?? '')} className={kirishKlass} />
    </Maydon>
  )

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      <Link href="/crm/sozlamalar" className="inline-flex min-h-11 items-center gap-1.5 self-start text-[13px] text-ink-3 hover:text-ink">
        <IconArrowLeft size={16} /> Sozlamalar
      </Link>
      <Sarlavha nom="Reyting sozlamalari" izoh="o‘quvchi va ustoz reytingi" />
      <Xabar ok={s.ok} xato={s.xato} />

      <form action={reytingSozlamaSaqla} className="flex flex-col gap-4">
        <Card className="flex flex-col">
          <CardHeader title="Kim ko‘radi" meta="ustozlar reytingi doim faqat rahbariyatga" />
          <label className="flex min-h-11 items-start gap-3 px-5 pb-5 text-[13px]">
            <input name="oquvchiga_ochiq" type="checkbox" defaultChecked={Boolean(r.oquvchiga_ochiq)} className="mt-0.5 size-5 shrink-0" />
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">O‘quvchi reytingi o‘quvchi, ota-ona va ustozlarga ochiq</span>
              <span className="text-[12px] text-ink-3">
                O‘chiq bo‘lsa (sinov davri) — faqat admin, direktor va manager ko‘radi. Yoqilganda menyuda “Reyting” chiqadi.
              </span>
            </span>
          </label>
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {VAZN_GURUHLARI.map((g) => (
            <Card key={g.kalit} className="flex flex-col">
              <CardHeader title={g.nom} meta="vaznlar, % — yig‘indisi 100" />
              <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-3">
                {g.omillar.map((o) => (
                  <Maydon key={o.kalit} nom={o.nom}>
                    <input
                      name={`${g.kalit}.${o.kalit}`}
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      required
                      defaultValue={String((r[g.kalit] as Record<string, number> | undefined)?.[o.kalit] ?? '')}
                      className={kirishKlass}
                    />
                  </Maydon>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <Card className="flex flex-col">
          <CardHeader title="Hisoblash va chegaralar" />
          <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
            {sonMaydon('Oylik reyting sanasi', 'oylik_sana', 'keyingi oyning shu kuni kechasi hisoblanadi (1–28)')}
            {sonMaydon('Test natijasi muddati', 'test_muddati_kun', 'keyingi oyning shu kunigacha kiritilmasa — ustozga intizom hodisasi')}
            {sonMaydon('Oylik: kamida dars', 'min_dars_oylik', 'kam bo‘lsa “yangi”, o‘rin berilmaydi')}
            {sonMaydon('Haftalik: kamida dars', 'min_dars_haftalik', 'kam bo‘lsa “yangi”, o‘rin berilmaydi')}
            {sonMaydon('Bir darsda N woblar = 100', 'woblar_100', 'o‘rtacha N dan oshsa ham 100 da to‘xtaydi', '0.1')}
            {sonMaydon('Ketish: kamida qatnashgan dars', 'min_qatnashgan_dars', 'shundan kam kelib ketgan o‘quvchi ustozga sanalmaydi')}
            {sonMaydon('Ustozga bog‘liq bo‘lmagan sabab', 'bogliq_emas_koef', 'bitta ketish shuncha sanaladi (0–1)', '0.05')}
            {sonMaydon('Kechikish: 1 daqiqa uchun', 'kechikish_k', 'har dars: 100 − daqiqa × K', '0.5')}
            {sonMaydon('Intizom: 1 hodisa uchun', 'intizom_n', '100 dan shuncha ball ayriladi', '0.5')}
            <Maydon nom="Ketishlar shu sanadan" izoh="oldingi ketishlar ustoz reytingiga kirmaydi">
              <SanaKiritish name="boshlanish_sana" defaultValue={r.boshlanish_sana ?? ''} className={kirishKlass} />
            </Maydon>
          </div>
        </Card>

        <div className="flex justify-end">
          <Yuborish>Saqlash</Yuborish>
        </div>
      </form>
    </div>
  )
}

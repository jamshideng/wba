import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, Empty, Stat, Badge } from '@/components/ui'
import { Sarlavha } from '@/components/crm'
import { sana, vaqt, kunlarNomi, haftaKuni, HAFTA_KUNLARI } from '@/lib/format'
import type { Farzand } from '@/lib/farzand'

type Kabinet = {
  holat: 'sinov' | 'oquvchi' | 'yoqotildi' | 'yopiq' | 'kutilmoqda'
  ism: string
  sinov_sana: string | null
  guruh: { nom: string; boshlanish: string; tugash: string; kunlar: number[]; fan: string | null; ustoz: string | null } | null
  darslar: string[]
  davomat: { sana: string; holat: string }[]
  woblar: number
}

/**
 * Ota-ona kabineti: sinov darsidagi farzand (0117). Ma'lumot probniy
 * kabineti (0102) bilan bir xil — ota_ona_lid_kabinet() faqat o'z
 * farzandiga beradi. Narx ko'rsatilmaydi.
 */
export async function SinovFarzand({ f, farzandlar }: { f: Farzand; farzandlar: Farzand[] }) {
  const supabase = await createClient()
  const { data } = await supabase.rpc('ota_ona_lid_kabinet', { p_lead: f.id.slice(2) })
  const k = data as unknown as Kabinet | null
  const kelgan = k ? k.davomat.filter((d) => d.holat === 'keldi' || d.holat === 'kechikdi').length : 0

  return (
    <div className="flex flex-col gap-4 px-5 py-5 lg:px-7">
      {farzandlar.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label="Farzandlarim">
          {farzandlar.map((x) => (
            <a
              key={x.id}
              href={`/crm/farzand/${x.id}`}
              aria-current={x.id === f.id ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-[10px] border px-4 text-[13px] font-semibold ${
                x.id === f.id ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-2 hover:border-ink-3'
              }`}
            >
              {x.fish}
            </a>
          ))}
        </nav>
      )}
      <Sarlavha nom={f.fish} izoh="Sinov darsida · World Bridge Academy" amal={<Badge ton="accent">Sinov</Badge>} />

      {!k || k.holat === 'yopiq' || k.holat === 'kutilmoqda' ? (
        <Card className="p-5">
          <Empty>Sinov darslari hali belgilanmagan. Markaz administratori bilan bog‘laning.</Empty>
        </Card>
      ) : (
        <>
          {k.holat === 'yoqotildi' && (
            <Card className="p-5">
              <p className="text-[13.5px] leading-relaxed text-ink-2">
                Sinov davri yakunlandi. Guruhga yozilmoqchi bo‘lsangiz — administratorga murojaat qiling.
              </p>
            </Card>
          )}
          {k.guruh && (
            <Card className="flex flex-col gap-3 p-5">
              <span className="lbl">Sinov guruhi</span>
              <span className="text-[16px] font-bold">{k.guruh.fan ?? k.guruh.nom.split(' · ')[0]}</span>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13.5px]">
                <dt className="text-ink-3">Ustoz</dt>
                <dd className="font-semibold">{k.guruh.ustoz ?? '[ANIQLANMAGAN]'}</dd>
                <dt className="text-ink-3">Dars kunlari</dt>
                <dd>{kunlarNomi(k.guruh.kunlar)}</dd>
                <dt className="text-ink-3">Vaqti</dt>
                <dd className="tnum">
                  {vaqt(k.guruh.boshlanish)}–{vaqt(k.guruh.tugash)}
                </dd>
                {k.sinov_sana && (
                  <>
                    <dt className="text-ink-3">Sinov darsi</dt>
                    <dd>{sana(k.sinov_sana)}</dd>
                  </>
                )}
              </dl>
            </Card>
          )}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Stat label="Qatnashgan darslar" value={String(kelgan)} sub={`${k.davomat.length} ta dars belgilangan`} />
            <Stat label="Woblar" value={String(k.woblar)} sub="guruhga yozilsa saqlanadi" ton="accent" />
          </div>
          {k.holat === 'sinov' && k.darslar.length > 0 && (
            <Card className="flex flex-col">
              <CardHeader title="Keyingi darslar" meta="2 hafta" />
              <ul className="flex flex-col divide-y divide-line px-5 pb-3">
                {k.darslar.slice(0, 6).map((d) => (
                  <li key={d} className="flex items-center justify-between py-2.5 text-[13.5px]">
                    <span>
                      {sana(d)} · {HAFTA_KUNLARI[haftaKuni(d) - 1].nom}
                    </span>
                    {k.guruh && <span className="tnum text-ink-3">{vaqt(k.guruh.boshlanish)}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {k.davomat.length > 0 && (
            <Card className="flex flex-col">
              <CardHeader title="Davomat" meta={`${kelgan} / ${k.davomat.length}`} />
              <ul className="flex flex-col divide-y divide-line px-5 pb-3">
                {k.davomat.map((d) => (
                  <li key={d.sana} className="flex items-center justify-between py-2.5 text-[13.5px]">
                    <span>{sana(d.sana)}</span>
                    <Badge ton={d.holat === 'keldi' || d.holat === 'kechikdi' ? 'ok' : 'brand'}>
                      {d.holat === 'keldi' || d.holat === 'kechikdi' ? 'Keldi' : 'Kelmadi'}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

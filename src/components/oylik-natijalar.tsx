import { Card, CardHeader, Badge, Empty } from '@/components/ui'
import { davrNomi, guruhUstozsiz } from '@/lib/format'
import { asosiy, foizTon, natijaMatni, type OylikBolim, type OylikTestTuri } from '@/lib/oylik-test'

/** oylik_natijalarim() qatori (0104) — faqat e'lon qilingan natijalar */
export type MeningOylikNatijam = {
  davr: string
  guruh: string
  fan: string | null
  turi: OylikTestTuri
  maks: number | null
  bolimlar: OylikBolim[]
  keldi: boolean
  ball: number | null
  bolim_ballar: (number | null)[] | null
  foiz: number | null
  izoh: string | null
  orin: number | null
  jami: number
}

/**
 * O'quvchi va ota-ona kabinetidagi "Oylik test" kartasi.
 * Boshqa o'quvchilarning bali ko'rinmaydi — faqat o'z natijasi va
 * guruhdagi o'rni ("12 tadan 3-o'rin").
 */
export function OylikNatijalarKarta({ royxat }: { royxat: MeningOylikNatijam[] }) {
  return (
    <Card className="flex flex-col">
      <CardHeader title="Oylik test natijalari" meta={royxat.length ? `${royxat.length} ta` : undefined} />
      {royxat.length === 0 ? (
        <div className="px-5 pb-5">
          <Empty>Hali e’lon qilingan natija yo‘q.</Empty>
        </div>
      ) : (
        <ul>
          {royxat.slice(0, 12).map((n) => (
            <li key={`${n.davr}-${n.guruh}`} className="flex items-center gap-3 border-t border-line-soft px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">
                  {davrNomi(n.davr)} · {n.fan ?? guruhUstozsiz(n.guruh)}
                </span>
                <span className="block truncate text-[12px] text-ink-3">
                  {natijaMatni(n)}
                  {n.orin != null && ` · ${n.jami} tadan ${n.orin}-o‘rin`}
                </span>
                {n.izoh && <span className="block truncate text-[12px] text-ink-2">{n.izoh}</span>}
              </span>
              {n.foiz != null ? (
                <span className={`tnum font-[family-name:var(--font-display)] text-[20px] font-extrabold ${foizTon(n.foiz) === 'ok' ? 'text-ok' : foizTon(n.foiz) === 'accent' ? 'text-accent' : 'text-brand'}`}>
                  {asosiy(n)}
                </span>
              ) : (
                <Badge>{n.keldi ? '—' : 'Kelmadi'}</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

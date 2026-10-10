import { davrNomi } from '@/lib/format'
import type { WoblarLimiti } from '@/lib/woblar-chegara'

type GuruhLimit = WoblarLimiti['guruhlar'][number]

function Son({ nom, qoldi, limit }: { nom: string; qoldi: number; limit: number }) {
  const foiz = limit > 0 ? Math.max(0, Math.min(100, (qoldi / limit) * 100)) : 0
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="lbl">{nom}</span>
      <span className="tnum text-[15px]">
        <b className={`font-[family-name:var(--font-display)] text-[22px] ${qoldi > 0 ? 'text-accent' : 'text-brand'}`}>{qoldi}</b>
        <span className="text-ink-3"> / {limit} qoldi</span>
      </span>
      <span className="h-1.5 overflow-hidden rounded bg-surface-2">
        <span className={`block h-1.5 ${qoldi > 0 ? 'bg-accent' : 'bg-brand'}`} style={{ width: `${foiz}%` }} />
      </span>
    </div>
  )
}

/**
 * Ustozning oylik woblar limiti (0064): shu guruh uchun va jami — ikki son.
 * Limit = oydagi darslar × o'sha kuni guruhdagi o'quvchilar × stavka.
 */
export function WoblarLimitKartasi({ limit, guruh, kim }: { limit: WoblarLimiti; guruh: GuruhLimit | null; kim: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-[12px] border border-accent-line bg-accent-soft px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13.5px] font-bold">{kim} · {davrNomi(limit.davr)}</span>
        <span className="text-[11.5px] text-ink-3">darslar × o‘quvchilar × {limit.stavka} · minus woblar limitga qaytadi</span>
      </div>
      <div className="flex flex-wrap gap-5">
        {guruh && <Son nom="Shu guruh uchun" qoldi={guruh.qoldi} limit={guruh.limit} />}
        <Son nom="Jami (barcha guruhlar)" qoldi={limit.jami.qoldi} limit={limit.jami.limit} />
      </div>
    </div>
  )
}

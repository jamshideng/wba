import { HAFTA, KUN_TURLARI, type KunTuri, type Vaqt } from '@/lib/markaz'
import { IconMoon, IconSun } from '@/components/icons'

/**
 * Hafta qatori (3 + 3): asosiy dars kunlari — to'liq qizil, support teacher
 * kunlari — qizil chiziqli. Server va client komponentlarda ishlaydi (holatsiz).
 * `qorongi` — qora fon ustida (lendingdagi natija kartasi).
 */
export function HaftaQator({ kun, qorongi = false, kichik = false }: { kun: KunTuri | null; qorongi?: boolean; kichik?: boolean }) {
  const tur = KUN_TURLARI.find((k) => k.id === kun)
  const dars: readonly string[] = tur?.kunlar ?? []
  const support: readonly string[] = tur?.support ?? []
  const bosh = qorongi ? 'border border-bg/15 text-bg/40' : 'border border-line text-ink-4'

  return (
    <span className={`grid grid-cols-7 ${kichik ? 'gap-1' : 'gap-1.5'}`} aria-hidden="true" translate="no">
      {HAFTA.map((h) => {
        const holat = dars.includes(h)
          ? 'bg-brand text-white'
          : support.includes(h)
            ? `border-[1.5px] border-dashed border-brand ${qorongi ? 'text-bg' : 'text-brand'}`
            : bosh
        return (
          <span
            key={h}
            className={`flex aspect-square items-center justify-center font-bold transition duration-300 ${
              kichik ? 'rounded-[8px] text-[10px]' : 'rounded-[12px] text-[12px] sm:text-[13px]'
            } ${holat}`}
          >
            {h}
          </span>
        )
      })}
    </span>
  )
}

/** Belgilar izohi: to'liq — dars, chiziqli — support teacher */
export function HaftaIzoh({ qorongi = false }: { qorongi?: boolean }) {
  return (
    <span className={`flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] ${qorongi ? 'text-bg/70' : 'text-ink-3'}`}>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[4px] bg-brand" /> Dars
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[4px] border-[1.5px] border-dashed border-brand" /> Support teacher
      </span>
    </span>
  )
}

function Tong({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M3 13h12M5.5 13a3.5 3.5 0 0 1 7 0M9 4.5v2M3.8 7.6l1.3 1.1M14.2 7.6l-1.3 1.1" />
    </svg>
  )
}

export const VAQT_IKONKA: Record<Vaqt, React.ReactNode> = {
  ertalab: <Tong />,
  kunduzi: <IconSun size={20} />,
  kechqurun: <IconMoon size={20} />,
}

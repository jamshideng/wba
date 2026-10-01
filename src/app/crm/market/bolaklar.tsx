import { IconMarket, IconTanga } from '@/components/icons'

/** Mahsulot rasmi — yo'q bo'lsa sumka belgisi bilan bo'sh joy. Kvadrat, kesib to'ldiriladi. */
export function MahsulotRasm({ url, nom, className = '' }: { url: string | null; nom: string; className?: string }) {
  return (
    <span className={`relative block aspect-square w-full overflow-hidden bg-surface-2 ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- Storage'dagi rasm, o'lchami har xil
        <img src={url} alt={nom} loading="lazy" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-ink-4">
          <IconMarket size={40} />
        </span>
      )}
    </span>
  )
}

/** "120 W" — tanga belgisi bilan narx */
export function Woblar({ son, katta = false, className = '' }: { son: number; katta?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-[family-name:var(--font-display)] font-extrabold text-accent ${katta ? 'text-[26px]' : 'text-[16px]'} ${className}`}>
      <IconTanga size={katta ? 24 : 16} />
      <span className="tnum">{son.toLocaleString('ru-RU')}</span>
    </span>
  )
}

import Link from 'next/link'
import Image from 'next/image'
import { pul } from '@/lib/format'

/* ---------------- Logo ---------------- */

export function Logo({ size = 'md', matnKlass = '' }: { size?: 'sm' | 'md' | 'lg'; /** yozuv qismiga (masalan yig'ilgan menyuda yashirish) */ matnKlass?: string }) {
  const w = size === 'sm' ? 28 : size === 'lg' ? 44 : 34
  const nomi = size === 'sm' ? 'text-[15px]' : size === 'lg' ? 'text-xl' : 'text-[17px]'

  return (
    <span className="flex items-center gap-2.5">
      {/* Haqiqiy logotip — qizil belgi ikkala temada ham ko'rinadi */}
      <Image
        src="/logo-qizil.png"
        alt="World Bridge Academy"
        width={w}
        height={w}
        style={{ width: w, height: w }}
        className="shrink-0 object-contain"
        priority
      />
      <span className={`flex flex-col leading-tight ${matnKlass}`}>
        <span className={`font-[family-name:var(--font-display)] font-extrabold tracking-[0.05em] ${nomi}`}>
          WBA
        </span>
        {size !== 'sm' && (
          <span className="font-[family-name:var(--font-mono)] text-[8.5px] uppercase tracking-[0.1em] text-ink-3">
            World Bridge Academy
          </span>
        )}
      </span>
    </span>
  )
}

/* ---------------- Karta ---------------- */

export function Card({
  children,
  className = '',
  as: As = 'div',
}: {
  children: React.ReactNode
  className?: string
  as?: 'div' | 'section' | 'article'
}) {
  return (
    <As className={`rounded-[12px] border border-line bg-surface ${className}`}>{children}</As>
  )
}

export function CardHeader({
  title,
  meta,
  action,
}: {
  title: string
  meta?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
      <h2 className="font-[family-name:var(--font-display)] text-[15px] font-bold">{title}</h2>
      {meta && <span className="lbl">{meta}</span>}
      {action}
    </div>
  )
}

/* ---------------- KPI plitkasi ---------------- */

const TON = {
  neytral: 'text-ink',
  brand: 'text-brand',
  accent: 'text-accent',
  ok: 'text-ok',
} as const

/** Kartadagi ikonka foni — LeaderCRM uslubi: pastel kvadrat, rang ton'dan */
const IKON_FON = {
  neytral: 'bg-surface-2 text-ink-2',
  brand: 'bg-brand-soft text-brand',
  accent: 'bg-accent-soft text-accent',
  ok: 'bg-ok-soft text-ok',
} as const

export function Stat({
  label,
  value,
  sub,
  ton = 'neytral',
  border,
  Icon,
}: {
  label: string
  value: string | number
  sub?: string
  ton?: keyof typeof TON
  border?: 'brand' | 'accent'
  /** Ixtiyoriy: o'ng yuqori burchakda rangli kvadrat ichida ikonka */
  Icon?: (p: { size?: number; className?: string }) => React.ReactElement
}) {
  const chiziq =
    border === 'brand'
      ? 'border-brand-line'
      : border === 'accent'
        ? 'border-accent-line'
        : 'border-line'

  return (
    <div className={`flex flex-col gap-1.5 rounded-[12px] border bg-surface px-4 py-3.5 ${chiziq}`}>
      <span className="flex items-start justify-between gap-2">
        <span className="lbl pt-0.5">{label}</span>
        {Icon && (
          <span className={`-mt-0.5 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-[10px] ${IKON_FON[ton]}`}>
            <Icon size={17} />
          </span>
        )}
      </span>
      <span
        className={`tnum font-[family-name:var(--font-display)] text-[26px] leading-none font-extrabold tracking-[-0.02em] ${TON[ton]}`}
      >
        {typeof value === 'number' ? pul(value) : value}
      </span>
      {sub && <span className="text-xs text-ink-3">{sub}</span>}
    </div>
  )
}

/* ---------------- Nishon ---------------- */

const NISHON = {
  ok: 'bg-ok-soft text-ok',
  brand: 'bg-brand-soft text-brand',
  accent: 'bg-accent-soft text-accent',
  jim: 'bg-surface-2 text-ink-3',
} as const

export function Badge({
  children,
  ton = 'jim',
  nuqta = false,
}: {
  children: React.ReactNode
  ton?: keyof typeof NISHON
  nuqta?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-semibold ${NISHON[ton]}`}
    >
      {nuqta && <span className="block size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/* ---------------- Tugma ---------------- */

const TUGMA = {
  // Qizil fonda matn DOIM oq — yorug' temada text-ink qora bo'lib, qizilda o'qilmasdi.
  asosiy:
    'bg-brand text-white shadow-sm shadow-brand/25 hover:brightness-110 active:brightness-95',
  ikkilamchi:
    'border border-line bg-surface text-ink-2 hover:text-ink hover:border-ink-3 hover:bg-surface-2',
  ogohlantirish: 'bg-accent text-bg font-bold hover:brightness-110 active:brightness-95',
} as const

type TugmaProps = {
  children: React.ReactNode
  variant?: keyof typeof TUGMA
  href?: string
  /** Fayl yuklab beradigan manzil (masalan Excel). Oddiy <a> bo'ladi:
      Next <Link> uni oldindan yuklab (prefetch) har safar faylni behuda yasardi. */
  yuklab?: boolean
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
  name?: string
  value?: string
}

export function Button({
  children,
  variant = 'asosiy',
  href,
  yuklab,
  type = 'button',
  disabled,
  className = '',
  ...rest
}: TugmaProps) {
  const cls = `inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-5 text-[13.5px] font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${TUGMA[variant]} ${className}`

  if (href && yuklab) {
    return (
      <a href={href} download className={cls}>
        {children}
      </a>
    )
  }
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} disabled={disabled} className={cls} {...rest}>
      {children}
    </button>
  )
}

/* ---------------- Bo'sh holat ---------------- */

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-dashed border-line px-4 py-3.5 text-[12.5px] leading-relaxed text-ink-2">
      {children}
    </div>
  )
}

/* ---------------- Gorizontal ustun (chart) ---------------- */

export function BarRow({
  label,
  value,
  max,
  format = pul,
}: {
  label: string
  value: number
  max: number
  format?: (n: number) => string
}) {
  const w = max > 0 ? Math.max(0, (value / max) * 100) : 0
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-3 py-1">
      <span className="truncate text-[12.5px]">{label}</span>
      <span className="h-3.5 overflow-hidden rounded-[4px] bg-surface-2">
        <span
          className="block h-3.5 rounded-[2px_4px_4px_2px] bg-brand"
          style={{ width: `${w}%` }}
        />
      </span>
      <span className={`tnum w-24 text-right font-[family-name:var(--font-mono)] text-xs ${value > 0 ? 'text-ink-2' : 'text-ink-4'}`}>
        {format(value)}
      </span>
    </div>
  )
}

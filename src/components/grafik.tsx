import { pul } from '@/lib/format'

/**
 * Yengil SVG maydon-grafik (area chart) — WBA uslubida, kutubxonasiz.
 * Server komponenti: interaktiv emas, faqat ma'lumotdan SVG chizadi.
 * Ma'lumot ko'paygani sayin (har oy) grafik to'ladi.
 */
export function AreaGrafik({
  nuqtalar,
  balandlik = 150,
  format = pul,
}: {
  nuqtalar: { label: string; value: number }[]
  balandlik?: number
  format?: (n: number) => string
}) {
  const W = 600
  const H = balandlik
  const padX = 8
  const padY = 16
  const n = nuqtalar.length

  if (n === 0) {
    return (
      <div className="flex h-[150px] items-center justify-center text-[13px] text-ink-3">
        Hali ma’lumot yo‘q.
      </div>
    )
  }

  const max = Math.max(1, ...nuqtalar.map((p) => p.value))
  const x = (i: number) => (n === 1 ? W / 2 : padX + (i * (W - padX * 2)) / (n - 1))
  const y = (v: number) => padY + (1 - v / max) * (H - padY * 2)

  const chiziq = nuqtalar.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')
  const maydon = `M ${x(0)},${H - padY} L ${nuqtalar.map((p, i) => `${x(i)},${y(p.value)}`).join(' L ')} L ${x(n - 1)},${H - padY} Z`
  const eng = nuqtalar.reduce((a, p, i) => (p.value >= nuqtalar[a].value ? i : a), 0)

  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full" preserveAspectRatio="none" role="img" aria-label="Tushum dinamikasi">
        <defs>
          <linearGradient id="grafik-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Yordamchi chiziqlar */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1={padX} x2={W - padX} y1={padY + t * (H - padY * 2)} y2={padY + t * (H - padY * 2)} stroke="var(--color-line)" strokeWidth="1" strokeDasharray="3 5" />
        ))}

        <path d={maydon} fill="url(#grafik-fill)" />
        <polyline points={chiziq} fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

        {nuqtalar.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={i === eng ? 4 : 2.5} fill={i === eng ? 'var(--color-brand)' : 'var(--color-bg)'} stroke="var(--color-brand)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>

      <div className="flex justify-between px-1">
        {nuqtalar.map((p, i) => (
          <span key={i} className="flex flex-col items-center gap-0.5">
            <span className="lbl text-[9px]">{p.label}</span>
            <span className={`tnum font-[family-name:var(--font-mono)] text-[10px] ${i === eng ? 'text-brand' : 'text-ink-3'}`}>
              {format(p.value)}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Hero uchun rasm: ustma-ust uchta kitob, har birining muqovasida WBA logotipi.
 * Ranglar temadan olinadi (brand / ink / accent), faqat sahifa qirrasi qog'oz rangida.
 */

const QOGOZ = '#f4eee5'
const QOGOZ_CHIZIQ = '#d8cdbd'
const CHUQUR = { dx: 36, dy: -26 }

type Kitob = {
  x: number
  y: number
  w: number
  h: number
  rang: string
  logo: '/logo-oq.png' | '/logo-qizil.png'
  matn: string
  burish?: number
}

const KITOBLAR: Kitob[] = [
  { x: 36, y: 318, w: 372, h: 70, rang: 'var(--color-brand)', logo: '/logo-oq.png', matn: 'ACADEMY' },
  { x: 62, y: 248, w: 330, h: 70, rang: 'var(--color-ink)', logo: '/logo-qizil.png', matn: 'BRIDGE' },
  { x: 48, y: 186, w: 340, h: 62, rang: 'var(--color-accent)', logo: '/logo-oq.png', matn: 'WORLD', burish: -3 },
]

function KitobChiz({ k, i }: { k: Kitob; i: number }) {
  const { x, y, w, h, rang, logo, matn } = k
  const { dx, dy } = CHUQUR
  const lw = h * 0.62 * (600 / 492)
  const lh = h * 0.62

  return (
    <g transform={k.burish ? `rotate(${k.burish} ${x + w / 2} ${y + h})` : undefined}>
      {/* Ustki muqova */}
      <polygon points={`${x},${y} ${x + w},${y} ${x + w + dx},${y + dy} ${x + dx},${y + dy}`} fill={rang} />
      <polygon
        points={`${x},${y} ${x + w},${y} ${x + w + dx},${y + dy} ${x + dx},${y + dy}`}
        fill="#fff"
        opacity=".22"
      />
      {/* Sahifalar qirrasi */}
      <polygon
        points={`${x + w - 4},${y + 5} ${x + w + dx - 6},${y + dy + 5} ${x + w + dx - 6},${y + dy + h - 5} ${x + w - 4},${y + h - 5}`}
        fill={QOGOZ}
      />
      {[0.25, 0.45, 0.65, 0.85].map((t) => (
        <line
          key={t}
          x1={x + w - 4}
          y1={y + 5 + (h - 10) * t}
          x2={x + w + dx - 6}
          y2={y + dy + 5 + (h - 10) * t}
          stroke={QOGOZ_CHIZIQ}
          strokeWidth="1"
        />
      ))}
      {/* Orqa muqova qirrasi (o'ng tomon) */}
      <polygon
        points={`${x + w},${y} ${x + w + dx},${y + dy} ${x + w + dx},${y + dy + 6} ${x + w},${y + 6}`}
        fill={rang}
      />
      {/* Kitob qobig'i (oldi) */}
      <rect x={x} y={y} width={w} height={h} rx="7" fill={rang} />
      <rect x={x} y={y} width={w} height={h} rx="7" fill="#000" opacity=".08" />
      <rect x={x + 22} y={y} width="6" height={h} fill="#000" opacity=".14" />
      <rect x={x + w - 34} y={y} width="6" height={h} fill="#000" opacity=".14" />
      <image
        href={logo}
        x={x + 46}
        y={y + (h - lh) / 2}
        width={lw}
        height={lh}
        preserveAspectRatio="xMidYMid meet"
      />
      <text
        x={x + 62 + lw}
        y={y + h / 2 + h * 0.12}
        fill={i === 1 ? 'var(--color-bg)' : '#fff'}
        fontFamily="var(--font-display)"
        fontWeight="800"
        fontSize={h * 0.34}
        letterSpacing="3"
      >
        {matn}
      </text>
    </g>
  )
}

export function Kitoblar({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 460 430" className={className} role="img" aria-label="WBA logotipi tushirilgan uchta kitob">
      <circle cx="235" cy="235" r="190" fill="var(--color-brand-soft)" />
      <ellipse cx="236" cy="396" rx="200" ry="16" fill="#000" opacity=".22" />
      {KITOBLAR.map((k, i) => (
        <KitobChiz key={i} k={k} i={i} />
      ))}
    </svg>
  )
}

/**
 * "World Bridge" — ko'prik: o'rtada osma kabel, chetlarda vantlar.
 * Ochilganda chiziqlar o'zi chiziladi (lending.css → .lb-chizik),
 * yo'lda turgan rangli nuqtalar — yo'nalishlar (bekatlar).
 * Hamma chiziqqa pathLength=100 — animatsiya uzunligini hisoblash shart emas.
 */

const PILON = [150, 370] as const
const PILON_TEPA = 40
const YOL = 172
const EGILISH = 240 // kabel egri chizig'ining boshqaruv nuqtasi (y)

/** O'rta oraliqdagi kabelning x nuqtadagi balandligi (kvadratik Bezier) */
function kabelY(x: number): number {
  const t = (x - PILON[0]) / (PILON[1] - PILON[0])
  return PILON_TEPA * (1 - t) ** 2 + 2 * EGILISH * t * (1 - t) + PILON_TEPA * t ** 2
}

const OSMALAR = Array.from({ length: 9 }, (_, n) => PILON[0] + 22 * (n + 1))
const VANTLAR = [
  { x1: PILON[0], x2: 22 },
  { x1: PILON[0], x2: 62 },
  { x1: PILON[0], x2: 102 },
  { x1: PILON[1], x2: 418 },
  { x1: PILON[1], x2: 458 },
  { x1: PILON[1], x2: 498 },
]
const BEKATLAR = [
  { x: 56, rang: 'var(--color-osmon)' },
  { x: 128, rang: 'var(--color-brand)' },
  { x: 214, rang: 'var(--color-accent)' },
  { x: 306, rang: 'var(--color-binafsha)' },
  { x: 392, rang: 'var(--color-firuza)' },
  { x: 464, rang: 'var(--color-ok)' },
]

export function Kopruk({ className = '' }: { className?: string }) {
  const chiz = (k: number) => ({ '--uz': 100, '--k': `${k}ms` }) as React.CSSProperties

  return (
    <svg viewBox="0 0 520 210" className={className} fill="none" aria-hidden="true">
      {/* Suv aksi */}
      <path d="M0 196 H520" stroke="var(--color-line)" strokeWidth="1" strokeDasharray="2 7" />

      {/* Vantlar */}
      {VANTLAR.map((v, n) => (
        <path
          key={`${v.x1}-${v.x2}`}
          d={`M${v.x1} ${PILON_TEPA + 6} L${v.x2} ${YOL}`}
          pathLength={100}
          className="lb-chizik"
          style={chiz(500 + n * 70)}
          stroke="var(--color-ink-3)"
          strokeWidth="1.3"
        />
      ))}

      {/* Osma ilgaklar */}
      {OSMALAR.map((x, n) => (
        <path
          key={x}
          d={`M${x} ${kabelY(x).toFixed(1)} L${x} ${YOL}`}
          pathLength={100}
          className="lb-chizik"
          style={chiz(1100 + n * 45)}
          stroke="var(--color-ink-3)"
          strokeWidth="1.2"
        />
      ))}

      {/* Asosiy kabel */}
      <path
        d={`M${PILON[0]} ${PILON_TEPA} Q${(PILON[0] + PILON[1]) / 2} ${EGILISH} ${PILON[1]} ${PILON_TEPA}`}
        pathLength={100}
        className="lb-chizik"
        style={chiz(700)}
        stroke="var(--color-brand)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Pilonlar */}
      {PILON.map((x, n) => (
        <path
          key={x}
          d={`M${x} 200 L${x} ${PILON_TEPA - 8}`}
          pathLength={100}
          className="lb-chizik"
          style={chiz(n * 150)}
          stroke="var(--color-ink)"
          strokeWidth="7"
          strokeLinecap="round"
        />
      ))}

      {/* Yo'l */}
      <path
        d={`M6 ${YOL} H514`}
        pathLength={100}
        className="lb-chizik"
        style={chiz(300)}
        stroke="var(--color-ink)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Bekatlar — yo'nalishlar */}
      {BEKATLAR.map((b, n) => (
        <g key={b.x} className="lb-bekat" style={{ '--k': `${1700 + n * 110}ms` } as React.CSSProperties}>
          <circle cx={b.x} cy={YOL} r="9" fill="var(--color-surface)" stroke={b.rang} strokeWidth="3" />
          <circle cx={b.x} cy={YOL} r="3.5" fill={b.rang} />
        </g>
      ))}
    </svg>
  )
}

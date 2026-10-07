/**
 * Qiya qizil lenta — markazdagi fanlarning "so'zlari" oqib o'tadi.
 * Mazmun ikki marta takrorlanadi: -50% ga surilganda chok ko'rinmaydi.
 * Bezak — ekran o'quvchiga yashirilgan.
 */

const SOZLAR: { s: string; arab?: boolean }[] = [
  { s: 'Hello' },
  { s: 'Привет' },
  { s: 'مرحبا', arab: true },
  { s: 'Merhaba' },
  { s: 'a² + b² = c²' },
  { s: 'Nima uchun?' },
  { s: '<html>' },
  { s: 'AI' },
  { s: 'IELTS' },
  { s: 'DTM' },
]

function Yulduz() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0 opacity-70">
      <path d="M9 0 L11 7 L18 9 L11 11 L9 18 L7 11 L0 9 L7 7 Z" fill="currentColor" />
    </svg>
  )
}

export function Lenta() {
  const bolak = SOZLAR.map((v) => (
    <span key={v.s} className="flex items-center gap-7 pr-7">
      <span
        dir={v.arab ? 'rtl' : undefined}
        className={`whitespace-nowrap text-[26px] leading-none sm:text-[34px] ${v.arab ? 'lb-arab' : 'h-display'}`}
      >
        {v.s}
      </span>
      <Yulduz />
    </span>
  ))

  return (
    <div aria-hidden="true" translate="no" className="relative -mx-5 my-4 overflow-hidden py-6 lg:-mx-8">
      <div className="lb-lenta -rotate-2 bg-brand py-4 text-white shadow-[0_20px_50px_-20px_var(--color-brand)]">
        <div className="lb-lenta-ichi">
          <div className="flex">{bolak}</div>
          <div className="flex">{bolak}</div>
        </div>
      </div>
    </div>
  )
}

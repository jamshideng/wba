/**
 * Dars formati rasmi: ustoz (qizil) va o'quvchilar (siluetlar).
 * VIP — ustoz + 1, mini — ustoz + 2, standart — ustoz + 12.
 * Ma'nosi: guruh qancha kichik bo'lsa, ustoz e'tibori shuncha ko'p.
 */
function Odam({ ustoz = false, size = 28 }: { ustoz?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={ustoz ? 'text-brand' : 'text-ink'}
      fill="currentColor"
    >
      <circle cx="12" cy="7.2" r="4.2" />
      <path d="M3.5 21.5c0-4.9 3.8-8.3 8.5-8.3s8.5 3.4 8.5 8.3c0 .55-.45 1-1 1h-15c-.55 0-1-.45-1-1z" />
    </svg>
  )
}

export function Odamlar({ son }: { son: number }) {
  const kichik = son > 2
  return (
    <div className="flex items-end gap-4" aria-hidden="true">
      <div className="flex flex-col items-center gap-1.5">
        <Odam ustoz size={kichik ? 40 : 48} />
        <span className="lbl text-[9.5px] text-brand">ustoz</span>
      </div>
      <span className="mb-6 h-px w-6 shrink-0 bg-line" />
      <div className={`grid gap-1.5 ${kichik ? 'grid-cols-6' : 'grid-flow-col gap-2.5'}`}>
        {Array.from({ length: son }, (_, n) => (
          <span key={n} className={kichik ? 'opacity-70' : ''}>
            <Odam size={kichik ? 20 : 48} />
          </span>
        ))}
      </div>
    </div>
  )
}

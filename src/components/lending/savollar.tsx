import { SAVOLLAR } from '@/lib/savollar'

export function Savollar() {
  return (
    <div className="flex flex-col border-t border-line">
      {SAVOLLAR.map((v, i) => (
        <details key={v.s} name="savol" className="lb-savol-blok group border-b border-line" data-ochil={i * 0.03}>
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-5 [&::-webkit-details-marker]:hidden">
            <span className="flex items-baseline gap-4 sm:gap-6">
              <span className="font-[family-name:var(--font-mono)] text-[12.5px] text-ink-3 tnum">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-[17px] font-bold leading-snug sm:text-[21px]">{v.s}</span>
            </span>
            <span
              aria-hidden="true"
              className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-line transition group-open:rotate-45 group-open:border-brand group-open:bg-brand group-open:text-white"
            >
              <span className="absolute h-[1.5px] w-3.5 bg-current" />
              <span className="absolute h-3.5 w-[1.5px] bg-current" />
            </span>
          </summary>
          <p className="max-w-[70ch] pb-6 pl-[calc(12.5px*2+1rem)] text-[15.5px] leading-relaxed text-ink-2 sm:pl-[calc(12.5px*2+1.5rem)]">
            {v.j}
          </p>
        </details>
      ))}
    </div>
  )
}

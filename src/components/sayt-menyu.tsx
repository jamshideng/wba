'use client'

import { useRef } from 'react'
import { IconMenyu } from '@/components/icons'

/**
 * Telefondagi ommaviy sayt menyusi: <details> — ochish/yopish brauzerning o'zida,
 * JS faqat havola bosilganda menyuni yopish uchun. Kompyuterda ko'rinmaydi.
 *
 * `hidden group-open:block` MUHIM. Menyu `position: absolute` bo'lgani uchun
 * yopiq <details> uni baribir joylashtirib qo'yadi: havolalar ko'rinmasa ham
 * 4px enlikda qolib, klaviatura fokusiga tushardi va skrinrider ularni o'qib
 * ketardi (02.10 da o'lchab topildi). `display: none` buni butunlay yopadi.
 */
export function SaytMenyu({ menyu }: { menyu: { href: string; nom: string }[] }) {
  const ref = useRef<HTMLDetailsElement>(null)
  return (
    <details ref={ref} className="sayt-menyu group sm:hidden">
      <summary
        aria-label="Menyu"
        className="flex size-11 cursor-pointer list-none items-center justify-center rounded-[9px] border border-line text-ink [&::-webkit-details-marker]:hidden"
      >
        <IconMenyu size={20} />
      </summary>
      <nav
        className="absolute inset-x-0 top-full hidden border-b border-line-soft bg-bg px-5 pb-4 shadow-lg group-open:block"
        onClick={() => ref.current?.removeAttribute('open')}
      >
        {menyu.map((m) => (
          <a key={m.href} href={m.href} className="flex min-h-12 items-center border-b border-line-soft text-[16px] font-semibold text-ink">
            {m.nom}
          </a>
        ))}
        <a
          href="/ariza"
          className="mt-4 flex min-h-12 items-center justify-center rounded-[10px] bg-brand text-[15px] font-bold text-white"
        >
          Bepul sinov darsi
        </a>
      </nav>
    </details>
  )
}

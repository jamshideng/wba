'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Telefonning pastki panelidagi band. Hozirgi bo'lim rang bilan ajraladi —
 * ustoz/o'quvchi qayerda turganini bilsin. Faqat usePathname: qo'shimcha
 * kutubxona yo'q, sahifa og'irligi deyarli o'zgarmaydi.
 */
export function PastkiHavola({ href, children }: { href: string; children: React.ReactNode }) {
  const yol = usePathname()
  const faol = href === '/crm/menyu' ? yol === href : yol === href || yol.startsWith(`${href}/`)
  return (
    <Link
      href={href}
      aria-current={faol ? 'page' : undefined}
      className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 transition ${
        faol ? 'font-semibold text-brand' : 'text-ink-3 hover:text-ink'
      }`}
    >
      {children}
    </Link>
  )
}

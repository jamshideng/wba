'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Telefonning pastki panelidagi band. Hozirgi bo'lim rang bilan ajraladi —
 * ustoz/o'quvchi qayerda turganini bilsin. Faqat usePathname: qo'shimcha
 * kutubxona yo'q, sahifa og'irligi deyarli o'zgarmaydi.
 */
export function PastkiHavola({ href, children }: { href: string; children: React.ReactNode }) {
  const yol = usePathname()
  // Telefonda panel 4–5 band: ochilishi bilan bo'sh vaqtda to'liq oldindan yuklaymiz.
  const [yuklash, setYuklash] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setYuklash(true), 1500)
    return () => clearTimeout(t)
  }, [])
  const faol = href === '/crm/menyu' ? yol === href : yol === href || yol.startsWith(`${href}/`)
  return (
    <Link
      href={href}
      prefetch={yuklash}
      onTouchStart={() => setYuklash(true)}
      aria-current={faol ? 'page' : undefined}
      className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 transition ${
        faol ? 'font-semibold text-brand' : 'text-ink-3 hover:text-ink'
      }`}
    >
      {children}
    </Link>
  )
}

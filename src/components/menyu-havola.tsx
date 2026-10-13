'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { faolHavola } from '@/components/menyu-guruh'

/**
 * Yon menyudagi band. Hozirgi bo'lim ajralib turadi (LeaderCRM uslubi:
 * yumshoq fon + chap chiziq) — xodim qayerda turganini bir qarashda ko'radi.
 * `?filtr=...` li havolalar (Tasdiqlash) faqat yo'l bo'yicha solishtiriladi.
 */
export function MenyuHavola({
  href,
  title,
  qoshnilar,
  children,
}: {
  href: string
  title: string
  /** Guruhdagi boshqa havolalar — eng aniq mosi faol bo'ladi (/crm/oquvchilar/takroriy) */
  qoshnilar?: string[]
  children: React.ReactNode
}) {
  const yol = usePathname()
  const faol = faolHavola(yol, [href, ...(qoshnilar ?? [])]) === href
  return (
    <Link
      href={href}
      title={title}
      aria-current={faol ? 'page' : undefined}
      className={`relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13.5px] whitespace-nowrap transition group-data-[menyu=yopiq]/qobiq:justify-center group-data-[menyu=yopiq]/qobiq:px-0 ${
        faol
          ? 'bg-brand-soft font-semibold text-ink before:absolute before:top-2 before:bottom-2 before:-left-3.5 before:w-[3px] before:rounded-r before:bg-brand group-data-[menyu=yopiq]/qobiq:before:-left-2'
          : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
      }`}
    >
      {children}
    </Link>
  )
}

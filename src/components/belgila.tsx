'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Manba havolasi (26.10): `?b=kun:2026-10-12,oq:<id>` — sahifadagi
 * `data-belgi` (bo'sh joy bilan ajratilgan tokenlar) shu tokenlardan
 * birortasiga mos elementlar rang bilan ajratiladi va birinchisiga suriladi.
 *
 * Elementlarga sinf qo'shilmaydi (React gidratsiyasini buzmasin) — ajratish
 * shu yerda yasalgan <style> qoidasi bilan. Ma'lumot keyin yuklansa
 * (Suspense) — surish uchun 6 soniya kutadi.
 */
export function Belgila() {
  const yol = usePathname()
  const b = useSearchParams().get('b')
  const tanlov = (b ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => /^[\w:@.-]{1,80}$/.test(t))
    .map((t) => `[data-belgi~="${t}"]`)
    .join(',')

  useEffect(() => {
    if (!tanlov) return
    const sur = () => {
      const birinchi = document.querySelector<HTMLElement>(tanlov)
      if (!birinchi) return false
      birinchi.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
      return true
    }
    if (sur()) return
    const kuzat = new MutationObserver(() => {
      if (sur()) kuzat.disconnect()
    })
    kuzat.observe(document.body, { childList: true, subtree: true })
    const vaqt = setTimeout(() => kuzat.disconnect(), 6000)
    return () => {
      kuzat.disconnect()
      clearTimeout(vaqt)
    }
  }, [tanlov, yol])

  if (!tanlov) return null
  return <style>{`:is(${tanlov}){${BELGI_USLUB}}`}</style>
}

/** Rang — globals.css tokenlari; yonib-o'chish — .belgi-yonish (globals.css) */
const BELGI_USLUB =
  'outline:2px solid var(--color-accent);outline-offset:-2px;' +
  'background-color:color-mix(in oklab,var(--color-accent) 22%,var(--color-surface))!important;' +
  'animation:belgi-yonish 1.1s ease-in-out 3'

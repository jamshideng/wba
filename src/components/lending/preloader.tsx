'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { gsap, KIRISH_HODISA, harakatKam } from '@/lib/harakat'

const KALIT = 'wba-kirish'

const PARDA_SKRIPT = `try{if(sessionStorage.getItem('${KALIT}')==='1'||matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.dataset.parda='yoq'}catch(e){}`

/** Preloader tugadi — hero animatsiyasi shu hodisani kutadi */
function tayyor() {
  document.documentElement.dataset.kirish = 'tayyor'
  window.dispatchEvent(new Event(KIRISH_HODISA))
}

/**
 * Kirish pardasi: 000 → 100 sanog'i, logotip, keyin ikki parda ochiladi.
 * Sessiyada bir marta. JS yuklanmasa ham sahifa yopiq qolmasin — CSS o'zi
 * 3.5 soniyadan keyin yashiradi (lending.css → .lb-parda).
 */
export function Preloader() {
  const ildiz = useRef<HTMLDivElement>(null)
  const raqam = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ildiz.current
    let korilgan = false
    try {
      korilgan = sessionStorage.getItem(KALIT) === '1'
      sessionStorage.setItem(KALIT, '1')
    } catch {
      // maxfiy rejim — har safar ko'rsatamiz, zarari yo'q
    }
    if (!el || korilgan || harakatKam()) {
      el?.remove()
      tayyor()
      return
    }

    const sanoq = { n: 0 }
    const tl = gsap.timeline({ onComplete: () => el.remove() })
    tl.to(sanoq, {
      n: 100,
      duration: 1.0,
      ease: 'power2.inOut',
      onUpdate: () => {
        if (raqam.current) raqam.current.textContent = String(Math.round(sanoq.n)).padStart(3, '0')
      },
    })
      .to(el.querySelector('.lb-parda-ichi'), { y: -30, opacity: 0, duration: 0.4, ease: 'power2.in' })
      .add(tayyor, '-=0.05')
      .to(el.querySelectorAll('.lb-parda-yarim'), {
        yPercent: (i: number) => (i === 0 ? -100 : 100),
        duration: 0.9,
        ease: 'expo.inOut',
      }, '<')
    return () => {
      tl.kill()
    }
  }, [])

  return (
    <>
    {/* Sessiyada ko'rilgan bo'lsa yoki harakat o'chirilgan bo'lsa — parda birinchi
        chizilishdayoq yashirin (gidratsiyani kutib qizil ekran "yaltiramasin"). */}
    <script dangerouslySetInnerHTML={{ __html: PARDA_SKRIPT }} />
    <div ref={ildiz} className="lb-parda fixed inset-0 z-[90]" aria-hidden="true">
      <div className="lb-parda-yarim absolute inset-x-0 top-0 h-1/2 bg-brand" />
      <div className="lb-parda-yarim absolute inset-x-0 bottom-0 h-1/2 bg-brand" />
      <div className="lb-parda-ichi absolute inset-0 flex flex-col items-center justify-center gap-6 text-white">
        <Image src="/logo-oq.png" alt="" width={72} height={72} priority className="size-[72px] object-contain" />
        <span translate="no" className="h-display text-[15px] tracking-[0.35em]">WORLD BRIDGE ACADEMY</span>
        <span ref={raqam} className="h-display tnum text-[64px] leading-none">000</span>
      </div>
    </div>
    </>
  )
}

'use client'

import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger, harakatKam, kirishTayyor, sensorli, silliqSkroll } from '@/lib/harakat'

/**
 * Bosh sahifaning "dvigateli": silliq skroll, tepadagi progress chizig'i va
 * sahifadagi atributlar bo'yicha animatsiyalar:
 *   [data-hero]       — preloader'dan keyin navbat bilan chiqadi
 *   [data-ochil]      — ko'rinishga kirganda pastdan chiqadi
 *   [data-sozlab]     — ichidagi .lb-w so'zlari birma-bir ochiladi
 *   [data-parallaks]  — skrollda qiymat (px) bo'yicha siljiydi
 * Kursorga bog'liq effekt yo'q (ataylab) — oddiy kursor.
 * Harakat kamaytirilgan bo'lsa — hammasi joyida, animatsiyasiz.
 */
export function Harakat() {
  const chiziq = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (harakatKam()) return
    const toxta = silliqSkroll()
    // Telefonda blur chizish og'ir — faqat siljish va shaffoflik
    const xira = sensorli() ? 'none' : 'blur(8px)'

    const ctx = gsap.context(() => {
      if (chiziq.current) {
        gsap.to(chiziq.current, {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
        })
      }

      gsap.utils.toArray<HTMLElement>('[data-ochil]').forEach((el) => {
        gsap.from(el, {
          y: 40,
          opacity: 0,
          filter: xira,
          duration: 1,
          ease: 'expo.out',
          delay: Number(el.dataset.ochil) || 0,
          clearProps: 'transform,opacity,filter',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        })
      })

      gsap.utils.toArray<HTMLElement>('[data-sozlab]').forEach((el) => {
        gsap.from(el.querySelectorAll('.lb-w'), {
          yPercent: 110,
          duration: 0.9,
          ease: 'expo.out',
          stagger: 0.04,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        })
      })

      gsap.utils.toArray<HTMLElement>('[data-parallaks]').forEach((el) => {
        gsap.to(el, {
          y: Number(el.dataset.parallaks) || -80,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
        })
      })
    })

    // Hero — preloader tugagach
    let heroTl: gsap.core.Timeline | null = null
    kirishTayyor().then(() => {
      heroTl = gsap
        .timeline()
        .from('[data-hero-soz] .lb-w', { yPercent: 115, duration: 1, ease: 'expo.out', stagger: 0.05 })
        .from(
          '[data-hero]',
          { y: 30, opacity: 0, filter: xira, duration: 0.9, ease: 'expo.out', stagger: 0.07, clearProps: 'filter' },
          0.15,
        )
      ScrollTrigger.refresh()
    })

    return () => {
      heroTl?.kill()
      ctx.revert()
      toxta()
    }
  }, [])

  return (
    <div
      ref={chiziq}
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] origin-left scale-x-0 bg-brand"
    />
  )
}

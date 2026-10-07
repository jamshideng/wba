'use client'

import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger, harakatKam, kirishTayyor, sensorli, silliqSkroll } from '@/lib/harakat'

/**
 * Bosh sahifaning "dvigateli": silliq skroll, tepadagi rangli progress chizig'i,
 * kompyuterda maxsus kursor va sahifadagi atributlar bo'yicha animatsiyalar:
 *   [data-hero]       — preloader'dan keyin navbat bilan chiqadi
 *   [data-ochil]      — ko'rinishga kirganda pastdan, xiralikdan chiqadi
 *   [data-sozlab]     — ichidagi .lb-w so'zlari birma-bir ochiladi
 *   [data-parallaks]  — skrollda qiymat (px) bo'yicha siljiydi
 *   [data-kursor]     — kursor ustiga kelganda yozuv chiqadi (qiymati — yozuv)
 * Harakat kamaytirilgan bo'lsa — hammasi joyida, animatsiyasiz.
 */
export function Harakat() {
  const chiziq = useRef<HTMLDivElement>(null)
  const kursor = useRef<HTMLDivElement>(null)
  const yozuv = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (harakatKam()) {
      document.documentElement.dataset.harakat = 'yoq'
      return
    }
    const toxta = silliqSkroll()
    const ctx = gsap.context(() => {
      // Tepadagi progress
      if (chiziq.current) {
        gsap.to(chiziq.current, {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
        })
      }

      gsap.utils.toArray<HTMLElement>('[data-ochil]').forEach((el) => {
        gsap.from(el, {
          y: 60,
          opacity: 0,
          filter: sensorli() ? 'none' : 'blur(10px)',
          duration: 1.1,
          ease: 'expo.out',
          delay: Number(el.dataset.ochil) || 0,
          // Kartalar o'z transform'ini (og'ish, filtr) CSS'dan oladi — iz qolmasin
          clearProps: 'transform,opacity,filter',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        })
      })

      gsap.utils.toArray<HTMLElement>('[data-sozlab]').forEach((el) => {
        gsap.from(el.querySelectorAll('.lb-w'), {
          yPercent: 110,
          opacity: 0,
          rotate: 4,
          duration: 0.9,
          ease: 'expo.out',
          stagger: 0.045,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
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
      const el = gsap.utils.toArray<HTMLElement>('[data-hero]')
      heroTl = gsap.timeline().from(el, {
        y: 70,
        opacity: 0,
        filter: 'blur(12px)',
        duration: 1,
        ease: 'expo.out',
        stagger: 0.09,
        clearProps: 'filter',
      })
      gsap.from('[data-hero-soz] .lb-w', {
        yPercent: 120,
        rotate: 6,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.06,
        delay: 0.05,
      })
      ScrollTrigger.refresh()
    })

    // Kursor — faqat sichqonchada
    let kursorToxta = () => {}
    if (!sensorli() && kursor.current) {
      const k = kursor.current
      const x = gsap.quickTo(k, 'x', { duration: 0.45, ease: 'power3' })
      const y = gsap.quickTo(k, 'y', { duration: 0.45, ease: 'power3' })
      const harakat = (e: PointerEvent) => {
        x(e.clientX)
        y(e.clientY)
        const nishon = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-kursor], a, button')
        const matn = nishon?.dataset.kursor ?? ''
        k.dataset.holat = nishon ? (matn ? 'yozuv' : 'havola') : ''
        if (yozuv.current && yozuv.current.textContent !== matn) yozuv.current.textContent = matn
      }
      const chiq = () => (k.dataset.holat = 'yoq')
      window.addEventListener('pointermove', harakat)
      document.documentElement.addEventListener('pointerleave', chiq)
      document.documentElement.dataset.kursor = 'ha'
      kursorToxta = () => {
        window.removeEventListener('pointermove', harakat)
        document.documentElement.removeEventListener('pointerleave', chiq)
        delete document.documentElement.dataset.kursor
      }
    }

    return () => {
      heroTl?.kill()
      ctx.revert()
      kursorToxta()
      toxta()
    }
  }, [])

  return (
    <>
      <div
        ref={chiziq}
        aria-hidden="true"
        className="lb-progress pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] origin-left scale-x-0"
      />
      <div ref={kursor} aria-hidden="true" className="lb-kursor pointer-events-none fixed top-0 left-0 z-[70]">
        <span ref={yozuv} className="lb-kursor-yozuv" />
      </div>
    </>
  )
}

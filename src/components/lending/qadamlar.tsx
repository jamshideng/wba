'use client'

import { useEffect, useRef } from 'react'
import { gsap, harakatKam } from '@/lib/harakat'

/**
 * "Yozilgandan keyin nima bo'ladi" — to'rt qadam. Kompyuterda bo'lim
 * qotib turadi va qadamlar gorizontal suriladi (skroll bilan), telefonda
 * oddiy ustun. Matn — rost: markazning o'z jarayoni.
 */
const QADAMLAR = [
  { nom: 'Ariza qoldirasiz', t: 'Ism va telefon — boshqa hech narsa kerak emas. Bir daqiqa ham ketmaydi.', r: 'var(--color-brand)' },
  { nom: 'Qo‘ng‘iroq qilamiz', t: 'Bir ish kuni ichida bog‘lanamiz va sizga qulay vaqtni kelishamiz.', r: 'var(--color-osmon)' },
  { nom: 'Bepul sinov darsi', t: 'Daraja bepul aniqlanadi, guruhda bir dars o‘tirib ko‘rasiz.', r: 'var(--color-binafsha)' },
  { nom: 'Yoqsa — davom etasiz', t: 'To‘lov faqat shundan keyin. Davomat va baholar shaxsiy sahifada ko‘rinadi, oxirida sertifikat.', r: 'var(--color-ok)' },
]

export function Qadamlar() {
  const bolim = useRef<HTMLElement>(null)
  const yolak = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (harakatKam() || !bolim.current || !yolak.current) return
    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px)', () => {
      const y = yolak.current!
      gsap.to(y, {
        x: () => -(y.scrollWidth - window.innerWidth + 64),
        ease: 'none',
        scrollTrigger: {
          trigger: bolim.current,
          start: 'top top',
          end: () => `+=${y.scrollWidth - window.innerWidth + 64}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      })
    })
    return () => mm.revert()
  }, [])

  return (
    <section ref={bolim} id="qadamlar" aria-labelledby="qadamlar-sarlavha" className="relative overflow-hidden py-14 lg:flex lg:h-screen lg:items-center lg:py-0">
      <div ref={yolak} className="flex flex-col gap-4 px-5 lg:w-max lg:flex-row lg:items-stretch lg:gap-6 lg:px-8">
        <div className="flex flex-col justify-center gap-4 lg:w-[440px] lg:shrink-0 lg:pr-6">
          <p className="lbl text-brand">Qanday boshlanadi</p>
          <h2 id="qadamlar-sarlavha" className="h-display text-[40px] leading-[0.98] sm:text-[60px]">
            To‘rt qadam — va siz darsdasiz
          </h2>
          <p className="max-w-[380px] text-[15.5px] leading-relaxed text-ink-2">
            Oldindan to‘lov ham, majburiyat ham yo‘q. Avval ko‘rasiz, keyin qaror qilasiz.
          </p>
        </div>

        {QADAMLAR.map((q, i) => (
          <article
            key={q.nom}
            data-ochil={i * 0.05}
            className="lb-qadam relative flex flex-col justify-between gap-10 overflow-hidden rounded-[30px] p-7 text-white sm:p-9 lg:h-[64vh] lg:max-h-[560px] lg:w-[420px] lg:shrink-0"
            style={{ '--r': q.r } as React.CSSProperties}
          >
            <span
              aria-hidden="true"
              className="h-display pointer-events-none absolute -top-6 -right-2 text-[220px] leading-none text-white/15 lg:text-[300px]"
            >
              {i + 1}
            </span>
            <span className="lbl relative w-fit rounded-full bg-black/20 px-3 py-1.5 text-white">{i + 1}-qadam</span>
            <span className="relative flex flex-col gap-3">
              <span className="h-display text-[34px] leading-none sm:text-[42px]">{q.nom}</span>
              <span className="text-[16px] leading-relaxed font-medium text-white/90">{q.t}</span>
            </span>
          </article>
        ))}
      </div>
    </section>
  )
}

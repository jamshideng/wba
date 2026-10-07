'use client'

import { useEffect, useRef } from 'react'
import { gsap, harakatKam } from '@/lib/harakat'

/**
 * "Yozilgandan keyin nima bo'ladi" — to'rt qadam. Kompyuterda bo'lim
 * qotib turadi va qadamlar gorizontal suriladi (skroll bilan), telefonda
 * oddiy ustun. Matn — rost: markazning o'z jarayoni.
 */
const QADAMLAR = [
  { nom: 'Ariza qoldirasiz', t: 'Ism va telefon — boshqa hech narsa kerak emas. Bir daqiqa ham ketmaydi.' },
  { nom: 'Qo‘ng‘iroq qilamiz', t: 'Bir ish kuni ichida bog‘lanamiz va sizga qulay vaqtni kelishamiz.' },
  { nom: 'Bepul sinov darsi', t: 'Daraja bepul aniqlanadi, guruhda bir dars o‘tirib ko‘rasiz.' },
  { nom: 'Yoqsa — davom etasiz', t: 'To‘lov faqat shundan keyin. Davomat va baholar shaxsiy sahifada ko‘rinadi, oxirida sertifikat.' },
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
          <h2 id="qadamlar-sarlavha" className="h-display text-[38px] leading-[0.98] sm:text-[60px]">
            To‘rt qadam — va siz darsdasiz
          </h2>
          <p className="max-w-[380px] text-[15.5px] leading-relaxed text-ink-2">
            Oldindan to‘lov ham, majburiyat ham yo‘q. Avval ko‘rasiz, keyin qaror qilasiz.
          </p>
        </div>

        {QADAMLAR.map((q, i) => {
          const oxirgi = i === QADAMLAR.length - 1
          return (
            <article
              key={q.nom}
              data-ochil={i * 0.05}
              className={`relative flex min-h-[220px] flex-col justify-between gap-8 overflow-hidden rounded-[26px] p-6 sm:p-8 lg:h-[62vh] lg:max-h-[540px] lg:w-[400px] lg:shrink-0 ${
                oxirgi ? 'bg-brand text-white' : 'border border-line bg-surface'
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-display pointer-events-none absolute -top-4 right-3 text-[150px] leading-none sm:text-[200px] lg:text-[260px] ${
                  oxirgi ? 'text-white/15' : 'lb-kontur'
                }`}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className={`lbl relative ${oxirgi ? 'text-white/80' : 'text-brand'}`}>{i + 1}-qadam</span>
              <span className="relative flex flex-col gap-3">
                <span className="h-display text-[30px] leading-[1.02] sm:text-[38px]">{q.nom}</span>
                <span className={`text-[15px] leading-relaxed ${oxirgi ? 'text-white/85' : 'text-ink-2'}`}>{q.t}</span>
              </span>
            </article>
          )
        })}
      </div>
    </section>
  )
}

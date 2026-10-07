'use client'

/**
 * Bosh sahifa harakatlari uchun umumiy narsa: GSAP + ScrollTrigger + Lenis.
 * Faqat brauzerda ishlaydi ('use client' komponentlardan chaqiriladi).
 */
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)
// Telefonda manzil satri yashirinib-chiqqanda pin'lar sakramasin
ScrollTrigger.config({ ignoreMobileResize: true })

export { gsap, ScrollTrigger }

export const harakatKam = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const sensorli = () => window.matchMedia('(hover: none), (pointer: coarse)').matches

let lenis: Lenis | null = null

/** Sahifa bo'ylab bitta Lenis. GSAP ticker'idan yuradi — pin'lar bilan sinxron. */
export function silliqSkroll(): () => void {
  if (lenis || harakatKam()) return () => {}
  const l = new Lenis({ anchors: { offset: -80 }, lerp: 0.085, wheelMultiplier: 0.95, touchMultiplier: 1.3 })
  const qadam = (t: number) => l.raf(t * 1000)
  l.on('scroll', ScrollTrigger.update)
  gsap.ticker.add(qadam)
  gsap.ticker.lagSmoothing(0)
  lenis = l
  return () => {
    gsap.ticker.remove(qadam)
    l.destroy()
    lenis = null
  }
}

/** Skroll tezligi (px/kadr) — lenta tezlashishi uchun. Lenis bo'lmasa 0. */
export function skrollTezligi(): number {
  return lenis?.velocity ?? 0
}

/** Preloader tugaganini bildiradigan hodisa */
export const KIRISH_HODISA = 'wba-kirish'

export function kirishTayyor(): Promise<void> {
  if (document.documentElement.dataset.kirish === 'tayyor') return Promise.resolve()
  return new Promise((ok) => window.addEventListener(KIRISH_HODISA, () => ok(), { once: true }))
}

/** Oyna (modal) ochiq paytida sahifa skrolli to'xtaydi — fokus testdan "qochmasin" */
export function skrollQulf(qulf: boolean): void {
  if (qulf) lenis?.stop()
  else lenis?.start()
  document.documentElement.style.overflow = qulf ? 'hidden' : ''
}

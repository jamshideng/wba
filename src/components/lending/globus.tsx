'use client'

import { useEffect, useRef } from 'react'

/**
 * "So'zlar globusi": markazdagi tillar va fanlarning so'zlari shar sirtida
 * aylanadi (World Bridge — dunyo). Sichqoncha/barmoq bilan aylantirish mumkin.
 * Three.js'siz: har so'z oddiy <span>, 3D proyeksiya qo'lda hisoblanadi —
 * matn tiniq, telefonda ham yengil. Ekrandan chiqsa to'xtaydi.
 */

type Soz = { s: string; r: string; arab?: boolean; katta?: boolean }

const SOZLAR: Soz[] = [
  { s: 'Hello', r: 'var(--color-osmon)', katta: true },
  { s: 'Привет', r: 'var(--color-brand)', katta: true },
  { s: 'مرحبا', r: 'var(--color-accent)', arab: true, katta: true },
  { s: 'Merhaba', r: 'var(--color-firuza)', katta: true },
  { s: 'Salom', r: 'var(--color-ink)', katta: true },
  { s: 'π', r: 'var(--color-binafsha)', katta: true },
  { s: 'AI', r: 'var(--color-brand)', katta: true },
  { s: '</>', r: 'var(--color-osmon)' },
  { s: '?', r: 'var(--color-ok)', katta: true },
  { s: 'IELTS', r: 'var(--color-osmon)' },
  { s: 'DTM', r: 'var(--color-binafsha)' },
  { s: 'x²', r: 'var(--color-binafsha)' },
  { s: '√9 = 3', r: 'var(--color-binafsha)' },
  { s: 'ABC', r: 'var(--color-osmon)' },
  { s: 'Азбука', r: 'var(--color-brand)' },
  { s: 'ا ب ت', r: 'var(--color-accent)', arab: true },
  { s: 'Günaydın', r: 'var(--color-firuza)' },
  { s: 'Teşekkürler', r: 'var(--color-firuza)' },
  { s: 'Thank you', r: 'var(--color-osmon)' },
  { s: 'Спасибо', r: 'var(--color-brand)' },
  { s: 'شكرا', r: 'var(--color-accent)', arab: true },
  { s: 'Rahmat', r: 'var(--color-ink)' },
  { s: 'Nima uchun?', r: 'var(--color-ok)' },
  { s: '1 + 1', r: 'var(--color-ok)' },
  { s: 'Scratch', r: 'var(--color-accent)' },
  { s: 'HTML', r: 'var(--color-osmon)' },
  { s: 'Python', r: 'var(--color-firuza)' },
  { s: '∑', r: 'var(--color-binafsha)' },
  { s: 'Kitob', r: 'var(--color-ink)' },
  { s: 'Book', r: 'var(--color-osmon)' },
  { s: 'Книга', r: 'var(--color-brand)' },
  { s: 'Kitap', r: 'var(--color-firuza)' },
  { s: 'كتاب', r: 'var(--color-accent)', arab: true },
  { s: '%', r: 'var(--color-binafsha)' },
]

/** Fibonachchi shar — nuqtalar sirtda tekis taqsimlanadi */
const NUQTALAR = SOZLAR.map((_, i) => {
  const y = 1 - (2 * (i + 0.5)) / SOZLAR.length
  const r = Math.sqrt(1 - y * y)
  const t = i * Math.PI * (3 - Math.sqrt(5))
  return { x: Math.cos(t) * r, y, z: Math.sin(t) * r }
})

export function Globus() {
  const ildiz = useRef<HTMLDivElement>(null)
  const elementlar = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    const el = ildiz.current
    if (!el) return
    const kam = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Telefonda har kadrda blur chizish og'ir — faqat sichqonchali qurilmada
    const xiraOk = !window.matchMedia('(hover: none), (pointer: coarse)').matches

    let radius = el.clientWidth * 0.4
    let ax = -0.25
    let ay = 0
    let vx = 0
    let vy = 0.0045
    let tortish: { x: number; y: number } | null = null
    let korinadi = true
    let kadr = 0

    const chiz = () => {
      const cx = Math.cos(ax)
      const sx = Math.sin(ax)
      const cy = Math.cos(ay)
      const sy = Math.sin(ay)
      for (let i = 0; i < NUQTALAR.length; i++) {
        const s = elementlar.current[i]
        if (!s) continue
        const p = NUQTALAR[i]
        // Y o'qi atrofida, keyin X o'qi atrofida
        const x1 = p.x * cy + p.z * sy
        const z1 = -p.x * sy + p.z * cy
        const y2 = p.y * cx - z1 * sx
        const z2 = p.y * sx + z1 * cx
        const mashtab = 1.9 / (2.6 - z2) // perspektiva
        const chuqur = (z2 + 1) / 2 // 0 — orqada, 1 — oldinda
        s.style.transform = `translate3d(${(x1 * radius).toFixed(1)}px, ${(y2 * radius).toFixed(1)}px, 0) translate(-50%, -50%) scale(${mashtab.toFixed(3)})`
        s.style.opacity = (0.18 + chuqur * 0.82).toFixed(2)
        s.style.zIndex = String(Math.round(chuqur * 100))
        if (xiraOk) s.style.filter = chuqur < 0.35 ? `blur(${((0.35 - chuqur) * 6).toFixed(1)}px)` : ''
      }
    }

    const qadam = () => {
      if (!tortish) {
        ay += vy
        ax += vx
        vy += (0.0045 - vy) * 0.02 // asta-sekin odatiy tezlikka qaytadi
        vx *= 0.94
        ax += (-0.25 - ax) * 0.01
      }
      chiz()
      kadr = korinadi ? requestAnimationFrame(qadam) : 0
    }

    const olcham = new ResizeObserver(() => {
      radius = el.clientWidth * 0.4
      chiz()
    })
    olcham.observe(el)

    if (kam) {
      chiz()
      return () => olcham.disconnect()
    }

    const kuzat = new IntersectionObserver(([e]) => {
      korinadi = e.isIntersecting
      if (korinadi && !kadr) kadr = requestAnimationFrame(qadam)
    })
    kuzat.observe(el)

    const bos = (e: PointerEvent) => {
      tortish = { x: e.clientX, y: e.clientY }
      el.setPointerCapture(e.pointerId)
    }
    const sur = (e: PointerEvent) => {
      if (!tortish) return
      const dx = e.clientX - tortish.x
      const dy = e.clientY - tortish.y
      tortish = { x: e.clientX, y: e.clientY }
      vy = dx * 0.006
      vx = -dy * 0.004
      ay += vy
      ax = Math.max(-1.1, Math.min(1.1, ax + vx))
    }
    const qoyib = () => (tortish = null)
    el.addEventListener('pointerdown', bos)
    el.addEventListener('pointermove', sur)
    el.addEventListener('pointerup', qoyib)
    el.addEventListener('pointercancel', qoyib)

    kadr = requestAnimationFrame(qadam)
    return () => {
      cancelAnimationFrame(kadr)
      olcham.disconnect()
      kuzat.disconnect()
      el.removeEventListener('pointerdown', bos)
      el.removeEventListener('pointermove', sur)
      el.removeEventListener('pointerup', qoyib)
      el.removeEventListener('pointercancel', qoyib)
    }
  }, [])

  return (
    <div
      ref={ildiz}
      translate="no"
      data-kursor="Aylantiring"
      className="lb-globus relative aspect-square w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
    >
      <span className="sr-only">
        Markazda o‘qitiladigan tillar va fanlar: ingliz, rus, arab, turk tili, matematika, Pochemuchka, IT
      </span>
      {/* Markaziy shar va meridianlar */}
      <div aria-hidden="true" className="lb-shar absolute top-1/2 left-1/2 size-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
      <div aria-hidden="true" className="lb-meridian absolute top-1/2 left-1/2 size-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
      <div aria-hidden="true" className="lb-meridian lb-meridian-2 absolute top-1/2 left-1/2 size-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full" />

      <div aria-hidden="true" className="absolute top-1/2 left-1/2">
        {SOZLAR.map((v, i) => (
          <span
            key={v.s}
            ref={(n) => {
              elementlar.current[i] = n
            }}
            dir={v.arab ? 'rtl' : undefined}
            className={`absolute top-0 left-0 whitespace-nowrap will-change-transform ${
              v.arab ? 'lb-arab' : 'h-display'
            } ${v.katta ? 'text-[30px] sm:text-[38px]' : 'text-[17px] sm:text-[21px]'}`}
            style={{ color: v.r }}
          >
            {v.s}
          </span>
        ))}
      </div>
    </div>
  )
}

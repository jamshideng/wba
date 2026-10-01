/**
 * Grafik ranglari — globals.css tokenlari (yorug'/qorong'i temada o'zi moslashadi).
 * Alohida fayl: 'use client' modulidagi konstanta server komponentiga
 * qiymat bo'lib emas, havola bo'lib keladi — shuning uchun bu yerda.
 */
export const RANG = {
  brand: 'var(--color-brand)',
  accent: 'var(--color-accent)',
  ok: 'var(--color-ok)',
  ink3: 'var(--color-ink-3)',
  line: 'var(--color-line)',
} as const

/** Ketma-ket qatorlar uchun ranglar (donut, bir nechta seriya) */
export const SERIYA = ['var(--color-brand)', 'var(--color-accent)', 'var(--color-ok)', '#6d7cff', '#b46bd6', 'var(--color-ink-3)']

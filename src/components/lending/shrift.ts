import { Noto_Naskh_Arabic } from 'next/font/google'

/** Arab yozuvi uchun shrift — faqat bosh sahifada ("مرحبا", "ع"). */
export const arabShrift = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['700'],
  variable: '--font-arab',
  display: 'swap',
})

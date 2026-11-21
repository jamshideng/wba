import type { MetadataRoute } from 'next'

import { YONALISHLAR, saytManzil } from '@/lib/markaz'
import { ommaviyUstozlar } from '@/lib/ustoz-ommaviy'

const SAYT = saytManzil()

/* Ustozlar ro'yxati sahifalar bilan bir xil davrda yangilansin */
export const revalidate = 300

/** Ommaviy sahifalar, kurslar va saytda ko'rsatilgan ustozlar. CRM ichki tizim — kiritilmaydi. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const bugun = new Date()
  // Baza ulanmagan yoki xato bersa ommaviyUstozlar() [] qaytaradi — sitemap baribir chiqadi
  const ustozlar = await ommaviyUstozlar()
  return [
    { url: `${SAYT}/`, lastModified: bugun, changeFrequency: 'weekly', priority: 1 },
    { url: `${SAYT}/ariza`, lastModified: bugun, changeFrequency: 'monthly', priority: 0.8 },
    ...YONALISHLAR.map((y) => ({
      url: `${SAYT}/kurslar/${y.id}`,
      lastModified: bugun,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
    ...ustozlar
      .filter((u) => u.slug)
      .map((u) => ({
        url: `${SAYT}/ustozlar/${encodeURIComponent(u.slug)}`,
        lastModified: bugun,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      })),
  ]
}

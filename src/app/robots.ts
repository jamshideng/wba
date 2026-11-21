import type { MetadataRoute } from 'next'

import { saytManzil } from '@/lib/markaz'

const SAYT = saytManzil()

/**
 * CRM qidiruvga tushmasin, ommaviy sayt tushsin. AI-qidiruv botlari
 * (GPTBot, PerplexityBot, Google-Extended) ham '*' ostida — GEO uchun ataylab ochiq.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/crm', '/kirish', '/api'],
    },
    sitemap: `${SAYT}/sitemap.xml`,
  }
}

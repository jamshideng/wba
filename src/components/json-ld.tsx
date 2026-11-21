import { jsonLdMatn } from '@/lib/seo'

/**
 * schema.org ma'lumoti. type="application/ld+json" brauzerda bajarilmaydi,
 * shuning uchun CSP script-src ga ta'sir qilmaydi.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdMatn(data) }} />
}

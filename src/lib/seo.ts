/**
 * SEO / GEO: qidiruv tizimlari va AI-qidiruv (ChatGPT, Perplexity, Google AI)
 * uchun mashina o'qiydigan ma'lumot — schema.org JSON-LD va llms.txt.
 *
 * Faqat markaz.ts va savollar.ts dagi rost faktlar ishlatiladi: qidiruvga
 * noto'g'ri narx yoki ish vaqti tushsa, uni tuzatish qiyin. Ish vaqti
 * (openingHours) ataylab yo'q — qabulxona vaqti aniq emas.
 */
import { MARKAZ, NARX, YONALISHLAR, saytManzil, type Yonalish } from '@/lib/markaz'
import { SAVOLLAR } from '@/lib/savollar'

type JsonLd = Record<string, unknown>

const TASHKILOT_ID = '#tashkilot'

function tashkilotId(sayt: string): string {
  return `${sayt}/${TASHKILOT_ID}`
}

/** Markaz: o'quv tashkiloti + mahalliy biznes (Google xaritadagi kartochka uchun). */
export function tashkilotSchema(sayt = saytManzil()): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': ['EducationalOrganization', 'LocalBusiness'],
    '@id': tashkilotId(sayt),
    name: MARKAZ.nom,
    alternateName: MARKAZ.qisqa,
    url: `${sayt}/`,
    logo: `${sayt}/ikonka-512.png`,
    image: `${sayt}/opengraph-image`,
    foundingDate: String(MARKAZ.tashkilYili),
    telephone: MARKAZ.telefonRaw,
    priceRange: `${NARX.tanishuvOyi}–${NARX.standart} UZS`,
    currenciesAccepted: 'UZS',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'N. Ibragimov ko‘chasi, 4-uy',
      addressLocality: 'Toshkent',
      addressCountry: 'UZ',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: MARKAZ.koordinata.kenglik,
      longitude: MARKAZ.koordinata.uzunlik,
    },
    hasMap: `https://www.google.com/maps?q=${MARKAZ.koordinata.kenglik},${MARKAZ.koordinata.uzunlik}`,
    areaServed: { '@type': 'City', name: 'Toshkent' },
    sameAs: [MARKAZ.telegram, MARKAZ.instagram],
    knowsLanguage: ['uz', 'ru', 'en'],
  }
}

/** Kurs sahifasi sarlavhasi — odamlar qidiradigan shaklda: "Ingliz tili kurslari Toshkentda". */
export function kursSarlavha(y: Pick<Yonalish, 'id' | 'nom' | 'yorliq'>): string {
  if (y.id === 'pochemuchka') return `Почемучка — maktabga tayyorlov Toshkentda`
  return `${y.nom} kurslari Toshkentda`
}

function kursObyekt(y: Yonalish, sayt: string): JsonLd {
  return {
    '@type': 'Course',
    name: kursSarlavha(y),
    description: `${y.qisqa_tavsif} Kimlar uchun: ${y.yosh_chegarasi}.`,
    url: `${sayt}/kurslar/${y.id}`,
    inLanguage: 'uz',
    provider: { '@id': tashkilotId(sayt) },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'Onsite',
      location: { '@id': tashkilotId(sayt) },
      courseSchedule: {
        '@type': 'Schedule',
        repeatFrequency: 'P1W',
        repeatCount: MARKAZ.darsHaftada,
        duration: `PT${MARKAZ.darsDaqiqa}M`,
      },
    },
    offers: {
      '@type': 'Offer',
      category: 'Subscription',
      price: NARX.standart,
      priceCurrency: 'UZS',
    },
  }
}

/** Bitta kurs sahifasi uchun. Tashkilot ham shu yerda — @id havolasi sahifa ichida yechilsin. */
export function kursSchema(y: Yonalish, sayt = saytManzil()): JsonLd[] {
  return [tashkilotSchema(sayt), { '@context': 'https://schema.org', ...kursObyekt(y, sayt) }]
}

/** Kurslar ro'yxati — har yo'nalish alohida Course, o'z sahifasiga havola bilan. */
export function kurslarSchema(sayt = saytManzil()): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${MARKAZ.nom} kurslari`,
    itemListElement: YONALISHLAR.map((y, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: kursObyekt(y, sayt),
    })),
  }
}

/** Non-kroshka (BreadcrumbList) — Google natijada manzil o'rniga yo'lni ko'rsatadi. */
export function nonKroshkaSchema(qadamlar: { nom: string; yol: string }[], sayt = saytManzil()): JsonLd {
  const hammasi = [{ nom: 'Bosh sahifa', yol: '/' }, ...qadamlar]
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: hammasi.map((q, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: q.nom,
      item: `${sayt}${q.yol}`,
    })),
  }
}

/** Ko'p so'raladigan savollar — lendingdagi blok bilan bir xil matn. */
export function savollarSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: SAVOLLAR.map((v) => ({
      '@type': 'Question',
      name: v.s,
      acceptedAnswer: { '@type': 'Answer', text: v.j },
    })),
  }
}

/** Ustoz sahifasi — Person, markazga bog'langan. */
export function ustozSchema(
  u: { ism: string; slug: string; fanlar?: string[] | null; rasm?: string | null },
  sayt = saytManzil(),
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: u.ism,
    url: `${sayt}/ustozlar/${encodeURIComponent(u.slug)}`,
    jobTitle: 'Ustoz',
    worksFor: { '@id': tashkilotId(sayt) },
    ...(u.fanlar?.length ? { knowsAbout: u.fanlar } : {}),
    ...(u.rasm ? { image: u.rasm } : {}),
  }
}

/**
 * <script type="application/ld+json"> ichiga xavfsiz joylash: matnda
 * "</script>" bo'lsa ham teg yopilib qolmasin (< ni unicode-escape).
 */
export function jsonLdMatn(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

function somFormat(n: number): string {
  return n.toLocaleString('ru-RU').replace(/ /g, ' ')
}

/**
 * llms.txt (llmstxt.org) — AI-qidiruv markaz haqida qisqa, aniq faktni
 * HTML va animatsiyalarsiz o'qisin. Ma'lumot markaz.ts dan yig'iladi,
 * shuning uchun narx yoki telefon o'zgarsa bu ham o'zi yangilanadi.
 */
export function llmsMatn(sayt = saytManzil()): string {
  const kurslar = YONALISHLAR.map((y) => `- [${y.nom}](${sayt}/kurslar/${y.id}) (${y.yosh_chegarasi}): ${y.qisqa_tavsif}`).join('\n')
  const savollar = SAVOLLAR.map((v) => `### ${v.s}\n${v.j}`).join('\n\n')
  return `# ${MARKAZ.nom}

> ${MARKAZ.nom} (${MARKAZ.qisqa}) — Toshkentdagi o‘quv markazi, ${MARKAZ.tashkilYili} yildan beri. Tillar, matematika, maktabga tayyorlov va IT. Guruhda ${MARKAZ.guruhMaksimal} kishidan ortiq emas, birinchi dars va daraja aniqlash bepul.

## Asosiy faktlar
- Manzil: ${MARKAZ.manzil}. Mo‘ljal: ${MARKAZ.moljal}
- Koordinata: ${MARKAZ.koordinata.kenglik}, ${MARKAZ.koordinata.uzunlik}
- Telefon: ${MARKAZ.telefon}
- Telegram: ${MARKAZ.telegram}
- Instagram: ${MARKAZ.instagram}
- Dars tartibi: haftada ${MARKAZ.darsHaftada} kun ustoz bilan (${MARKAZ.darsDaqiqa} daqiqa) + ${MARKAZ.supportHaftada} kun support teacher bilan amaliyot. Darslar 08:00–21:00.
- Narx: oyiga ${somFormat(NARX.standart)} so‘m; birinchi (tanishuv) oyi ${somFormat(NARX.tanishuvOyi)} so‘m; 3 oylik ${somFormat(NARX.uchOylik)} so‘m.

## Kurslar
${kurslar}

## Sahifalar
- [Bosh sahifa](${sayt}/): kurslar, jadval, narxlar, ustozlar, savollar, aloqa
- [Bepul sinov darsiga yozilish](${sayt}/ariza): ism va telefon qoldiriladi, bir ish kuni ichida qo‘ng‘iroq qilinadi

## Ko‘p so‘raladigan savollar
${savollar}
`
}

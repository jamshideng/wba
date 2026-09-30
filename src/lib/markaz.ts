/**
 * Markaz haqidagi faktlar — hammasi WBA sotuv skriptidan olingan.
 *
 * Bu qiymatlar bazadagi `settings` va `subjects` jadvallariga ham yozilgan
 * (0004_seed.sql). Supabase hali ulanmagan bo'lsa, sayt shulardan chizadi.
 * Baza ulangach — `settings` ustunroq turadi.
 */

/**
 * Saytning bazaviy manzili. NEXT_PUBLIC_SITE_URL noto'g'ri bo'lsa ham
 * (masalan bo'sh yoki buzuq qiymat) qurilish yiqilmasin: `new URL()`
 * xato tashlaydi, shuning uchun tekshirib, kerak bo'lsa zaxiraga tushamiz.
 */
export function saytManzil(): string {
  const xom = process.env.NEXT_PUBLIC_SITE_URL
  if (xom) {
    try {
      return new URL(xom).origin
    } catch {
      // noto'g'ri qiymat — zaxiraga o'tamiz
    }
  }
  return 'https://wbalc.uz'
}

export const MARKAZ = {
  nom: 'World Bridge Academy',
  qisqa: 'WBA',
  tashkilYili: 2018,
  telefon: '+998 99 009 90 05',
  telefonRaw: '+998990099005',
  telegram: 'https://t.me/WBA_LC',
  telegramNom: 't.me/WBA_LC',
  instagram: 'https://instagram.com/wba_lc',
  instagramNom: '@wba_lc',
  manzil: 'Toshkent, N. Ibragimov ko‘chasi, 4-uy',
  moljal:
    'Bahor to‘yxonasidan 91–95 avtobus bilan konechka bekatiga qarab yurasiz — o‘ng qo‘lda.',
  guruhMaksimal: 12,
  darsHaftada: 3,
  darsDaqiqa: 90,
} as const

export const NARX = {
  tanishuvOyi: 550_000,
  standart: 650_000,
  uchOylik: 1_650_000,
  uchOylikAsl: 1_950_000,
} as const

/** 0004_seed.sql dagi `subjects` bilan bir xil. Baza ulanmaganda ishlatiladi. */
export const YONALISHLAR = [
  {
    id: 'ingliz-tili',
    nom: 'Ingliz tili',
    yorliq: '7 bosqich',
    qisqa_tavsif:
      'Starter, Beginner, Elementary, Pre-Intermediate, Intermediate, Pre-IELTS, IELTS.',
    yosh_chegarasi: 'bolalar va kattalar',
  },
  {
    id: 'rus-tili',
    nom: 'Rus tili',
    yorliq: 'alifbodan',
    qisqa_tavsif: 'Noldan, harflardan boshlanadi. Avval o‘qish va yozish, keyin gapirish.',
    yosh_chegarasi: 'bolalar va kattalar',
  },
  {
    id: 'arab-tili',
    nom: 'Arab tili',
    yorliq: 'alifbodan',
    qisqa_tavsif: 'Harflarni tanishdan boshlab, matnni mustaqil o‘qiy olishgacha.',
    yosh_chegarasi: 'bolalar va kattalar',
  },
  {
    id: 'matematika',
    nom: 'Matematika',
    yorliq: '3 yo‘nalish',
    qisqa_tavsif: 'Maktab dasturi, Milliy sertifikat va DTM — maqsadga qarab alohida yo‘l.',
    yosh_chegarasi: '5 yoshdan 11-sinfgacha',
  },
  {
    id: 'pochemuchka',
    nom: 'Pochemuchka',
    yorliq: 'maktabga tayyorlov',
    qisqa_tavsif: 'O‘yin shaklida: harf, son, diqqat va nutq.',
    yosh_chegarasi: '4–6 yosh',
  },
  {
    id: 'ai-it',
    nom: 'AI & IT',
    yorliq: 'amaliy',
    qisqa_tavsif:
      'Sun‘iy intellekt, avtomatlashtirish, vibe-coding. Kompyuteri yo‘qqa markaz beradi.',
    yosh_chegarasi: 'yosh chegarasi yo‘q',
  },
  {
    id: 'web-dasturlash',
    nom: 'Web dasturlash',
    yorliq: 'noldan',
    qisqa_tavsif: 'HTML, CSS va JavaScript — birinchi darsdanoq o‘z sahifangizni yasaysiz.',
    yosh_chegarasi: 'yosh chegarasi yo‘q',
  },
  {
    id: 'scratch',
    nom: 'Scratch',
    yorliq: 'o‘yin orqali',
    qisqa_tavsif: 'O‘yin va multfilm yaratish orqali dasturlash mantiqini tushunish.',
    yosh_chegarasi: '16 yoshgacha',
  },
] as const

export type Yonalish = (typeof YONALISHLAR)[number]

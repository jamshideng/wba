import { MARKAZ } from '@/lib/markaz'

/**
 * Ko'p so'raladigan savollar — lendingdagi blok va FAQPage (JSON-LD) bitta
 * manbadan oladi, matn ikki joyda ajralib ketmasin. Javoblar — faqat markaz.ts va sotuv skriptidagi
 * rost ma'lumotdan (taxminiy raqam yo'q). <details> — JS'siz ochiladi.
 */
export const SAVOLLAR: { s: string; j: string }[] = [
  {
    s: 'Birinchi dars haqiqatan bepulmi?',
    j: 'Ha. Sinov darsi va daraja aniqlash bepul. To‘lov — dars yoqib, davom etishga qaror qilganingizdan keyin.',
  },
  {
    s: '3 + 3 nima degani?',
    j: `Haftada ${MARKAZ.darsHaftada} kun ustoz bilan asosiy dars (${MARKAZ.darsDaqiqa} daqiqadan), qolgan ${MARKAZ.supportHaftada} kun support teacher bilan vazifa va amaliyot. Darslar 08:00 dan 21:00 gacha.`,
  },
  {
    s: 'Guruhda nechta o‘quvchi bo‘ladi?',
    j: `Standart guruh — ${MARKAZ.guruhMaksimal} kishigacha, hech qachon oshmaydi. Mini guruh — 2 kishi, VIP — yakka.`,
  },
  {
    s: 'Qaysi yoshdan qabul qilasiz?',
    j: 'Почемучка — 4–6 yosh. Matematika — 5 yoshdan 11-sinfgacha. Tillar — bolalar va kattalar. AI & IT va Web’da yosh chegarasi yo‘q.',
  },
  {
    s: 'Chegirmalar bormi?',
    j: 'Bor: ikki fanga yozilganda yoki aka-uka, do‘st bilan kelganda. Miqdorini qo‘ng‘iroqda aytamiz.',
  },
]

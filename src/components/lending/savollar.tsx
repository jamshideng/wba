import { MARKAZ } from '@/lib/markaz'

/**
 * Ko'p so'raladigan savollar. Javoblar — faqat markaz.ts va sotuv skriptidagi
 * rost ma'lumotdan (taxminiy raqam yo'q). <details> — JS'siz ochiladi.
 */
const SAVOLLAR: { s: string; j: string }[] = [
  {
    s: 'Birinchi dars haqiqatan bepulmi?',
    j: 'Ha. Sinov darsi va daraja aniqlash bepul. To‘lov faqat dars yoqib, davom etishga qaror qilganingizdan keyin.',
  },
  {
    s: 'Guruhda nechta o‘quvchi bo‘ladi?',
    j: `Standart guruh — 10–${MARKAZ.guruhMaksimal} kishi va hech qachon ${MARKAZ.guruhMaksimal} tadan oshmaydi. Mini guruh — 2 kishi, VIP — yakka tartibda.`,
  },
  {
    s: 'Darslar qachon va qancha davom etadi?',
    j: `Haftada ${MARKAZ.darsHaftada} marta, har biri ${MARKAZ.darsDaqiqa} daqiqa. Toq kunlar (Du, Chor, Ju), juft kunlar (Se, Pay, Sha) yoki dam olish kunlari — ertalab 08:00 dan kechqurun 21:00 gacha.`,
  },
  {
    s: 'Qaysi yoshdan qabul qilasiz?',
    j: 'Почемучка — 4–6 yosh (maktabga tayyorlov). Matematika — 5 yoshdan 11-sinfgacha. Tillar — bolalar va kattalar uchun. AI & IT va Web dasturlashda yosh chegarasi yo‘q.',
  },
  {
    s: 'Kompyuterim yo‘q — AI & IT kursiga bora olamanmi?',
    j: 'Ha. Kompyuteri yo‘q o‘quvchiga darsda markaz kompyuter beradi.',
  },
  {
    s: 'Natijani qanday kuzataman?',
    j: 'Har dars davomat va faollik belgilanadi — bularni shaxsiy sahifada ko‘rib borasiz. Kursni tugatganda markaz sertifikati beriladi.',
  },
  {
    s: 'Chegirmalar bormi?',
    j: 'Bor: ikki va undan ortiq fanga yozilganda, shuningdek aka-uka, opa-singil yoki do‘st bilan birga kelganda. Miqdorini qo‘ng‘iroq paytida aytamiz.',
  },
  {
    s: 'Qanday yozilaman?',
    j: `Saytda ariza qoldiring — bir ish kuni ichida qo‘ng‘iroq qilamiz. Yoki o‘zingiz qo‘ng‘iroq qiling: ${MARKAZ.telefon}, yoki Telegram: @WBA_LC.`,
  },
]

export function Savollar() {
  return (
    <div className="flex flex-col border-t border-line">
      {SAVOLLAR.map((v, i) => (
        <details key={v.s} name="savol" className="lb-savol-blok group border-b border-line" data-ochil={i * 0.03}>
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-5 [&::-webkit-details-marker]:hidden">
            <span className="flex items-baseline gap-4 sm:gap-6">
              <span className="font-[family-name:var(--font-mono)] text-[12.5px] text-ink-3 tnum">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-[17px] font-bold leading-snug sm:text-[21px]">{v.s}</span>
            </span>
            <span
              aria-hidden="true"
              className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-line transition group-open:rotate-45 group-open:border-brand group-open:bg-brand group-open:text-white"
            >
              <span className="absolute h-[1.5px] w-3.5 bg-current" />
              <span className="absolute h-3.5 w-[1.5px] bg-current" />
            </span>
          </summary>
          <p className="max-w-[70ch] pb-6 pl-[calc(12.5px*2+1rem)] text-[15.5px] leading-relaxed text-ink-2 sm:pl-[calc(12.5px*2+1.5rem)]">
            {v.j}
          </p>
        </details>
      ))}
    </div>
  )
}

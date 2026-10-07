import Link from 'next/link'
import { MARKAZ, YONALISHLAR } from '@/lib/markaz'
import { IconPhone, IconPin, IconSend } from '@/components/icons'
import { RaqamSanagich } from '@/components/raqam-sanagich'
import { Harakat } from '@/components/lending/harakat'
import { Preloader } from '@/components/lending/preloader'
import { Globus } from '@/components/lending/globus'
import { FanAylanma } from '@/components/lending/fan-aylanma'
import { TezlikLenta } from '@/components/lending/tezlik-lenta'
import { Kurslar } from '@/components/lending/kurslar'
import { Qadamlar } from '@/components/lending/qadamlar'
import { Sozlab } from '@/components/lending/sozlab'
import { arabShrift } from '@/components/lending/shrift'
import { TestOyna } from '@/components/lending/test-oyna'
import { VaqtTanlash } from '@/components/lending/vaqt-tanlash'
import { Odamlar } from '@/components/lending/odamlar'
import { Narx } from '@/components/lending/narx'
import { Savollar } from '@/components/lending/savollar'
import './lending.css'

export const metadata = { alternates: { canonical: '/' } }

/** Asosiy tugma — sahifada bir necha joyda */
function YozilishTugma({ katta = false, oq = false }: { katta?: boolean; oq?: boolean }) {
  return (
    <Link
      href="/ariza"
      className={`sayt-tugma group inline-flex items-center justify-center gap-3 rounded-full font-bold transition hover:scale-[1.03] ${
        katta ? 'min-h-16 pr-2.5 pl-6 text-[15.5px] whitespace-nowrap sm:pl-8 sm:text-[17px]' : 'min-h-14 pr-2 pl-7 text-[15.5px] whitespace-nowrap'
      } ${oq ? 'bg-white text-brand' : 'bg-brand text-white shadow-[0_18px_40px_-14px_var(--color-brand)]'}`}
    >
      Bepul sinov darsiga yozilish
      <span
        aria-hidden="true"
        className={`flex items-center justify-center rounded-full transition group-hover:translate-x-0.5 ${
          katta ? 'size-11' : 'size-10'
        } ${oq ? 'bg-brand text-white' : 'bg-white text-brand'}`}
      >
        →
      </span>
    </Link>
  )
}

function Sarlavha({ yorliq, matn, izoh }: { yorliq: string; matn: string; izoh?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
      <div className="flex flex-col gap-4">
        <p className="lbl text-brand" data-ochil>
          {yorliq}
        </p>
        <h2 data-sozlab className="h-display max-w-[14ch] text-[42px] leading-[0.95] sm:text-[68px]">
          <Sozlab matn={matn} />
        </h2>
      </div>
      {izoh && (
        <p data-ochil="0.1" className="max-w-[400px] text-[16px] leading-relaxed text-ink-2 text-pretty lg:text-right">
          {izoh}
        </p>
      )}
    </div>
  )
}

export default function Bosh() {
  const yil = new Date().getFullYear() - MARKAZ.tashkilYili

  return (
    <main className={`${arabShrift.variable} overflow-x-clip pb-24 sm:pb-0`}>
      <Preloader />
      <Harakat />

      {/* ================= Hero ================= */}
      <section className="relative isolate">
        <div className="lb-fon" aria-hidden="true" />
        <div className="mx-auto grid max-w-[1320px] items-center gap-4 px-5 pt-7 pb-6 sm:pt-10 lg:min-h-[calc(100svh-70px)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10 lg:px-8 lg:pb-12">
          <div className="flex flex-col gap-6 sm:gap-7">
            <p
              data-hero
              className="inline-flex w-fit items-center gap-2.5 rounded-full border border-line bg-surface/70 px-4 py-2 text-[13.5px] font-semibold text-ink-2 backdrop-blur"
            >
              <span className="lb-nuqta" aria-hidden="true" />
              Toshkent · {MARKAZ.tashkilYili} yildan beri · qabul ochiq
            </p>

            <h1 className="h-display text-[40px] leading-[0.96] text-balance sm:text-[64px] lg:text-[70px] xl:text-[76px]" data-hero-soz>
              <Sozlab matn="Biz shunchaki bilim bermaymiz —" />
              <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                <span className="lb-w inline-block text-brand">hayotlarni</span>
              </span>{' '}
              <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                <span className="lb-w inline-block text-brand">o‘zgartiramiz</span>
              </span>
            </h1>

            <p data-hero className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[19px] font-semibold sm:text-[24px]">
              <span className="text-ink-2">Bu yerda o‘rganasiz:</span>
              <FanAylanma />
            </p>

            <p data-hero className="max-w-[560px] text-[16.5px] leading-relaxed text-ink-2 text-pretty sm:text-[18px]">
              Bitta markazda — tillar, aniq fanlar va IT. Bir guruhda{' '}
              <b className="font-bold text-ink">{MARKAZ.guruhMaksimal} kishidan ortiq emas</b>, haftada{' '}
              {MARKAZ.darsHaftada} marta, {MARKAZ.darsDaqiqa} daqiqadan.
            </p>

            <div data-hero className="grid gap-3 sm:flex sm:flex-wrap sm:items-center">
              <YozilishTugma />
              <a
                href="#kurslar"
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-line px-7 text-[15px] font-bold text-ink transition hover:border-ink"
              >
                Kurslarni ko‘rish
              </a>
            </div>

            <ul data-hero className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] font-medium text-ink-2">
              {['Birinchi dars bepul', 'Daraja aniqlash bepul', 'Oldindan to‘lov yo‘q'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8.4l3 2.9 7-7" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div data-hero className="relative mx-auto w-full max-w-[340px] sm:max-w-[520px] lg:max-w-[600px]">
            <Globus />
            <p className="lbl -mt-2 text-center text-ink-3">Aylantirib ko‘ring</p>
          </div>
        </div>
      </section>

      <TezlikLenta />

      <div className="mx-auto max-w-[1320px] px-5 lg:px-8">
        {/* ================= Faktlar ================= */}
        <section aria-label="Raqamlarda" className="grid grid-cols-2 border-b border-line lg:grid-cols-4">
          {[
            { n: yil, oxiri: '+', t: 'yil tajriba', izoh: `${MARKAZ.tashkilYili} yildan beri Toshkentda` },
            { n: YONALISHLAR.length, t: 'yo‘nalish', izoh: 'tillar, aniq fanlar va IT' },
            { n: MARKAZ.guruhMaksimal, t: 'kishi — guruhda eng ko‘pi', izoh: 'ustoz har biriga yetadi', brand: true },
            { n: 0, t: 'so‘m — birinchi dars', izoh: 'avval ko‘rasiz, keyin qaror' },
          ].map((f, i) => (
            <div
              key={f.t}
              data-ochil={i * 0.06}
              className={`flex flex-col gap-1.5 py-7 sm:py-10 ${i % 2 === 1 ? 'border-l border-line pl-5 sm:pl-8' : 'pr-5'} ${
                i === 2 ? 'border-t border-line lg:border-t-0 lg:border-l lg:pl-8' : ''
              } ${i === 3 ? 'border-t border-line lg:border-t-0' : ''}`}
            >
              <span className={`h-display text-[52px] leading-none sm:text-[76px] ${f.brand ? 'text-brand' : ''}`}>
                <RaqamSanagich qiymat={f.n} />
                {f.oxiri}
              </span>
              <span className="text-[14.5px] font-bold">{f.t}</span>
              <span className="text-[13px] text-ink-3">{f.izoh}</span>
            </div>
          ))}
        </section>

        {/* ================= Kurslar ================= */}
        <section id="kurslar" className="flex flex-col gap-8 py-14 sm:gap-10 sm:py-20">
          <Sarlavha
            yorliq="Yo‘nalishlar"
            matn="Har yoshga — o‘z yo‘li"
            izoh="Yoshni tanlang — mos kurslar ajralib turadi. Kartani bossangiz, ariza shu kurs bilan ochiladi."
          />
          <Kurslar />
        </section>

        {/* ================= Mini-test ================= */}
        <section id="test" className="grid gap-8 py-14 sm:py-20 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-14">
          <div className="flex flex-col gap-4">
            <p className="lbl text-brand" data-ochil>
              Ingliz tili · 1 daqiqa
            </p>
            <h2 data-sozlab className="h-display text-[42px] leading-[0.95] sm:text-[64px]">
              <Sozlab matn="Darajangizni hoziroq bilib oling" />
            </h2>
            <p data-ochil="0.1" className="max-w-[420px] text-[16px] leading-relaxed text-ink-2">
              8 ta savol, osondan qiyinga. Test alohida oynada ochiladi — hech narsa yuborilmaydi. Natija taxminiy, aniq
              darajani markazda bepul aniqlaymiz.
            </p>
          </div>
          <div data-ochil="0.1">
            <TestOyna />
          </div>
        </section>
      </div>

      {/* ================= Qadamlar (gorizontal) ================= */}
      <Qadamlar />

      <div className="mx-auto max-w-[1320px] px-5 lg:px-8">
        {/* ================= Qulay vaqt ================= */}
        <section id="jadval" className="flex flex-col gap-8 py-14 sm:gap-10 sm:py-20">
          <Sarlavha
            yorliq="Dars vaqti"
            matn="O‘zingizga qulay vaqtni tanlang"
            izoh="Kunlar va vaqtni belgilang — mos guruhni o‘zimiz topamiz. Tanlov ariza bilan birga keladi."
          />
          <div data-ochil>
            <VaqtTanlash />
          </div>
        </section>

        {/* ================= Format ================= */}
        <section id="dars" className="flex flex-col gap-8 py-14 sm:gap-10 sm:py-20">
          <Sarlavha
            yorliq="Dars formati"
            matn="Kichik guruh — katta natija"
            izoh={`Haftada ${MARKAZ.darsHaftada} marta, ${MARKAZ.darsDaqiqa} daqiqadan. Guruh hajmini o‘zingiz tanlaysiz.`}
          />

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { nom: 'VIP', son: 1, t: 'Butun dars faqat sizga. Eng tez natija.' },
              { nom: 'Mini guruh', son: 2, t: 'Ikki kishi — suhbatdosh ham bor, e‘tibor ham yetarli.' },
              {
                nom: 'Standart guruh',
                son: MARKAZ.guruhMaksimal,
                t: `10–${MARKAZ.guruhMaksimal} kishi. Hech qachon ${MARKAZ.guruhMaksimal} tadan oshmaydi — bu qat‘iy qoida.`,
              },
            ].map((g, i) => (
              <article
                key={g.nom}
                data-ochil={i * 0.08}
                className="sayt-karta flex flex-col gap-6 rounded-[26px] border border-line bg-surface p-7"
              >
                <div className="flex h-[96px] items-end">
                  <Odamlar son={g.son} />
                </div>
                <div className="flex flex-col gap-2">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="h-display text-[28px]">{g.nom}</span>
                    <span className="lbl">
                      {g.son === 1 ? '1 kishi' : g.son === 2 ? '2 kishi' : `${MARKAZ.guruhMaksimal} gacha`}
                    </span>
                  </p>
                  <p className="text-[14.5px] leading-relaxed text-ink-2">{g.t}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ================= Narxlar ================= */}
        <section id="narxlar" className="flex flex-col gap-8 py-14 sm:gap-10 sm:py-20">
          <Sarlavha
            yorliq="Narxlar"
            matn="Avval darsni ko‘rasiz, keyin to‘laysiz"
            izoh="Boshlash — bepul. Keyingi oylar narxini bir tugma bilan ko‘ring."
          />
          <div data-ochil>
            <Narx />
          </div>
        </section>

        {/* ================= Savollar ================= */}
        <section id="savollar" className="grid gap-8 py-14 sm:py-20 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-14">
          <div className="flex flex-col gap-4 lg:sticky lg:top-28 lg:self-start">
            <p className="lbl text-brand" data-ochil>
              Savollar
            </p>
            <h2 data-sozlab className="h-display text-[42px] leading-[0.95] sm:text-[64px]">
              <Sozlab matn="Ko‘p so‘raladigan savollar" />
            </h2>
            <p data-ochil="0.1" className="max-w-[360px] text-[16px] leading-relaxed text-ink-2">
              Javob topilmadimi? Qo‘ng‘iroq qiling yoki Telegram’da yozing — tezda javob beramiz.
            </p>
          </div>
          <Savollar />
        </section>

        {/* ================= Aloqa ================= */}
        <section id="aloqa" className="py-12">
          <div data-ochil className="grid overflow-hidden rounded-[30px] border border-line bg-surface lg:grid-cols-2">
            <div className="flex flex-col gap-7 p-7 sm:p-10">
              <div className="flex flex-col gap-3">
                <p className="lbl text-brand">Manzil</p>
                <h2 className="h-display text-[34px] leading-tight sm:text-[44px]">N. Ibragimov ko‘chasi, 4-uy</h2>
              </div>
              <p className="flex items-start gap-3.5">
                <span className="mt-0.5 shrink-0 text-brand">
                  <IconPin size={20} />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-[14px] font-semibold">Qanday topasiz</span>
                  <span className="text-[14px] leading-relaxed text-ink-2">{MARKAZ.moljal}</span>
                </span>
              </p>

              <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
                {[
                  { href: `tel:${MARKAZ.telefonRaw}`, nom: 'Qo‘ng‘iroq', qiymat: MARKAZ.telefon, ikonka: <IconPhone size={20} /> },
                  { href: MARKAZ.telegram, nom: 'Telegram', qiymat: '@WBA_LC', ikonka: <IconSend size={20} /> },
                  { href: MARKAZ.instagram, nom: 'Instagram', qiymat: MARKAZ.instagramNom, ikonka: <InstagramBelgi /> },
                ].map((a) => (
                  <a
                    key={a.nom}
                    href={a.href}
                    {...(a.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="group flex min-h-11 items-center gap-3.5 rounded-[18px] border border-line bg-surface-2 p-3.5 transition hover:border-ink sm:flex-col sm:items-start sm:gap-2.5 sm:p-4"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-bg transition group-hover:bg-brand group-hover:text-white">
                      {a.ikonka}
                    </span>
                    <span className="flex flex-col gap-0.5 sm:gap-2.5">
                      <span className="text-[13px] text-ink-3">{a.nom}</span>
                      <span className="font-[family-name:var(--font-mono)] text-[13.5px] break-all text-ink">{a.qiymat}</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>

            <div className="relative min-h-[340px] border-line max-lg:border-t lg:border-l">
              <iframe
                src={`https://yandex.uz/map-widget/v1/?ll=${MARKAZ.koordinata.uzunlik}%2C${MARKAZ.koordinata.kenglik}&z=17&pt=${MARKAZ.koordinata.uzunlik}%2C${MARKAZ.koordinata.kenglik}%2Cpm2rdl&lang=uz_UZ`}
                title={`Xarita: ${MARKAZ.manzil}`}
                loading="lazy"
                allowFullScreen
                className="absolute inset-0 size-full border-0"
              />
            </div>
          </div>
        </section>

        {/* ================= Yakuniy chaqiriq ================= */}
        <section className="pt-6 pb-10">
          <div data-ochil className="lb-yakun relative overflow-hidden rounded-[34px] px-6 py-16 text-center text-white sm:px-12 sm:py-24">
            <div className="relative flex flex-col items-center gap-7">
              <h2 data-sozlab className="h-display max-w-[820px] text-[40px] leading-[0.98] sm:text-[72px]">
                <Sozlab matn="Birinchi dars bepul. Qolganini o‘zingiz hal qilasiz." />
              </h2>
              <p className="max-w-[540px] text-[16.5px] leading-relaxed text-white/90 text-pretty">
                Yozilib qo‘ying — daraja aniqlaymiz, guruhni tanlaymiz, siz esa bir dars o‘tirib ko‘rasiz. Oldindan to‘lov yo‘q.
              </p>
              <div className="grid w-full max-w-[420px] gap-3 sm:flex sm:w-auto sm:max-w-none sm:flex-wrap sm:items-center sm:justify-center">
                <YozilishTugma katta oq />
                <a
                  href={`tel:${MARKAZ.telefonRaw}`}
                  className="inline-flex min-h-16 items-center justify-center gap-2.5 rounded-full border-2 border-white/50 px-7 text-[15.5px] font-bold transition hover:border-white hover:bg-white/10"
                >
                  <IconPhone size={18} />
                  {MARKAZ.telefon}
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ================= Ulkan so'z ================= */}
      <div aria-hidden="true" translate="no" className="overflow-hidden pt-4">
        <p data-parallaks="-60" className="lb-ulkan lb-kontur h-display text-center whitespace-nowrap select-none">
          WORLD BRIDGE
        </p>
      </div>

      {/* ================= Telefonda pastki panel ================= */}
      {/* Flayerdagi QR'dan kelganlarning ko'pi telefonda — asosiy amal doim qo'l ostida */}
      <div
        className="lb-panel fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 px-4 pt-3 backdrop-blur-lg sm:hidden"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex gap-2.5">
          <a
            href={`tel:${MARKAZ.telefonRaw}`}
            aria-label={`Qo‘ng‘iroq qilish: ${MARKAZ.telefon}`}
            className="flex size-13 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <IconPhone size={20} />
          </a>
          <Link
            href="/ariza"
            className="sayt-tugma flex min-h-13 flex-1 items-center justify-center gap-2 rounded-full bg-brand text-[15.5px] font-bold text-white"
          >
            Bepul sinov darsi <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </main>
  )
}

/** Instagram belgisi — icons.tsx uslubida (18×18, chiziqli) */
function InstagramBelgi() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="2.5" y="2.5" width="13" height="13" rx="4" />
      <circle cx="9" cy="9" r="3" />
      <circle cx="13" cy="5" r="0.6" fill="currentColor" />
    </svg>
  )
}

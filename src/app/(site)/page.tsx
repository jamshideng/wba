import Link from 'next/link'
import { MARKAZ, NARX, YONALISHLAR } from '@/lib/markaz'
import { pul } from '@/lib/format'
import { IconAlert, IconPhone, IconPin, IconSend } from '@/components/icons'
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
import './lending.css'

export const metadata = { alternates: { canonical: '/' } }

/** Asosiy tugma — sahifada bir necha joyda */
function YozilishTugma({ katta = false, oq = false }: { katta?: boolean; oq?: boolean }) {
  return (
    <Link
      href="/ariza"
      data-kursor="Yozilish"
      className={`sayt-tugma group inline-flex items-center justify-center gap-3 rounded-full font-bold transition hover:scale-[1.03] ${
        katta ? 'min-h-16 pr-2.5 pl-8 text-[17px]' : 'min-h-14 pr-2 pl-7 text-[15.5px]'
      } ${oq ? 'bg-white text-brand' : 'bg-brand text-white shadow-[0_18px_40px_-14px_var(--color-brand)]'}`}
    >
      Bepul sinov darsiga yozilish
      <span
        aria-hidden="true"
        className={`flex items-center justify-center rounded-full transition group-hover:rotate-[-45deg] ${
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
        <div className="lb-avrora" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="mx-auto grid min-h-[calc(100svh-70px)] max-w-[1320px] items-center gap-6 px-5 pt-8 pb-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10 lg:px-8">
          <div className="flex flex-col gap-7">
            <p
              data-hero
              className="inline-flex w-fit items-center gap-2.5 rounded-full border border-line bg-surface/70 px-4 py-2 text-[13.5px] font-semibold text-ink-2 backdrop-blur"
            >
              <span className="lb-nuqta" aria-hidden="true" />
              Toshkent · {MARKAZ.tashkilYili} yildan beri · qabul ochiq
            </p>

            <h1 className="h-display text-[44px] leading-[0.95] sm:text-[68px] lg:text-[72px] xl:text-[78px]" data-hero-soz>
              <Sozlab matn="Biz shunchaki bilim bermaymiz —" />
              <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                <span className="lb-w lb-rangli inline-block">hayotlarni</span>
              </span>{' '}
              <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                <span className="lb-w lb-rangli inline-block">o‘zgartiramiz</span>
              </span>
            </h1>

            <p data-hero className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[20px] font-semibold sm:text-[26px]">
              <span className="text-ink-2">Bu yerda o‘rganasiz:</span>
              <FanAylanma />
            </p>

            <p data-hero className="max-w-[560px] text-[16.5px] leading-relaxed text-ink-2 text-pretty sm:text-[18px]">
              Bitta markazda — tillar, aniq fanlar va IT. Bir guruhda{' '}
              <b className="font-bold text-ink">{MARKAZ.guruhMaksimal} kishidan ortiq emas</b>, haftada{' '}
              {MARKAZ.darsHaftada} marta, {MARKAZ.darsDaqiqa} daqiqadan.
            </p>

            <div data-hero className="flex flex-wrap items-center gap-3">
              <YozilishTugma />
              <a
                href="#kurslar"
                className="inline-flex min-h-14 items-center rounded-full border-2 border-line px-7 text-[15px] font-bold text-ink-2 transition hover:border-ink hover:text-ink"
              >
                Kurslarni ko‘rish
              </a>
            </div>

            <ul data-hero className="flex flex-wrap gap-2">
              {[
                { t: 'Birinchi dars bepul', r: 'var(--color-ok)' },
                { t: 'Daraja aniqlash bepul', r: 'var(--color-osmon)' },
                { t: 'Oldindan to‘lov yo‘q', r: 'var(--color-accent)' },
              ].map((v) => (
                <li
                  key={v.t}
                  className="flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 py-2 text-[13.5px] font-semibold backdrop-blur"
                >
                  <span className="size-2 rounded-full" style={{ background: v.r }} aria-hidden="true" />
                  {v.t}
                </li>
              ))}
            </ul>
          </div>

          <div data-hero className="relative mx-auto w-full max-w-[600px]">
            <Globus />
            <p className="lbl -mt-4 text-center text-ink-3">Barmoq yoki sichqoncha bilan aylantiring</p>
          </div>
        </div>
      </section>

      <TezlikLenta />

      <div className="mx-auto max-w-[1320px] px-5 lg:px-8">
        {/* ================= Faktlar ================= */}
        <section aria-label="Raqamlarda" className="grid grid-cols-2 gap-3 pb-16 lg:grid-cols-4 lg:gap-4">
          {[
            { n: yil, oxiri: '+', t: 'yil tajriba', izoh: `${MARKAZ.tashkilYili} yildan beri Toshkentda`, r: 'var(--color-brand)' },
            { n: YONALISHLAR.length, t: 'yo‘nalish', izoh: 'tillar, aniq fanlar va IT', r: 'var(--color-osmon)' },
            { n: MARKAZ.guruhMaksimal, t: 'kishi — guruhda eng ko‘pi', izoh: 'ustoz har biriga yetadi', r: 'var(--color-binafsha)' },
            { n: 0, t: 'so‘m — birinchi dars', izoh: 'avval ko‘rasiz, keyin qaror', r: 'var(--color-ok)' },
          ].map((f, i) => (
            <div
              key={f.t}
              data-ochil={i * 0.07}
              className="relative flex flex-col gap-2 overflow-hidden rounded-[26px] border border-line bg-surface p-5 sm:p-7"
            >
              <span
                aria-hidden="true"
                className="absolute -top-10 -right-10 size-32 rounded-full opacity-25"
                style={{ background: `radial-gradient(closest-side, ${f.r}, transparent)` }}
              />
              <span className="h-display text-[54px] leading-none sm:text-[80px]" style={{ color: f.r }}>
                <RaqamSanagich qiymat={f.n} />
                {f.oxiri}
              </span>
              <span className="text-[15px] font-bold">{f.t}</span>
              <span className="text-[13px] text-ink-3">{f.izoh}</span>
            </div>
          ))}
        </section>

        {/* ================= Kurslar ================= */}
        <section id="kurslar" className="flex flex-col gap-10 py-12">
          <Sarlavha
            yorliq="Yo‘nalishlar"
            matn="Har yoshga — o‘z yo‘li"
            izoh="Yoshni tanlang — mos kurslar ajralib turadi. Kartani bossangiz, ariza shu kurs bilan ochiladi."
          />
          <Kurslar />
        </section>
      </div>

      {/* ================= Qadamlar (gorizontal) ================= */}
      <Qadamlar />

      <div className="mx-auto max-w-[1320px] px-5 lg:px-8">
        {/* ================= Format ================= */}
        <section id="dars" className="flex flex-col gap-10 py-12">
          <Sarlavha
            yorliq="Dars formati"
            matn="Kichik guruh — katta natija"
            izoh={`Haftada ${MARKAZ.darsHaftada} marta, ${MARKAZ.darsDaqiqa} daqiqadan. Guruh hajmini o‘zingiz tanlaysiz.`}
          />

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { nom: 'VIP', son: 1, t: 'Butun dars faqat sizga. Eng tez natija.', rang: 'var(--color-brand)' },
              { nom: 'Mini guruh', son: 2, t: 'Ikki kishi — suhbatdosh ham bor, e‘tibor ham yetarli.', rang: 'var(--color-accent)' },
              {
                nom: 'Standart guruh',
                son: MARKAZ.guruhMaksimal,
                t: `10–${MARKAZ.guruhMaksimal} kishi. Hech qachon ${MARKAZ.guruhMaksimal} tadan oshmaydi — bu qat‘iy qoida.`,
                rang: 'var(--color-osmon)',
              },
            ].map((g, i) => (
              <article
                key={g.nom}
                data-ochil={i * 0.08}
                className="sayt-karta flex flex-col gap-6 rounded-[26px] border border-line bg-surface p-7"
              >
                <div aria-hidden="true" className="flex h-[88px] items-center">
                  <div className={`grid gap-2 ${g.son > 2 ? 'grid-cols-6' : 'grid-flow-col'}`}>
                    {Array.from({ length: g.son }, (_, n) => (
                      <span
                        key={n}
                        className={`rounded-full ${g.son === 1 ? 'size-20' : g.son === 2 ? 'size-14' : 'size-8'}`}
                        style={{ background: g.rang, opacity: g.son > 2 ? 0.45 + (n % 6) * 0.1 : 1 }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="h-display text-[28px]">{g.nom}</span>
                    <span className="lbl" style={{ color: g.rang }}>
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
        <section id="narxlar" className="flex flex-col gap-10 py-12">
          <Sarlavha
            yorliq="Narxlar"
            matn="Avval darsni ko‘rasiz, keyin to‘laysiz"
            izoh="Sinov darsi va daraja aniqlash bepul. To‘lov faqat dars yoqqandan keyin."
          />

          <div className="grid gap-4 lg:grid-cols-3">
            {[
              { yorliq: 'Tanishuv oyi', narx: NARX.tanishuvOyi, birlik: 'so‘m', t: 'Birinchi oy — tanishuv narxi. Guruh ham, ustoz ham mos kelishini shu oyda tekshirasiz.' },
              { yorliq: 'Ikkinchi oydan', narx: NARX.standart, birlik: 'so‘m / oy', t: `Standart oylik to‘lov. Haftada ${MARKAZ.darsHaftada} dars, ${MARKAZ.darsDaqiqa} daqiqadan.` },
            ].map((n, i) => (
              <article key={n.yorliq} data-ochil={i * 0.08} className="sayt-karta flex flex-col gap-4 rounded-[26px] border border-line bg-surface p-8">
                <p className="lbl">{n.yorliq}</p>
                <p className="flex items-baseline gap-2">
                  <span className="h-display tnum text-[48px] leading-none">{pul(n.narx)}</span>
                  <span className="text-sm text-ink-3">{n.birlik}</span>
                </p>
                <p className="text-[14.5px] leading-relaxed text-ink-2">{n.t}</p>
              </article>
            ))}

            <article data-ochil="0.16" className="lb-tanlov sayt-karta relative flex flex-col gap-4 rounded-[26px] p-8">
              <p className="flex items-center justify-between gap-3">
                <span className="lbl text-white">Uch oylik · eng foydali</span>
                <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-brand">
                  {pul(NARX.uchOylikAsl - NARX.uchOylik)} so‘m tejaysiz
                </span>
              </p>
              <p className="flex flex-wrap items-baseline gap-2.5">
                <span className="h-display tnum text-[48px] leading-none">{pul(NARX.uchOylik)}</span>
                <span className="tnum font-[family-name:var(--font-mono)] text-sm text-white/70 line-through">{pul(NARX.uchOylikAsl)}</span>
              </p>
              <p className="text-[14.5px] leading-relaxed text-white/90">Uch oyni bittada to‘lasangiz, uchala oy ham tanishuv narxida qoladi.</p>
            </article>
          </div>

          <p data-ochil className="flex items-start gap-4 rounded-[20px] border border-accent-line bg-accent-soft px-6 py-5">
            <span className="mt-0.5 shrink-0 text-accent">
              <IconAlert size={20} />
            </span>
            <span className="text-[14.5px] leading-relaxed text-ink-2">
              <b className="text-ink">Chegirmalar ham bor:</b> ikki va undan ortiq fanga yozilsangiz, shuningdek aka-uka,
              opa-singil yoki do‘stingiz bilan birga kelsangiz. Miqdorini qo‘ng‘iroq paytida aytamiz.
            </span>
          </p>
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

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { href: `tel:${MARKAZ.telefonRaw}`, nom: 'Qo‘ng‘iroq', qiymat: MARKAZ.telefon, ikonka: <IconPhone size={20} />, r: 'var(--color-ok)' },
                  { href: MARKAZ.telegram, nom: 'Telegram', qiymat: '@WBA_LC', ikonka: <IconSend size={20} />, r: 'var(--color-osmon)' },
                  { href: MARKAZ.instagram, nom: 'Instagram', qiymat: MARKAZ.instagramNom, ikonka: <InstagramBelgi />, r: 'var(--color-binafsha)' },
                ].map((a) => (
                  <a
                    key={a.nom}
                    href={a.href}
                    {...(a.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="group flex min-h-11 flex-col gap-2.5 rounded-[18px] border border-line bg-surface-2 p-4 transition hover:-translate-y-1"
                  >
                    <span
                      className="flex size-10 items-center justify-center rounded-full text-white"
                      style={{ background: `color-mix(in oklab, ${a.r} 84%, black)` }}
                    >
                      {a.ikonka}
                    </span>
                    <span className="text-[13px] text-ink-3">{a.nom}</span>
                    <span className="font-[family-name:var(--font-mono)] text-[13.5px] break-all text-ink">{a.qiymat}</span>
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
              <div className="flex flex-wrap items-center justify-center gap-3">
                <YozilishTugma katta oq />
                <a
                  href={`tel:${MARKAZ.telefonRaw}`}
                  className="inline-flex min-h-16 items-center gap-2.5 rounded-full border-2 border-white/50 px-7 text-[15.5px] font-bold transition hover:border-white hover:bg-white/10"
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
        <p data-parallaks="-60" className="lb-ulkan lb-rangli h-display text-center whitespace-nowrap select-none">
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

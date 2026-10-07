import Link from 'next/link'
import { MARKAZ, NARX, YONALISHLAR } from '@/lib/markaz'
import { pul } from '@/lib/format'
import { IconAlert, IconPhone, IconPin, IconSend } from '@/components/icons'
import { RaqamSanagich } from '@/components/raqam-sanagich'
import { Salom } from '@/components/lending/salom'
import { Kopruk } from '@/components/lending/kopruk'
import { Lenta } from '@/components/lending/lenta'
import { Kurslar } from '@/components/lending/kurslar'
import { arabShrift } from '@/components/lending/shrift'
import './lending.css'

export const metadata = { alternates: { canonical: '/' } }

const kechikish = (ms: number) => ({ '--k': `${ms}ms` }) as React.CSSProperties

/** Qizil asosiy tugma — sahifada bir necha joyda */
function YozilishTugma({ katta = false, oq = false }: { katta?: boolean; oq?: boolean }) {
  return (
    <Link
      href="/ariza"
      className={`sayt-tugma inline-flex items-center justify-center gap-2.5 rounded-[12px] font-bold transition hover:brightness-110 ${
        katta ? 'min-h-15 px-9 text-[16.5px]' : 'min-h-13 px-7 text-[15px]'
      } ${oq ? 'bg-white text-brand' : 'bg-brand text-white shadow-[0_14px_34px_-14px_var(--color-brand)]'}`}
    >
      Bepul sinov darsiga yozilish
      <span aria-hidden="true">→</span>
    </Link>
  )
}

function Sarlavha({ yorliq, children, izoh }: { yorliq: string; children: React.ReactNode; izoh?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
      <div className="flex flex-col gap-3">
        <p className="lbl text-brand">{yorliq}</p>
        <h2 className="h-display max-w-[16ch] text-[34px] leading-[1.04] text-pretty sm:text-[46px]">{children}</h2>
      </div>
      {izoh && <p className="max-w-[420px] text-[15px] leading-relaxed text-ink-2 text-pretty lg:text-right">{izoh}</p>}
    </div>
  )
}

export default function Bosh() {
  const yil = new Date().getFullYear() - MARKAZ.tashkilYili

  return (
    <main className={`${arabShrift.variable} overflow-x-clip pb-24 sm:pb-0`}>
      {/* ================= Hero ================= */}
      <section className="relative isolate">
        <div className="lb-fon" />
        <div className="mx-auto grid max-w-[1260px] items-center gap-12 px-5 pt-10 pb-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:px-8 lg:pt-20 lg:pb-16">
          <div className="flex flex-col gap-7">
            <p className="sayt-kirish inline-flex w-fit items-center gap-2.5 rounded-full border border-line bg-surface/70 px-3.5 py-2 text-[13px] text-ink-2 backdrop-blur">
              <span className="lb-nuqta" aria-hidden="true" />
              Toshkent · {MARKAZ.tashkilYili} yildan beri · qabul ochiq
            </p>

            <h1
              className="h-display sayt-kirish text-[44px] leading-[0.98] text-balance sm:text-[64px] lg:text-[68px]"
              style={kechikish(90)}
            >
              Biz shunchaki bilim bermaymiz — <span className="text-brand">hayotlarni o‘zgartiramiz</span>
            </h1>

            <p className="sayt-kirish max-w-[580px] text-[17px] leading-relaxed text-ink-2 text-pretty sm:text-[19px]" style={kechikish(150)}>
              Ingliz, rus, arab va turk tili, matematika, Pochemuchka va IT — bitta markazda. Bir guruhda{' '}
              <b className="font-semibold text-ink">{MARKAZ.guruhMaksimal} kishidan ortiq emas</b>, haftada{' '}
              {MARKAZ.darsHaftada} marta, {MARKAZ.darsDaqiqa} daqiqadan.
            </p>

            <div className="sayt-kirish flex flex-wrap items-center gap-3" style={kechikish(210)}>
              <YozilishTugma />
              <a
                href="#kurslar"
                className="inline-flex min-h-13 items-center rounded-[12px] border border-line bg-surface/60 px-6 text-[15px] font-semibold text-ink-2 backdrop-blur transition hover:border-ink-3 hover:text-ink"
              >
                Kurslarni ko‘rish
              </a>
            </div>

            <ul className="sayt-kirish flex flex-wrap gap-x-6 gap-y-2.5 text-[14px] text-ink-2" style={kechikish(270)}>
              {['Birinchi dars bepul', 'Daraja aniqlash bepul', 'Oldindan to‘lov yo‘q'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <circle cx="9" cy="9" r="9" fill="var(--color-ok-soft)" />
                    <path d="M5.5 9.3l2.3 2.2 4.7-5" stroke="var(--color-ok)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Ko'prik kartasi: tillarda salom + chizilayotgan ko'prik */}
          <div className="sayt-kirish relative mx-auto w-full max-w-[560px]" style={kechikish(160)}>
            <div className="lb-karta flex flex-col gap-6 rounded-[28px] px-6 pt-9 pb-6 sm:px-9">
              <Salom />
              <Kopruk className="w-full" />
              <div className="flex items-center justify-between border-t border-line pt-4 text-[13px]">
                <span className="text-ink-3">World Bridge Academy</span>
                <span className="font-semibold text-ink-2">{YONALISHLAR.length} yo‘nalish — bitta ko‘prik</span>
              </div>
            </div>

            {/* Suzuvchi belgilar */}
            {[
              { s: 'π', c: 'text-binafsha', pos: '-left-4 top-10 sm:-left-8', b: '-8deg', k: 0 },
              { s: '?', c: 'text-ok', pos: '-right-3 top-4 sm:-right-6', b: '10deg', k: 700 },
              { s: '</>', c: 'text-osmon', pos: '-left-3 bottom-20 sm:-left-10', b: '6deg', k: 1400 },
              { s: 'AI', c: 'text-brand', pos: '-right-2 bottom-24 sm:-right-8', b: '-6deg', k: 2100 },
            ].map((f) => (
              <span
                key={f.s}
                aria-hidden="true"
                translate="no"
                className={`lb-suzuvchi h-display absolute ${f.pos} ${f.c} flex min-w-12 items-center justify-center rounded-[14px] border border-line bg-surface px-3 py-2.5 text-[20px] shadow-[0_18px_40px_-20px_rgb(0_0_0/0.6)]`}
                style={{ '--b': f.b, '--k': `${f.k}ms` } as React.CSSProperties}
              >
                {f.s}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1260px] px-5 lg:px-8">
        <Lenta />

        {/* ================= Faktlar ================= */}
        <section aria-label="Raqamlarda" className="sayt-paydo grid grid-cols-2 gap-3 py-12 lg:grid-cols-4 lg:gap-4">
          {[
            { n: yil, oxiri: '+', t: 'yil tajriba', izoh: `${MARKAZ.tashkilYili} yildan beri Toshkentda` },
            { n: YONALISHLAR.length, t: 'yo‘nalish', izoh: 'tillar, aniq fanlar va IT' },
            { n: MARKAZ.guruhMaksimal, t: 'kishi — guruhda eng ko‘pi', izoh: 'ustoz har biriga yetadi', brand: true },
            { n: 0, t: 'so‘m — birinchi dars', izoh: 'avval ko‘rasiz, keyin qaror' },
          ].map((f) => (
            <div key={f.t} className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
              <span className={`h-display text-[46px] leading-none sm:text-[60px] ${f.brand ? 'text-brand' : ''}`}>
                <RaqamSanagich qiymat={f.n} />
                {f.oxiri}
              </span>
              <span className="text-[14.5px] font-semibold">{f.t}</span>
              <span className="text-[13px] text-ink-3">{f.izoh}</span>
            </div>
          ))}
        </section>

        {/* ================= Kurslar ================= */}
        <section id="kurslar" className="sayt-paydo flex flex-col gap-9 py-12">
          <Sarlavha yorliq="Yo‘nalishlar" izoh="Yoshni tanlang — mos kurslar ajralib turadi. Kartani bossangiz, ariza shu kurs bilan ochiladi.">
            Har yoshga — o‘z yo‘li
          </Sarlavha>
          <Kurslar />
        </section>

        {/* ================= Dars qanday o'tadi ================= */}
        <section id="dars" className="sayt-paydo flex flex-col gap-9 py-12">
          <Sarlavha yorliq="Dars formati" izoh={`Haftada ${MARKAZ.darsHaftada} marta, ${MARKAZ.darsDaqiqa} daqiqadan. Guruh hajmini o‘zingiz tanlaysiz.`}>
            Kichik guruh — katta natija
          </Sarlavha>

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
            ].map((g) => (
              <article key={g.nom} className="sayt-karta flex flex-col gap-5 rounded-[20px] border border-line bg-surface p-6">
                <div aria-hidden="true" className="flex h-[76px] items-center">
                  <div className={`grid gap-2 ${g.son > 2 ? 'grid-cols-6' : 'grid-flow-col'}`}>
                    {Array.from({ length: g.son }, (_, n) => (
                      <span
                        key={n}
                        className={`rounded-full ${g.son === 1 ? 'size-16' : g.son === 2 ? 'size-12' : 'size-7'}`}
                        style={{ background: g.rang, opacity: g.son > 2 ? 0.45 + (n % 6) * 0.1 : 1 }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="h-display text-[24px]">{g.nom}</span>
                    <span className="lbl">{g.son === 1 ? '1 kishi' : g.son === 2 ? '2 kishi' : `${MARKAZ.guruhMaksimal} gacha`}</span>
                  </p>
                  <p className="text-[14px] leading-relaxed text-ink-2">{g.t}</p>
                </div>
              </article>
            ))}
          </div>

          {/* Yozilgandan keyin nima bo'ladi */}
          <ol className="grid gap-px overflow-hidden rounded-[20px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Ariza qoldirasiz', 'Ism va telefon — boshqa hech narsa kerak emas.'],
              ['Qo‘ng‘iroq qilamiz', 'Bir ish kuni ichida — qulay vaqtni kelishamiz.'],
              ['Bepul sinov darsi', 'Daraja aniqlanadi, guruhda bir dars o‘tirib ko‘rasiz.'],
              ['Yoqsa — davom etasiz', 'To‘lov faqat shundan keyin. Davomat va baholar shaxsiy sahifada.'],
            ].map(([nom, t], i) => (
              <li key={nom} className="flex flex-col gap-3 bg-surface p-6">
                <span
                  className={`h-display flex size-10 items-center justify-center rounded-full text-[15px] ${
                    i === 3 ? 'bg-brand text-white' : 'border-2 border-brand text-brand'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="text-[16px] font-bold">{nom}</span>
                <span className="text-[13.5px] leading-relaxed text-ink-2">{t}</span>
              </li>
            ))}
          </ol>
          <p className="text-[13.5px] text-ink-3">Kursni tugatganlarga markaz sertifikati beriladi.</p>
        </section>

        {/* ================= Narxlar ================= */}
        <section id="narxlar" className="sayt-paydo flex flex-col gap-9 py-12">
          <Sarlavha yorliq="Narxlar" izoh="Sinov darsi va daraja aniqlash bepul. To‘lov faqat dars yoqqandan keyin.">
            Avval darsni ko‘rasiz, keyin to‘laysiz
          </Sarlavha>

          <div className="grid gap-4 lg:grid-cols-3">
            {[
              { yorliq: 'Tanishuv oyi', narx: NARX.tanishuvOyi, birlik: 'so‘m', t: 'Birinchi oy — tanishuv narxi. Guruh ham, ustoz ham mos kelishini shu oyda tekshirasiz.' },
              { yorliq: 'Ikkinchi oydan', narx: NARX.standart, birlik: 'so‘m / oy', t: `Standart oylik to‘lov. Haftada ${MARKAZ.darsHaftada} dars, ${MARKAZ.darsDaqiqa} daqiqadan.` },
            ].map((n) => (
              <article key={n.yorliq} className="sayt-karta flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-7">
                <p className="lbl">{n.yorliq}</p>
                <p className="flex items-baseline gap-2">
                  <span className="h-display tnum text-[42px] leading-none">{pul(n.narx)}</span>
                  <span className="text-sm text-ink-3">{n.birlik}</span>
                </p>
                <p className="text-[14px] leading-relaxed text-ink-2">{n.t}</p>
              </article>
            ))}

            <article className="lb-tanlov sayt-karta relative flex flex-col gap-4 rounded-[20px] p-7">
              <p className="flex items-center justify-between gap-3">
                <span className="lbl text-brand">Uch oylik</span>
                <span className="rounded-full bg-brand px-3 py-1.5 text-[11.5px] font-bold text-white">
                  {pul(NARX.uchOylikAsl - NARX.uchOylik)} so‘m tejaysiz
                </span>
              </p>
              <p className="flex flex-wrap items-baseline gap-2.5">
                <span className="h-display tnum text-[42px] leading-none">{pul(NARX.uchOylik)}</span>
                <span className="tnum font-[family-name:var(--font-mono)] text-sm text-ink-3 line-through">{pul(NARX.uchOylikAsl)}</span>
              </p>
              <p className="text-[14px] leading-relaxed text-ink-2">Uch oyni bittada to‘lasangiz, uchala oy ham tanishuv narxida qoladi.</p>
            </article>
          </div>

          <p className="flex items-start gap-4 rounded-[16px] border border-accent-line bg-accent-soft px-5 py-4">
            <span className="mt-0.5 shrink-0 text-accent">
              <IconAlert size={20} />
            </span>
            <span className="text-[14px] leading-relaxed text-ink-2">
              <b className="text-ink">Chegirmalar ham bor:</b> ikki va undan ortiq fanga yozilsangiz, shuningdek aka-uka,
              opa-singil yoki do‘stingiz bilan birga kelsangiz. Miqdorini qo‘ng‘iroq paytida aytamiz.
            </span>
          </p>
        </section>

        {/* ================= Aloqa ================= */}
        <section id="aloqa" className="sayt-paydo py-12">
          <div className="grid overflow-hidden rounded-[24px] border border-line bg-surface lg:grid-cols-2">
            <div className="flex flex-col gap-7 p-7 sm:p-10">
              <div className="flex flex-col gap-3">
                <p className="lbl text-brand">Manzil</p>
                <h2 className="h-display text-[30px] leading-tight sm:text-[36px]">N. Ibragimov ko‘chasi, 4-uy</h2>
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
                  { href: `tel:${MARKAZ.telefonRaw}`, nom: 'Qo‘ng‘iroq', qiymat: MARKAZ.telefon, ikonka: <IconPhone size={20} /> },
                  { href: MARKAZ.telegram, nom: 'Telegram', qiymat: '@WBA_LC', ikonka: <IconSend size={20} /> },
                  { href: MARKAZ.instagram, nom: 'Instagram', qiymat: MARKAZ.instagramNom, ikonka: <InstagramBelgi /> },
                ].map((a) => (
                  <a
                    key={a.nom}
                    href={a.href}
                    {...(a.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="group flex min-h-11 flex-col gap-2.5 rounded-[14px] border border-line bg-surface-2 p-4 transition hover:-translate-y-0.5 hover:border-brand"
                  >
                    <span className="text-brand">{a.ikonka}</span>
                    <span className="text-[13px] text-ink-3">{a.nom}</span>
                    <span className="font-[family-name:var(--font-mono)] text-[13.5px] break-all text-ink group-hover:text-brand">{a.qiymat}</span>
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
        <section className="sayt-paydo pt-6 pb-16">
          <div className="lb-yakun relative overflow-hidden rounded-[28px] px-6 py-14 text-center text-white sm:px-12 sm:py-20">
            <span aria-hidden="true" translate="no" className="h-display pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 text-[180px] leading-none whitespace-nowrap text-white/10 sm:text-[260px]">
              WBA
            </span>
            <div className="relative flex flex-col items-center gap-6">
              <h2 className="h-display max-w-[760px] text-[36px] leading-[1.02] text-balance sm:text-[58px]">
                Birinchi dars bepul. Qolganini o‘zingiz hal qilasiz.
              </h2>
              <p className="max-w-[540px] text-[16px] leading-relaxed text-white/85 text-pretty">
                Yozilib qo‘ying — daraja aniqlaymiz, guruhni tanlaymiz, siz esa bir dars o‘tirib ko‘rasiz. Oldindan to‘lov yo‘q.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <YozilishTugma katta oq />
                <a
                  href={`tel:${MARKAZ.telefonRaw}`}
                  className="inline-flex min-h-15 items-center gap-2.5 rounded-[12px] border-2 border-white/40 px-7 text-[15px] font-bold transition hover:border-white hover:bg-white/10"
                >
                  <IconPhone size={18} />
                  {MARKAZ.telefon}
                </a>
              </div>
            </div>
          </div>
        </section>
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
            className="flex size-13 shrink-0 items-center justify-center rounded-[12px] border border-line bg-surface text-ink"
          >
            <IconPhone size={20} />
          </a>
          <Link
            href="/ariza"
            className="sayt-tugma flex min-h-13 flex-1 items-center justify-center gap-2 rounded-[12px] bg-brand text-[15px] font-bold text-white"
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

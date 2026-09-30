import Link from 'next/link'
import { MARKAZ, NARX, YONALISHLAR } from '@/lib/markaz'
import { pul } from '@/lib/format'
import { IconAlert, IconPin } from '@/components/icons'

export const metadata = { alternates: { canonical: '/' } }

export default function Bosh() {
  const yil = new Date().getFullYear() - MARKAZ.tashkilYili

  return (
    <main className="mx-auto max-w-[1260px] px-5 lg:px-8">
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden pt-16 pb-14 lg:pt-20">
        <svg
          viewBox="0 0 1440 420"
          className="pointer-events-none absolute -top-6 left-1/2 h-[420px] w-[1440px] -translate-x-1/2"
          aria-hidden="true"
        >
          <path d="M-80 400C340 60 1100 60 1520 400" fill="none" stroke="#FF0000" strokeWidth="2.5" opacity=".2" />
          <path d="M-80 420C340 100 1100 100 1520 420" fill="none" stroke="#FF0000" strokeWidth="1.5" opacity=".1" />
          <path d="M-80 440C340 140 1100 140 1520 440" fill="none" stroke="#FF0000" strokeWidth="1" opacity=".06" />
        </svg>

        <div className="relative flex max-w-[860px] flex-col gap-6">
          <p className="lbl text-brand">
            Toshkent · {MARKAZ.tashkilYili} yildan beri
          </p>
          <h1 className="h-display text-[38px] leading-[1.03] text-pretty sm:text-[52px] lg:text-[62px]">
            Bir guruhda {MARKAZ.guruhMaksimal} kishidan ortiq bo‘lmaydi.
          </h1>
          <p className="max-w-[660px] text-[17px] leading-relaxed text-ink-2 text-pretty sm:text-[19px]">
            Sakkiz yo‘nalish, haftada {MARKAZ.darsHaftada} marta, bir yarim soatdan.
            Birinchi dars ham, daraja aniqlash ham bepul — oldindan to‘lov so‘ralmaydi.
          </p>
          <div className="flex flex-wrap items-center gap-3.5 pt-1">
            <Link
              href="/ariza"
              className="inline-flex min-h-13 items-center rounded-[10px] bg-brand text-white px-7 text-[15px] font-bold transition hover:brightness-110"
            >
              Bepul sinov darsiga yozilish
            </Link>
            <Link
              href="#kurslar"
              className="inline-flex min-h-13 items-center rounded-[10px] border border-line px-6 text-[15px] font-semibold text-ink-2 transition hover:border-ink-3 hover:text-ink"
            >
              Kurslarni ko‘rish
            </Link>
          </div>
          <p className="text-[13.5px] text-ink-3">
            Yozilganingizdan keyin bir ish kuni ichida qo‘ng‘iroq qilamiz va qulay vaqtni kelishamiz.
          </p>
        </div>
      </section>

      {/* ---------------- Faktlar ---------------- */}
      <section className="grid border-y border-line sm:grid-cols-2 lg:grid-cols-4">
        {[
          { n: yil, t: 'yildan ortiq tajriba' },
          { n: YONALISHLAR.length, t: 'o‘quv yo‘nalishi' },
          { n: MARKAZ.guruhMaksimal, t: 'guruhdagi eng ko‘p son', brand: true },
          { n: 0, t: 'birinchi dars uchun to‘lov' },
        ].map((f, i) => (
          <div
            key={f.t}
            className={`flex flex-col gap-1.5 py-6 ${i > 0 ? 'lg:border-l lg:border-line lg:pl-7' : ''}`}
          >
            <span
              className={`h-display text-[34px] leading-none ${f.brand ? 'text-brand' : ''}`}
            >
              {f.n}
            </span>
            <span className="text-[14px] text-ink-2">{f.t}</span>
          </div>
        ))}
      </section>

      {/* ---------------- Kurslar ---------------- */}
      <section id="kurslar" className="flex scroll-mt-24 flex-col gap-7 py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <p className="lbl">Yo‘nalishlar</p>
            <h2 className="h-display text-[30px] sm:text-[34px]">
              Sakkiz yo‘nalish — hammasi noldan
            </h2>
          </div>
          <p className="max-w-[380px] text-[14.5px] text-ink-2 text-pretty lg:text-right">
            Yosh chegarasi yo‘q yo‘nalishlar ham, faqat bolalar uchun mo‘ljallangani ham bor.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {YONALISHLAR.map((y) => (
            <article
              key={y.id}
              className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface p-6"
            >
              <p className="lbl text-[10px] text-brand">{y.yorliq}</p>
              <h3 className="font-[family-name:var(--font-display)] text-[19px] font-bold">
                {y.nom}
              </h3>
              <p className="text-[13.5px] leading-relaxed text-ink-2">{y.qisqa_tavsif}</p>
              <p className="mt-auto pt-2 font-[family-name:var(--font-mono)] text-[11.5px] text-ink-3">
                {y.yosh_chegarasi}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------- Dars qanday o'tadi ---------------- */}
      <section id="dars" className="flex scroll-mt-24 flex-col gap-7 pb-16">
        <div className="flex flex-col gap-3">
          <p className="lbl">Dars qanday o‘tadi</p>
          <h2 className="h-display text-[30px] sm:text-[34px]">
            Haftada uch marta, bir yarim soatdan
          </h2>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-5 rounded-[14px] border border-line bg-surface p-7">
            <p className="lbl text-ink">Guruh formatini o‘zingiz tanlaysiz</p>
            <div className="flex flex-col gap-3">
              {[
                { n: '1', nom: 'VIP', t: 'Butun dars faqat sizga. Eng tez natija.', ton: 'text-brand' },
                { n: '2', nom: 'Mini guruh', t: 'Ikki kishi — suhbatdosh ham bor, e‘tibor ham yetarli.', ton: 'text-accent' },
                { n: '10–12', nom: 'Standart guruh', t: `Hech qachon ${MARKAZ.guruhMaksimal} kishidan oshmaydi — bu qat‘iy qoida.`, ton: '' },
              ].map((g) => (
                <div key={g.nom} className="flex items-center gap-5 rounded-[10px] bg-surface-2 p-4">
                  <span
                    className={`h-display w-14 shrink-0 text-[26px] leading-none ${g.ton} ${g.n.length > 2 ? 'text-[21px]' : ''}`}
                  >
                    {g.n}
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-[15px] font-bold">{g.nom}</span>
                    <span className="text-[13.5px] text-ink-2">{g.t}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6 rounded-[14px] border border-line bg-surface p-7">
            <p className="lbl text-ink">Natija qanday kuzatiladi</p>
            <ol className="flex flex-col gap-5">
              {[
                ['Daraja aniqlash', 'Birinchi kelganda bepul o‘tkaziladi — qaysi guruh mos kelishini shu aniqlaydi.'],
                ['Davomat va baholash', 'Har dars belgilanadi. Qatnashuv va faollik shaxsiy sahifada ko‘rinib turadi.'],
                ['Sertifikat', 'Kursni tugatganga markaz sertifikati beriladi.'],
              ].map(([nom, t], i) => (
                <li key={nom} className="flex gap-4">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full border font-[family-name:var(--font-display)] text-[13px] font-bold ${
                      i === 0 ? 'border-brand text-brand' : 'border-line text-ink-2'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-[15px] font-bold">{nom}</span>
                    <span className="text-[13.5px] leading-relaxed text-ink-2">{t}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ---------------- Narxlar ---------------- */}
      <section id="narxlar" className="flex scroll-mt-24 flex-col gap-7 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <p className="lbl">Narxlar</p>
            <h2 className="h-display text-[30px] sm:text-[34px]">
              Avval darsni ko‘rasiz, keyin to‘laysiz
            </h2>
          </div>
          <p className="max-w-[400px] text-[14.5px] text-ink-2 text-pretty lg:text-right">
            Sinov darsi va daraja aniqlash bepul. To‘lov faqat dars yoqqandan keyin.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <article className="flex flex-col gap-3.5 rounded-[14px] border border-line bg-surface p-7">
            <p className="lbl">Tanishuv oyi</p>
            <p className="flex items-baseline gap-2">
              <span className="h-display tnum text-[36px] leading-none">{pul(NARX.tanishuvOyi)}</span>
              <span className="text-sm text-ink-3">so‘m</span>
            </p>
            <p className="text-[14px] leading-relaxed text-ink-2">
              Birinchi oy — tanishuv narxi. Bu oy ichida guruh ham, ustoz ham sizga mos kelishini
              tekshirasiz.
            </p>
          </article>

          <article className="flex flex-col gap-3.5 rounded-[14px] border border-line bg-surface p-7">
            <p className="lbl">Ikkinchi oydan</p>
            <p className="flex items-baseline gap-2">
              <span className="h-display tnum text-[36px] leading-none">{pul(NARX.standart)}</span>
              <span className="text-sm text-ink-3">so‘m / oy</span>
            </p>
            <p className="text-[14px] leading-relaxed text-ink-2">
              Standart oylik to‘lov. Haftada {MARKAZ.darsHaftada} dars, bir yarim soatdan.
            </p>
          </article>

          <article className="flex flex-col gap-3.5 rounded-[14px] border border-brand bg-surface p-7">
            <p className="flex items-center justify-between gap-3">
              <span className="lbl text-brand">Uch oylik</span>
              <span className="rounded-md bg-brand text-white px-2.5 py-1 text-[11px] font-bold">
                {pul(NARX.uchOylikAsl - NARX.uchOylik)} tejaysiz
              </span>
            </p>
            <p className="flex flex-wrap items-baseline gap-2.5">
              <span className="h-display tnum text-[36px] leading-none">{pul(NARX.uchOylik)}</span>
              <span className="tnum font-[family-name:var(--font-mono)] text-sm text-ink-3 line-through">
                {pul(NARX.uchOylikAsl)}
              </span>
            </p>
            <p className="text-[14px] leading-relaxed text-ink-2">
              Uch oyni bittada to‘lasangiz, uchala oy ham tanishuv narxida qoladi.
            </p>
          </article>
        </div>

        <p className="flex items-start gap-4 rounded-[12px] border border-line bg-surface px-5 py-4">
          <span className="mt-0.5 shrink-0 text-accent">
            <IconAlert size={20} />
          </span>
          <span className="text-[14px] leading-relaxed text-ink-2">
            <b className="text-ink">Chegirmalar ham bor:</b> ikki va undan ortiq fanga
            yozilsangiz, shuningdek aka-uka, opa-singil yoki do‘stingiz bilan birga kelsangiz.
            Miqdorini qo‘ng‘iroq paytida aytamiz.
          </span>
        </p>
      </section>

      {/* ---------------- Aloqa ---------------- */}
      <section id="aloqa" className="scroll-mt-24 pb-16">
        <div className="grid overflow-hidden rounded-[14px] border border-line bg-surface lg:grid-cols-2">
          <div className="flex flex-col gap-6 p-8 lg:p-10">
            <div className="flex flex-col gap-3">
              <p className="lbl">Manzil</p>
              <h2 className="h-display text-[24px] leading-snug sm:text-[27px]">
                N. Ibragimov ko‘chasi, 4-uy
              </h2>
            </div>

            <p className="flex items-start gap-3.5">
              <span className="mt-0.5 shrink-0 text-brand">
                <IconPin size={19} />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-[14px] font-semibold">Qanday topasiz</span>
                <span className="text-[14px] leading-relaxed text-ink-2">{MARKAZ.moljal}</span>
              </span>
            </p>

            <dl className="flex flex-col gap-3 border-t border-line pt-5">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[14px] text-ink-3">Telefon</dt>
                <dd>
                  <a
                    href={`tel:${MARKAZ.telefonRaw}`}
                    className="font-[family-name:var(--font-mono)] text-[15px] hover:text-accent"
                  >
                    {MARKAZ.telefon}
                  </a>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[14px] text-ink-3">Telegram</dt>
                <dd>
                  <a
                    href={MARKAZ.telegram}
                    className="font-[family-name:var(--font-mono)] text-[15px] text-accent hover:text-brand"
                  >
                    {MARKAZ.telegramNom}
                  </a>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[14px] text-ink-3">Instagram</dt>
                <dd>
                  <a
                    href={MARKAZ.instagram}
                    className="font-[family-name:var(--font-mono)] text-[15px] text-accent hover:text-brand"
                  >
                    {MARKAZ.instagramNom}
                  </a>
                </dd>
              </div>
            </dl>
          </div>

          <div className="relative flex min-h-[300px] items-center justify-center border-line bg-[#120e0d] max-lg:border-t lg:border-l">
            <svg
              viewBox="0 0 400 340"
              preserveAspectRatio="xMidYMid slice"
              className="absolute inset-0 size-full"
              aria-hidden="true"
            >
              <path d="M0 120H400" stroke="#1F1614" strokeWidth="16" />
              <path d="M0 250H400" stroke="#1F1614" strokeWidth="10" />
              <path d="M150 0V340" stroke="#1F1614" strokeWidth="12" />
              <path d="M300 0V340" stroke="#1F1614" strokeWidth="8" />
              <rect x="30" y="150" width="70" height="60" fill="#171110" />
              <rect x="190" y="30" width="60" height="55" fill="#171110" />
              <rect x="330" y="160" width="55" height="70" fill="#171110" />
            </svg>
            <p className="relative flex flex-col items-center gap-2.5">
              <span className="text-brand">
                <IconPin size={34} />
              </span>
              <span className="rounded-md bg-bg px-2.5 py-1.5 font-[family-name:var(--font-mono)] text-[11.5px] text-ink-3">
                xarita shu yerda bo‘ladi
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- Yakuniy chaqiriq ---------------- */}
      <section className="flex flex-col items-center gap-5 border-t border-line py-14 text-center">
        <h2 className="h-display max-w-[740px] text-[30px] leading-tight text-pretty sm:text-[40px]">
          Birinchi dars bepul. Qolganini o‘zingiz hal qilasiz.
        </h2>
        <p className="max-w-[560px] text-[15.5px] leading-relaxed text-ink-2 text-pretty">
          Yozilib qo‘ying — daraja aniqlaymiz, guruhni tanlaymiz, siz esa bir dars o‘tirib
          ko‘rasiz. Oldindan to‘lov yo‘q.
        </p>
        <Link
          href="/ariza"
          className="inline-flex min-h-14 items-center rounded-[10px] bg-brand text-white px-9 text-base font-bold transition hover:brightness-110"
        >
          Bepul sinov darsiga yozilish
        </Link>
      </section>
    </main>
  )
}

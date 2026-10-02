import Link from 'next/link'
import { MARKAZ, NARX, YONALISHLAR } from '@/lib/markaz'
import { pul } from '@/lib/format'
import { IconAlert, IconPin } from '@/components/icons'
import { Kitoblar } from '@/components/kitoblar'
import { RaqamSanagich } from '@/components/raqam-sanagich'

export const metadata = { alternates: { canonical: '/' } }

export default function Bosh() {
  const yil = new Date().getFullYear() - MARKAZ.tashkilYili

  return (
    <main className="mx-auto max-w-[1260px] px-5 lg:px-8">
      {/* ---------------- Hero ---------------- */}
      <section className="grid items-center gap-10 pt-12 pb-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14 lg:pt-16">
        <div className="flex flex-col gap-7 text-left">
          <p className="lbl sayt-kirish text-brand">
            Toshkent · {MARKAZ.tashkilYili} yildan beri
          </p>
          <h1 className="h-display sayt-kirish text-[40px] leading-[1.02] text-pretty sm:text-[56px] lg:text-[68px]" style={{ '--k': '90ms' } as React.CSSProperties}>
            Biz shunchaki bilim bermaymiz, balki <span className="text-brand">hayotlarni o‘zgartiramiz</span>
          </h1>

          {/* Shiordan keyin DARHOL aniq fakt: guruh kichik, dars qancha,
              birinchisi bepul. Sotuv qoidasi — avval ehtiyoj, keyin narx. */}
          <p
            className="sayt-kirish max-w-[620px] text-[17px] leading-relaxed text-ink-2 text-pretty sm:text-[19px]"
            style={{ '--k': '140ms' } as React.CSSProperties}
          >
            {YONALISHLAR.length} ta yo‘nalish, haftada {MARKAZ.darsHaftada} marta,{' '}
            {MARKAZ.darsDaqiqa} daqiqadan. Bir guruhda{' '}
            <b className="font-semibold text-ink">{MARKAZ.guruhMaksimal} kishidan ortiq bo‘lmaydi</b> —
            ustoz har bolaga yetadi. Birinchi dars va daraja aniqlash bepul.
          </p>

          <div className="sayt-kirish flex flex-wrap items-center gap-3.5 pt-1" style={{ '--k': '180ms' } as React.CSSProperties}>
            <Link
              href="/ariza"
              className="sayt-tugma inline-flex min-h-13 items-center rounded-[10px] bg-brand text-white px-7 text-[15px] font-bold transition hover:brightness-110"
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

          {/* Yozilgandan keyin nima bo'lishini aytib qo'yish — odam
              "endi nima bo'ladi?" deb o'ylab qolmasin. */}
          <p className="sayt-kirish text-[13.5px] text-ink-3" style={{ '--k': '220ms' } as React.CSSProperties}>
            Yozilganingizdan keyin bir ish kuni ichida qo‘ng‘iroq qilamiz va qulay vaqtni kelishamiz.
          </p>
        </div>

        <div className="sayt-kirish w-full" style={{ '--k': '120ms' } as React.CSSProperties}>
          <Kitoblar className="sayt-suzish mx-auto w-full max-w-[480px] lg:max-w-none" />
        </div>
      </section>

      {/* ---------------- Faktlar ---------------- */}
      <section className="sayt-paydo mb-16 grid border-y border-line sm:grid-cols-2 lg:grid-cols-4">
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
              <RaqamSanagich qiymat={f.n} />
            </span>
            <span className="text-[14px] text-ink-2">{f.t}</span>
          </div>
        ))}
      </section>

      {/* ---------------- Kurslar ---------------- */}
      <section id="kurslar" className="sayt-paydo flex flex-col gap-7 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <p className="lbl">Yo‘nalishlar</p>
            <h2 className="h-display text-[30px] sm:text-[34px]">
              Sakkiz yo‘nalish — hammasi noldan
            </h2>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {YONALISHLAR.map((y) => (
            <article
              key={y.id}
              className="group relative flex min-h-[132px] flex-col justify-between gap-6 overflow-hidden rounded-[14px] border border-line bg-surface p-6 transition duration-300 hover:-translate-y-1 hover:border-brand hover:shadow-[0_18px_40px_-18px_var(--color-brand)]"
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-brand transition-transform duration-300 group-hover:scale-x-100"
              />
              <p className="lbl text-[11.5px] text-brand">{y.yorliq}</p>
              <h3 className="font-[family-name:var(--font-display)] text-[21px] font-bold transition-colors group-hover:text-brand">
                {y.nom}
              </h3>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------- Dars qanday o'tadi ---------------- */}
      <section id="dars" className="sayt-paydo flex flex-col gap-7 pb-16">
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
            <ol className="flex flex-col">
              {[
                ['Daraja aniqlash', 'Birinchi kelganda bepul o‘tkaziladi — qaysi guruh mos kelishini shu aniqlaydi.'],
                ['Davomat va baholash', 'Har dars belgilanadi. Qatnashuv va faollik shaxsiy sahifada ko‘rinib turadi.'],
                ['Sertifikat', 'Kursni tugatganga markaz sertifikati beriladi.'],
              ].map(([nom, t], i, hammasi) => (
                <li key={nom} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < hammasi.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute top-8 bottom-0 left-[15px] w-0.5 bg-gradient-to-b from-brand to-line"
                    />
                  )}
                  <span
                    className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 font-[family-name:var(--font-display)] text-[13px] font-bold ${
                      i === 0 ? 'border-brand bg-brand text-white' : 'border-brand bg-surface text-brand'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex flex-col gap-1 pt-1">
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
      <section id="narxlar" className="sayt-paydo flex flex-col gap-7 pb-16">
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
          <article className="sayt-karta flex flex-col gap-3.5 rounded-[14px] border border-line bg-surface p-7">
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

          <article className="sayt-karta flex flex-col gap-3.5 rounded-[14px] border border-line bg-surface p-7">
            <p className="lbl">Ikkinchi oydan</p>
            <p className="flex items-baseline gap-2">
              <span className="h-display tnum text-[36px] leading-none">{pul(NARX.standart)}</span>
              <span className="text-sm text-ink-3">so‘m / oy</span>
            </p>
            <p className="text-[14px] leading-relaxed text-ink-2">
              Standart oylik to‘lov. Haftada {MARKAZ.darsHaftada} dars, bir yarim soatdan.
            </p>
          </article>

          <article className="sayt-karta flex flex-col gap-3.5 rounded-[14px] border border-brand bg-surface p-7">
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

        {/* Narxni ko'rgan odam shu yerda qaror qiladi — tugma shu yerda
            turishi kerak. Oldin butun bo'limda birorta amal yo'q edi. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link
            href="/ariza"
            className="sayt-tugma inline-flex min-h-13 items-center rounded-[10px] bg-brand text-white px-7 text-[15px] font-bold transition hover:brightness-110"
          >
            Bepul sinov darsiga yozilish
          </Link>
          <span className="text-[13.5px] text-ink-3">
            Hozir to‘lov so‘ralmaydi — avval dars, keyin qaror.
          </span>
        </div>
      </section>

      {/* ---------------- Aloqa ---------------- */}
      <section id="aloqa" className="sayt-paydo pb-16">
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
              <div className="flex items-center justify-between gap-3">
                <dt className="lbl inline-flex min-w-[92px] justify-center rounded-full border border-brand-line bg-brand-soft px-3 py-1.5 text-[11px] text-brand">Telefon</dt>
                <dd>
                  <a
                    href={`tel:${MARKAZ.telefonRaw}`}
                    className="inline-flex min-h-11 items-center font-[family-name:var(--font-mono)] text-[15px] hover:text-accent"
                  >
                    {MARKAZ.telefon}
                  </a>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="lbl inline-flex min-w-[92px] justify-center rounded-full border border-brand-line bg-brand-soft px-3 py-1.5 text-[11px] text-brand">Telegram</dt>
                <dd>
                  <a
                    href={MARKAZ.telegram}
                    className="inline-flex min-h-11 items-center font-[family-name:var(--font-mono)] text-[15px] text-accent hover:text-brand"
                  >
                    {MARKAZ.telegramNom}
                  </a>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="lbl inline-flex min-w-[92px] justify-center rounded-full border border-brand-line bg-brand-soft px-3 py-1.5 text-[11px] text-brand">Instagram</dt>
                <dd>
                  <a
                    href={MARKAZ.instagram}
                    className="inline-flex min-h-11 items-center font-[family-name:var(--font-mono)] text-[15px] text-accent hover:text-brand"
                  >
                    {MARKAZ.instagramNom}
                  </a>
                </dd>
              </div>
            </dl>
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

      {/* ---------------- Yakuniy chaqiriq ---------------- */}
      <section className="sayt-paydo flex flex-col items-center gap-5 border-t border-line py-14 text-center">
        <h2 className="h-display max-w-[740px] text-[30px] leading-tight text-pretty sm:text-[40px]">
          Birinchi dars bepul. Qolganini o‘zingiz hal qilasiz.
        </h2>
        <p className="max-w-[560px] text-[15.5px] leading-relaxed text-ink-2 text-pretty">
          Yozilib qo‘ying — daraja aniqlaymiz, guruhni tanlaymiz, siz esa bir dars o‘tirib
          ko‘rasiz. Oldindan to‘lov yo‘q.
        </p>
        <Link
          href="/ariza"
          className="sayt-tugma inline-flex min-h-14 items-center rounded-[10px] bg-brand text-white px-9 text-base font-bold transition hover:brightness-110"
        >
          Bepul sinov darsiga yozilish
        </Link>
      </section>
    </main>
  )
}

import { createHash } from 'node:crypto'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { telefonNormal } from '@/lib/format'
import { KUN_TURLARI, MARKAZ, VAQTLAR, YONALISHLAR, bazadagiYonalish, saytManzil } from '@/lib/markaz'
import { html, xabar, HISOBOT_GURUH } from '@/lib/telegram'
import { arizaIzohi, type ArizaTest } from '@/lib/ariza-izoh'
import { SAVOL_SONI, TEST_FANLAR, testDaraja, testFan, testFoiz } from '@/lib/test-savollar'
import { HaftaIzoh, HaftaQator, VAQT_IKONKA } from '@/components/lending/hafta'

// Bir IP soatiga shuncha arizadan ortiq yubora olmaydi (spam to'sish).
const ARIZA_LIMIT = 5
const ARIZA_OYNA_SEK = 3600

/** So'rovchining IP xeshi. Xom IP saqlanmaydi — faqat rate-limit kaliti. */
async function ipKaliti(): Promise<string> {
  const h = await headers()
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'nomalum'
  return createHash('sha256').update(ip).digest('hex').slice(0, 32)
}

export const metadata = {
  alternates: { canonical: '/ariza' },
  title: 'Bepul sinov darsiga yozilish',
  description:
    'Ism va telefon raqamingizni qoldiring — bir ish kuni ichida qo‘ng‘iroq qilamiz. Oldindan to‘lov yo‘q.',
}

const Ariza = z.object({
  ism: z.string().trim().min(2, 'Ismni kiriting').max(80),
  telefon: z.string().trim().min(7).max(20),
  yonalish: z.string().trim().max(40).optional(),
  izoh: z.string().trim().max(500).optional(),
  // Faqat ro'yxatdagi qiymatlar — boshqasi kelsa ariza rad etilmaydi, maydon bo'sh qoladi
  kun: z.enum(KUN_TURLARI.map((k) => k.id) as [string, ...string[]]).optional().catch(undefined),
  vaqt: z.enum(VAQTLAR.map((v) => v.id) as [string, ...string[]]).optional().catch(undefined),
  // Mini-test natijasi — noto'g'ri kelsa ariza rad etilmaydi, test qatori tushmaydi
  test: z.enum(TEST_FANLAR.map((f) => f.id) as [string, ...string[]]).optional().catch(undefined),
  togri: z.coerce.number().int().min(0).max(SAVOL_SONI).optional().catch(undefined),
})

/** URL yoki formadagi test natijasi → ariza qatori. Daraja shu yerda qayta hisoblanadi. */
function testNatija(id: string | undefined, togri: number | undefined): ArizaTest | undefined {
  const fan = testFan(id)
  if (!fan || togri === undefined || !Number.isInteger(togri) || togri < 0 || togri > SAVOL_SONI) return undefined
  const jami = SAVOL_SONI
  return { fan: fan.nom, togri, jami, foiz: testFoiz(togri, jami), daraja: testDaraja(fan, togri).nom }
}

async function yubor(formData: FormData) {
  'use server'

  // Asal tuzoq — bot to'ldiradi, odam ko'rmaydi
  if (String(formData.get('kompaniya') ?? '')) redirect('/ariza?holat=yuborildi')

  const natija = Ariza.safeParse({
    ism: formData.get('ism'),
    telefon: formData.get('telefon'),
    yonalish: formData.get('yonalish') || undefined,
    izoh: formData.get('izoh') || undefined,
    kun: formData.get('kun') || undefined,
    vaqt: formData.get('vaqt') || undefined,
    test: formData.get('test') || undefined,
    togri: formData.get('togri') || undefined,
  })

  if (!natija.success) redirect('/ariza?holat=xato')

  const tel = telefonNormal(natija.data.telefon)
  if (!tel) redirect('/ariza?holat=telefon')

  const supabase = createAdminClient()

  // Spam to'sish: bir IP soatiga ARIZA_LIMIT martadan ko'p yuborolmaydi.
  // rate_limit_hit false qaytarsa — chegara oshgan. Baza yo'q bo'lsa
  // (rpc xatosi) o'tkazib yuboramiz — ariza yo'qolmasin. redirect() bu
  // yerda try'dan TASHQARIDA: Next uni istisno bilan uzatadi, catch uni
  // yutib yubormasligi kerak.
  let chegaraOshdi = false
  try {
    const { data: ruxsat, error: limitXato } = await supabase.rpc('rate_limit_hit', {
      p_bucket: 'ariza',
      p_kalit: await ipKaliti(),
      p_limit: ARIZA_LIMIT,
      p_oyna_sek: ARIZA_OYNA_SEK,
    })
    chegaraOshdi = !limitXato && ruxsat === false
  } catch {
    chegaraOshdi = false
  }
  if (chegaraOshdi) redirect('/ariza?holat=kop')

  // Bazada hali yo'q yo'nalish (masalan Turk tili) izohga yoziladi — ariza yo'qolmasin.
  const subjectId = bazadagiYonalish(natija.data.yonalish)
  const tashqiNom =
    natija.data.yonalish && !subjectId
      ? YONALISHLAR.find((y) => y.id === natija.data.yonalish)?.nom
      : undefined
  // leads jadvalida kun/vaqt va test ustuni yo'q — izohga belgili qatorlar
  // bilan yoziladi, CRM kartasi ularni ajratib ko'rsatadi (lib/ariza-izoh.ts)
  const kunNom = KUN_TURLARI.find((k) => k.id === natija.data.kun)?.nom
  const vaqtNom = VAQTLAR.find((v) => v.id === natija.data.vaqt)
  const qulay = [kunNom, vaqtNom && `${vaqtNom.nom.toLowerCase()} (${vaqtNom.oraliq})`].filter(Boolean).join(', ')
  const izoh = arizaIzohi({
    yonalish: tashqiNom,
    test: testNatija(natija.data.test, natija.data.togri),
    qulay: qulay || undefined,
    izoh: natija.data.izoh,
  })

  try {
    const { error } = await supabase.from('leads').insert({
      ism: natija.data.ism,
      telefon: tel,
      subject_id: subjectId,
      manba: 'sayt',
      holat: 'yangi',
      izoh,
    })
    if (error) throw error
  } catch {
    // Baza hali ulanmagan bo'lsa ariza yo'qolmasin — xatoni ochiq aytamiz
    redirect('/ariza?holat=nosozlik')
  }

  // Ariza bazada. Hisobot guruhiga xabar javobdan KEYIN ketadi — Telegram
  // sekinlashsa yoki xato bersa ham foydalanuvchi kutmaydi, ariza yo'qolmaydi.
  const d = natija.data
  after(() => arizaXabari({ ism: d.ism, telefon: tel, yonalish: d.yonalish, izoh: izoh ?? undefined }))

  redirect('/ariza?holat=yuborildi')
}

async function arizaXabari(a: { ism: string; telefon: string; yonalish?: string; izoh?: string }) {
  const yonalish = YONALISHLAR.find((y) => y.id === a.yonalish)?.nom ?? 'tanlanmagan'
  const qatorlar = [
    '<b>[SAYT · wbalc.uz] YANGI ARIZA</b>',
    'Bu xabar saytdagi ariza formasidan — Sheets hisoboti emas.',
    '',
    `Ism: <b>${html(a.ism)}</b>`,
    `Telefon: ${html(a.telefon)}`,
    `Yo‘nalish: ${html(yonalish)}`,
    ...(a.izoh ? [`Izoh: ${html(a.izoh)}`] : []),
    '',
    `Probniylar: ${saytManzil()}/crm/probniylar`,
  ]
  const r = await xabar(Number(HISOBOT_GURUH), qatorlar.join('\n'))
  if (!r.ok) console.error('[ariza] guruhga xabar ketmadi', r.error_code, r.description)
}

export default async function ArizaSahifasi({
  searchParams,
}: {
  searchParams: Promise<{ holat?: string; yonalish?: string; kun?: string; vaqt?: string; test?: string; togri?: string }>
}) {
  const { holat, yonalish, kun, vaqt, test, togri } = await searchParams
  // Mini-testdan kelganda natija formada ko'rinadi va yashirin maydon bilan yuboriladi
  const tanTest = testNatija(test, togri === undefined ? undefined : Number(togri))
  // Bosh sahifadagi "qulay vaqt" tanlovidan kelganda — oldindan tanlangan
  const tanKun = KUN_TURLARI.some((k) => k.id === kun) ? kun : ''
  const tanVaqt = VAQTLAR.some((v) => v.id === vaqt) ? vaqt : ''
  // Bosh sahifadagi kurs kartasidan kelganda yo'nalish oldindan tanlangan bo'lsin.
  // Faqat ro'yxatdagi id qabul qilinadi — URL'dagi boshqa qiymat e'tiborsiz.
  const tanlangan = YONALISHLAR.some((y) => y.id === yonalish) ? yonalish : ''

  if (holat === 'yuborildi') {
    return (
      <main className="mx-auto flex max-w-[620px] flex-col items-center gap-6 px-5 py-24 text-center lg:px-8">
        <span className="flex size-14 items-center justify-center rounded-full bg-ok-soft">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-ok)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h1 className="h-display text-[30px]">Arizangiz qabul qilindi</h1>
        <p className="text-[16px] leading-relaxed text-ink-2 text-pretty">
          Bir ish kuni ichida qo‘ng‘iroq qilamiz — darajani aniqlab, qulay vaqtni kelishamiz.
          Shoshilinch bo‘lsa, o‘zingiz ham qo‘ng‘iroq qilishingiz mumkin:{' '}
          <a href={`tel:${MARKAZ.telefonRaw}`} className="font-[family-name:var(--font-mono)] text-accent">
            {MARKAZ.telefon}
          </a>
        </p>
        <Link href="/" className="text-[14px] text-ink-3 hover:text-ink">
          ← Bosh sahifaga
        </Link>
      </main>
    )
  }

  const xatoMatn =
    holat === 'telefon'
      ? 'Telefon raqamni tekshiring — masalan, 99 009 90 05.'
      : holat === 'nosozlik'
        ? `Texnik nosozlik: ariza saqlanmadi. Iltimos, ${MARKAZ.telefon} raqamiga qo‘ng‘iroq qiling.`
        : holat === 'kop'
          ? `Juda ko‘p ariza yuborildi. Biroz kuting yoki ${MARKAZ.telefon} raqamiga qo‘ng‘iroq qiling.`
          : holat === 'xato'
            ? 'Ism va telefon raqamni to‘liq kiriting.'
            : null

  return (
    <main className="mx-auto grid max-w-[1060px] gap-10 px-5 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 lg:px-8 lg:py-20">
      <div className="flex flex-col gap-6">
        <p className="lbl text-brand">Bepul sinov darsi</p>
        <h1 className="h-display text-[34px] leading-[1.08] text-pretty sm:text-[42px]">
          Ism va telefon — boshqa hech narsa kerak emas
        </h1>
        <p className="text-[16px] leading-relaxed text-ink-2 text-pretty">
          Qo‘ng‘iroq qilib darajani aniqlaymiz, mos guruhni topamiz va bir darsga taklif qilamiz.
          Dars yoqsa — o‘shanda to‘laysiz. Oldindan to‘lov yo‘q.
        </p>

        <ul className="flex flex-col gap-3 border-t border-line pt-6">
          {[
            'Daraja aniqlash bepul',
            `Guruhda ${MARKAZ.guruhMaksimal} kishidan ortiq emas`,
            'Birinchi oy tanishuv narxida',
          ].map((t) => (
            <li key={t} className="flex items-center gap-3 text-[14.5px] text-ink-2">
              <span className="block size-1.5 shrink-0 rounded-full bg-brand" />
              {t}
            </li>
          ))}
        </ul>
      </div>

      <form action={yubor} className="flex flex-col gap-4 rounded-[14px] border border-line bg-surface p-6 lg:p-8">
        {xatoMatn && (
          <p role="alert" className="rounded-[10px] border border-brand bg-brand-soft px-4 py-3 text-[13px]">
            {xatoMatn}
          </p>
        )}

        {tanTest && (
          <div className="flex items-center gap-4 rounded-[14px] border border-brand bg-brand-soft p-4">
            <span className="h-display tnum flex size-14 shrink-0 items-center justify-center rounded-full bg-brand text-[17px] text-white">
              {tanTest.foiz}%
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="lbl text-brand">Test natijangiz · {tanTest.fan}</span>
              <span className="text-[15px] font-bold" translate="no">{tanTest.daraja}</span>
              <span className="text-[12.5px] text-ink-3">
                {tanTest.togri} / {tanTest.jami} to‘g‘ri · arizaga qo‘shiladi
              </span>
            </span>
            <input type="hidden" name="test" value={test} />
            <input type="hidden" name="togri" value={tanTest.togri} />
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="lbl">Ism</span>
          <input
            name="ism"
            required
            maxLength={80}
            autoComplete="name"
            placeholder="Ismingiz"
            className="min-h-12 rounded-[9px] border border-line bg-bg px-3.5 text-[16px] sm:text-[14.5px] placeholder:text-ink-4"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="lbl">Telefon</span>
          <input
            name="telefon"
            type="tel"
            required
            autoComplete="tel"
            placeholder="99 009 90 05"
            className="min-h-12 rounded-[9px] border border-line bg-bg px-3.5 font-[family-name:var(--font-mono)] text-[16px] sm:text-[14.5px] placeholder:text-ink-4"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="lbl">Qaysi yo‘nalish</span>
          <select
            name="yonalish"
            defaultValue={tanlangan}
            className="min-h-12 rounded-[9px] border border-line bg-bg px-3 text-[16px] sm:text-[14.5px]"
          >
            <option value="">Hali tanlamaganman</option>
            {YONALISHLAR.map((y) => (
              <option key={y.id} value={y.id}>
                {y.nom}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="lbl mb-1.5">Qulay kunlar</legend>
          <div className="grid gap-2">
            {KUN_TURLARI.map((k) => (
              <label
                key={k.id}
                className="group flex cursor-pointer flex-col gap-3 rounded-[14px] border border-line bg-bg p-4 transition hover:border-ink-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
              >
                <input type="radio" name="kun" value={k.id} defaultChecked={tanKun === k.id} className="sr-only" />
                <span className="flex items-center gap-3">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-bold">{k.nom}</span>
                    <span className="text-[12.5px] text-ink-3">
                      {k.support.length
                        ? `${k.kunlar.length} kun dars + ${k.support.length} kun support`
                        : `Dars: ${k.kunlar.join(', ')} · support kelishiladi`}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-line transition group-has-[:checked]:border-brand group-has-[:checked]:bg-brand"
                  >
                    <span className="size-1.5 rounded-full bg-white opacity-0 transition group-has-[:checked]:opacity-100" />
                  </span>
                </span>
                <HaftaQator kun={k.id} kichik />
              </label>
            ))}
          </div>
          <HaftaIzoh />
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="lbl mb-1.5">Qulay vaqt</legend>
          <div className="grid grid-cols-3 gap-2">
            {VAQTLAR.map((v) => (
              <label
                key={v.id}
                className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[14px] border border-line bg-bg px-2 py-3 text-center transition hover:border-ink-3 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-bg has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
              >
                <input type="radio" name="vaqt" value={v.id} defaultChecked={tanVaqt === v.id} className="sr-only" />
                <span className="text-brand">{VAQT_IKONKA[v.id]}</span>
                <span className="text-[14px] font-bold">{v.nom}</span>
                <span className="tnum text-[11.5px] opacity-70">{v.oraliq}</span>
              </label>
            ))}
          </div>
          <p className="text-[12.5px] text-ink-3">Tanlamasangiz — qo‘ng‘iroqda kelishamiz.</p>
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="lbl">Qo‘shimcha (ixtiyoriy)</span>
          <textarea
            name="izoh"
            rows={3}
            maxLength={500}
            placeholder="Masalan: 2-sinf, darajam boshlang‘ich"
            className="resize-y rounded-[9px] border border-line bg-bg p-3.5 text-[16px] sm:text-[14.5px] placeholder:text-ink-4"
          />
        </label>

        {/* Asal tuzoq */}
        <input
          type="text"
          name="kompaniya"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] size-0"
        />

        <button
          type="submit"
          className="mt-1 min-h-13 rounded-[10px] bg-brand text-white text-[15px] font-bold transition hover:brightness-110"
        >
          Yuborish
        </button>

        <p className="text-center text-[12.5px] text-ink-3">
          Raqamingiz faqat shu ariza uchun ishlatiladi.
        </p>
      </form>
    </main>
  )
}

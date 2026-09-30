import { createHash } from 'node:crypto'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { telefonNormal } from '@/lib/format'
import { MARKAZ, YONALISHLAR, saytManzil } from '@/lib/markaz'
import { html, xabar, HISOBOT_GURUH } from '@/lib/telegram'

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
})

async function yubor(formData: FormData) {
  'use server'

  // Asal tuzoq — bot to'ldiradi, odam ko'rmaydi
  if (String(formData.get('kompaniya') ?? '')) redirect('/ariza?holat=yuborildi')

  const natija = Ariza.safeParse({
    ism: formData.get('ism'),
    telefon: formData.get('telefon'),
    yonalish: formData.get('yonalish') || undefined,
    izoh: formData.get('izoh') || undefined,
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

  try {
    const { error } = await supabase.from('leads').insert({
      ism: natija.data.ism,
      telefon: tel,
      subject_id: natija.data.yonalish || null,
      manba: 'sayt',
      holat: 'yangi',
      izoh: natija.data.izoh || null,
    })
    if (error) throw error
  } catch {
    // Baza hali ulanmagan bo'lsa ariza yo'qolmasin — xatoni ochiq aytamiz
    redirect('/ariza?holat=nosozlik')
  }

  // Ariza bazada. Hisobot guruhiga xabar javobdan KEYIN ketadi — Telegram
  // sekinlashsa yoki xato bersa ham foydalanuvchi kutmaydi, ariza yo'qolmaydi.
  const d = natija.data
  after(() => arizaXabari({ ism: d.ism, telefon: tel, yonalish: d.yonalish, izoh: d.izoh }))

  redirect('/ariza?holat=yuborildi')
}

async function arizaXabari(a: { ism: string; telefon: string; yonalish?: string; izoh?: string }) {
  const yonalish = YONALISHLAR.find((y) => y.id === a.yonalish)?.nom ?? 'tanlanmagan'
  const qatorlar = [
    '<b>YANGI ARIZA</b> (sayt)',
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
  searchParams: Promise<{ holat?: string }>
}) {
  const { holat } = await searchParams

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

        <label className="flex flex-col gap-1.5">
          <span className="lbl">Ism</span>
          <input
            name="ism"
            required
            maxLength={80}
            autoComplete="name"
            placeholder="Ismingiz"
            className="min-h-12 rounded-[9px] border border-line bg-bg px-3.5 text-[14.5px] placeholder:text-ink-4"
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
            className="min-h-12 rounded-[9px] border border-line bg-bg px-3.5 font-[family-name:var(--font-mono)] text-[14.5px] placeholder:text-ink-4"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="lbl">Qaysi yo‘nalish</span>
          <select
            name="yonalish"
            defaultValue=""
            className="min-h-12 rounded-[9px] border border-line bg-bg px-3 text-[14.5px]"
          >
            <option value="">Hali tanlamaganman</option>
            {YONALISHLAR.map((y) => (
              <option key={y.id} value={y.id}>
                {y.nom}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="lbl">Qo‘shimcha (ixtiyoriy)</span>
          <textarea
            name="izoh"
            rows={3}
            maxLength={500}
            placeholder="Masalan: kechqurungi guruh qulay"
            className="resize-y rounded-[9px] border border-line bg-bg p-3.5 text-[14.5px] placeholder:text-ink-4"
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

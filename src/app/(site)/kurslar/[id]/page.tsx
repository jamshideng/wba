import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MARKAZ, NARX, YONALISHLAR } from '@/lib/markaz'
import { JsonLd } from '@/components/json-ld'
import { kursSchema, nonKroshkaSchema, kursSarlavha } from '@/lib/seo'

/**
 * Har yo'nalishning alohida sahifasi — "ingliz tili kursi Toshkent" kabi
 * qidiruvga bosh sahifa emas, aynan shu sahifa chiqsin. Matn faqat markaz.ts
 * dagi faktlardan; yangi da'vo qo'shilmaydi. Statik quriladi.
 */
export const dynamicParams = false

export function generateStaticParams() {
  return YONALISHLAR.map((y) => ({ id: y.id }))
}

function topish(id: string) {
  return YONALISHLAR.find((y) => y.id === id)
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const y = topish(id)
  if (!y) return {}
  const tavsif = `${y.qisqa_tavsif} ${y.yosh_chegarasi[0].toUpperCase()}${y.yosh_chegarasi.slice(1)} uchun. Guruhda ${MARKAZ.guruhMaksimal} kishidan ortiq emas, birinchi dars bepul.`
  return {
    title: kursSarlavha(y),
    description: tavsif,
    alternates: { canonical: `/kurslar/${y.id}` },
    openGraph: { title: `${kursSarlavha(y)} · ${MARKAZ.nom}`, description: tavsif, url: `/kurslar/${y.id}` },
  }
}

function som(n: number): string {
  return n.toLocaleString('ru-RU').replace(/ /g, ' ')
}

export default async function KursSahifa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const y = topish(id)
  if (!y) notFound()

  const boshqalar = YONALISHLAR.filter((v) => v.id !== y.id)

  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-10 px-4 py-10 sm:px-5 sm:py-14 lg:px-8">
      <JsonLd data={[...kursSchema(y), nonKroshkaSchema([{ nom: 'Kurslar', yol: '/#kurslar' }, { nom: y.nom, yol: `/kurslar/${y.id}` }])]} />

      <nav aria-label="Yo‘l" className="text-[14px] text-ink-3">
        <Link href="/" className="inline-flex min-h-11 items-center hover:text-ink">
          Bosh sahifa
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href="/#kurslar" className="inline-flex min-h-11 items-center hover:text-ink">
          Kurslar
        </Link>
      </nav>

      <section className="flex flex-col gap-5">
        <p className="lbl text-brand">{y.yorliq}</p>
        <h1 className="h-display text-[40px] leading-[1] sm:text-[60px]">{kursSarlavha(y)}</h1>
        <p className="max-w-[60ch] text-[18px] leading-relaxed text-ink-2">{y.qisqa_tavsif}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Kimlar uchun', y.yosh_chegarasi],
          ['Guruh', `${MARKAZ.guruhMaksimal} kishigacha`],
          ['Dars tartibi', `haftada ${MARKAZ.darsHaftada} kun × ${MARKAZ.darsDaqiqa} daqiqa + ${MARKAZ.supportHaftada} kun amaliyot`],
          ['Narx', `oyiga ${som(NARX.standart)} so‘m, birinchi oy ${som(NARX.tanishuvOyi)} so‘m`],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-2 rounded-[20px] border border-line p-5">
            <span className="lbl text-ink-3">{k}</span>
            <span className="text-[16px] font-bold leading-snug">{v}</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4 rounded-[24px] border border-line p-6 sm:p-8">
        <h2 className="h-display text-[28px]">Birinchi dars bepul</h2>
        <p className="max-w-[60ch] text-[16px] leading-relaxed text-ink-2">
          Sinov darsi va daraja aniqlash bepul. Ism va telefon qoldiring — bir ish kuni ichida qo‘ng‘iroq qilamiz.
          Manzil: {MARKAZ.manzil}. Telefon:{' '}
          <a href={`tel:${MARKAZ.telefonRaw}`} className="font-bold text-ink underline underline-offset-4">
            {MARKAZ.telefon}
          </a>
          .
        </p>
        <Link
          href={`/ariza?yonalish=${y.id}`}
          className="sayt-tugma inline-flex min-h-14 w-fit items-center rounded-full bg-brand px-7 text-[15.5px] font-bold text-white transition hover:brightness-110"
        >
          Bepul sinov darsiga yozilish
        </Link>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="h-display text-[28px]">Boshqa yo‘nalishlar</h2>
        <ul className="flex flex-wrap gap-2">
          {boshqalar.map((v) => (
            <li key={v.id}>
              <Link
                href={`/kurslar/${v.id}`}
                className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-[14px] text-ink-2 hover:border-ink hover:text-ink"
              >
                {v.nom}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MARKAZ } from '@/lib/markaz'
import { ommaviyUstozlar, rasmHavola, hujjatHavolalari, tajribaMatn } from '@/lib/ustoz-ommaviy'
import { DARAJA_NOMI } from '@/lib/ustoz-profil'

/* Ustoz sahifasi (0126) — faqat admin yoqqan va manager tasdiqlagan nusxa */
export const revalidate = 300

function sana(s: string | null | undefined): string | null {
  if (!s) return null
  const [y, m, d] = s.split('-')
  return d ? `${d}/${m}/${y}` : `${m}/${y}`
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const [u] = await ommaviyUstozlar(slug)
  if (!u) return { title: 'Ustoz topilmadi' }
  const sert = u.sertifikatlar?.[0]
  const tavsif = [u.fanlar?.join(', '), sert ? `${sert.turi}${sert.ball ? ' ' + sert.ball : ''}` : null, tajribaMatn(u.dars_boshlagan_yil)]
    .filter(Boolean)
    .join(' · ')
  return {
    title: `${u.ism} — ustoz`,
    description: tavsif || `${MARKAZ.nom} ustozi`,
    alternates: { canonical: `/ustozlar/${slug}` },
    openGraph: u.rasm_yol ? { images: [rasmHavola(u.rasm_yol)] } : undefined,
  }
}

export default async function UstozSahifa({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [u] = await ommaviyUstozlar(slug)
  if (!u) notFound()

  const fayllar = [...(u.sertifikatlar ?? []), ...(u.yutuqlar ?? [])].map((x) => x.fayl_yol).filter((x): x is string => Boolean(x))
  const havola = await hujjatHavolalari(fayllar)
  const tajriba = tajribaMatn(u.dars_boshlagan_yil)

  return (
    <main id="asosiy" className="mx-auto flex w-full max-w-[1100px] flex-col gap-10 px-4 py-10 sm:px-5 sm:py-14 lg:px-8">
      <Link href="/#ustozlar" className="inline-flex min-h-11 w-fit items-center text-[14px] text-ink-3 hover:text-ink">
        ← Barcha ustozlar
      </Link>

      <section className="grid gap-8 md:grid-cols-[320px_minmax(0,1fr)] md:items-start">
        <div className="overflow-hidden rounded-[24px] border border-line bg-surface-2">
          {u.rasm_yol ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={rasmHavola(u.rasm_yol)} alt={u.ism} className="aspect-[4/5] w-full object-cover" />
          ) : (
            <span className="flex aspect-[4/5] w-full items-center justify-center font-[family-name:var(--font-display)] text-[96px] font-bold text-ink-4">
              {u.ism.slice(0, 1)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-5">
          <p className="lbl text-brand">Ustoz</p>
          <h1 className="h-display text-[40px] leading-[1] sm:text-[56px]">{u.ism}</h1>
          <div className="flex flex-wrap gap-2">
            {u.fanlar?.map((f) => (
              <span key={f} className="rounded-full border border-line px-4 py-1.5 text-[14px] font-semibold">
                {f}
              </span>
            ))}
            {tajriba && <span className="rounded-full bg-surface-2 px-4 py-1.5 text-[14px] text-ink-2">{tajriba}</span>}
          </div>
          {u.tavsif && <p className="max-w-[60ch] whitespace-pre-line text-[16px] leading-relaxed text-ink-2">{u.tavsif}</p>}
          {u.tillar?.length ? <p className="text-[14px] text-ink-3">Tillar: {u.tillar.join(', ')}</p> : null}
          <Link href="/ariza" className="inline-flex min-h-14 w-fit items-center rounded-full bg-brand px-7 text-[15.5px] font-bold text-white">
            Bepul sinov darsiga yozilish
          </Link>
        </div>
      </section>

      {u.sertifikatlar?.length ? (
        <section className="flex flex-col gap-4">
          <h2 className="h-display text-[28px]">Sertifikatlar</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {u.sertifikatlar.map((s) => (
              <article key={s.id} className="flex flex-col gap-1 rounded-[18px] border border-line bg-surface px-5 py-4">
                <span className="text-[20px] font-bold">
                  {s.turi}
                  {s.ball && <span className="text-brand"> {s.ball}</span>}
                </span>
                <span className="text-[13.5px] text-ink-3">
                  {[s.qayerda, sana(s.sana), s.muddat ? `${sana(s.muddat)} gacha amal qiladi` : null].filter(Boolean).join(' · ')}
                </span>
                {s.fayl_yol && havola[s.fayl_yol] && (
                  <a href={havola[s.fayl_yol]} target="_blank" rel="noreferrer" className="mt-1 w-fit text-[13.5px] text-accent underline underline-offset-2">
                    Sertifikat nusxasi
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {u.yutuqlar?.length ? (
        <section className="flex flex-col gap-4">
          <h2 className="h-display text-[28px]">Yutuqlar</h2>
          <ul className="flex flex-col gap-3">
            {u.yutuqlar.map((y) => (
              <li key={y.id} className="flex flex-col gap-1 rounded-[18px] border border-line bg-surface px-5 py-4">
                <span className="text-[16px] font-bold">{y.nomi}</span>
                {(y.izoh || y.sana) && <span className="text-[13.5px] text-ink-3">{[sana(y.sana), y.izoh].filter(Boolean).join(' · ')}</span>}
                {y.fayl_yol && havola[y.fayl_yol] && (
                  <a href={havola[y.fayl_yol]} target="_blank" rel="noreferrer" className="w-fit text-[13.5px] text-accent underline underline-offset-2">
                    Ko‘rish
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {u.talim?.length ? (
        <section className="flex flex-col gap-4">
          <h2 className="h-display text-[28px]">Ta’lim</h2>
          <ul className="flex flex-col gap-3">
            {u.talim.map((t) => (
              <li key={t.id} className="flex flex-col gap-0.5 rounded-[18px] border border-line bg-surface px-5 py-4">
                <span className="text-[16px] font-bold">{t.otm}</span>
                <span className="text-[13.5px] text-ink-3">
                  {[t.yonalish, t.daraja ? DARAJA_NOMI[t.daraja] : null, `${t.dan_yil ?? ''}–${t.oqiyapti ? 'hozir' : (t.gacha_yil ?? '')}`].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}

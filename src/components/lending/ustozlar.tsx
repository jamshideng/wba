import Link from 'next/link'
import { ommaviyUstozlar, rasmHavola, tajribaMatn } from '@/lib/ustoz-ommaviy'

/**
 * Bosh sahifa "Ustozlarimiz" (0126). Admin hech kimni yoqmagan bo'lsa —
 * bo'lim umuman chiqmaydi. Kartada: rasm, ism, fanlar, eng yaxshi sertifikat, tajriba.
 */
export async function Ustozlarimiz({ sarlavha }: { sarlavha: React.ReactNode }) {
  const ustozlar = await ommaviyUstozlar()
  if (ustozlar.length === 0) return null
  return (
    <section id="ustozlar" className="flex flex-col gap-8 py-14 sm:gap-10 sm:py-20">
      {sarlavha}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ustozlar.map((u) => {
          const sert = u.sertifikatlar?.[0]
          const tajriba = tajribaMatn(u.dars_boshlagan_yil)
          return (
            <Link
              key={u.slug}
              href={`/ustozlar/${u.slug}`}
              data-ochil
              className="group flex flex-col overflow-hidden rounded-[22px] border border-line bg-surface transition hover:-translate-y-1 hover:border-brand"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
                {u.rasm_yol ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={rasmHavola(u.rasm_yol)} alt={u.ism} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                ) : (
                  <span className="flex size-full items-center justify-center font-[family-name:var(--font-display)] text-[64px] font-bold text-ink-4">
                    {u.ism.slice(0, 1)}
                  </span>
                )}
                {sert && (
                  <span className="absolute bottom-3 left-3 rounded-full bg-brand px-3 py-1 text-[13px] font-bold text-white">
                    {sert.turi}{sert.ball ? ` ${sert.ball}` : ''}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1 px-5 py-4">
                <span className="text-[18px] font-bold">{u.ism}</span>
                {u.fanlar?.length ? <span className="text-[14px] text-ink-2">{u.fanlar.join(' · ')}</span> : null}
                {tajriba && <span className="text-[13px] text-ink-3">{tajriba}</span>}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

import Link from 'next/link'
import { Card, CardHeader, Empty } from '@/components/ui'
import { ChiziqGrafik, HalqaGrafik, MaydonGrafik, Sparkline, UstunGrafik } from '@/components/grafiklar'
import { RANG } from '@/lib/grafik-rang'
import { davrQisqa, pul } from '@/lib/format'
import type { Hisobot, HisobotGrafik } from '@/lib/types'

const USUL_NOMI: Record<string, string> = {
  naqd: 'Naqd', karta: 'Karta', click: 'Click', payme: 'Payme', aniqlanmagan: 'Aniqlanmagan',
}

const kunOy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`
const foiz = (a: number, b: number) => (b > 0 ? (a * 100) / b : null)

/** O'tgan xuddi shunday davrga nisbatan o'zgarish */
function Trend({ joriy, oldingi, birlik = '%', teskari = false }: { joriy: number | null; oldingi: number | null; birlik?: '%' | 'pp'; teskari?: boolean }) {
  if (joriy === null || oldingi === null) return null
  let d: number | null
  if (birlik === 'pp') d = joriy - oldingi
  else d = oldingi > 0 ? ((joriy - oldingi) / oldingi) * 100 : null
  if (d === null) return <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-3">yangi</span>
  const yaxshi = teskari ? d < 0 : d > 0
  const nol = Math.abs(d) < 0.05
  return (
    <span
      title="O‘tgan xuddi shunday davrga nisbatan"
      className={`tnum rounded-md px-1.5 py-0.5 text-[11px] font-bold ${nol ? 'bg-surface-2 text-ink-3' : yaxshi ? 'bg-ok-soft text-ok' : 'bg-brand-soft text-brand'}`}
    >
      {nol ? '—' : d > 0 ? '↗' : '↘'} {d > 0 ? '+' : ''}{d.toFixed(1)}{birlik === 'pp' ? ' p.p.' : '%'}
    </span>
  )
}

function Kpi({
  nom, qiymat, birlik, trend, seriya, rang, href,
}: { nom: string; qiymat: string; birlik?: string; trend?: React.ReactNode; seriya?: number[]; rang?: string; href?: string }) {
  const ichi = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="lbl">{nom}</span>
        {trend}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="tnum font-[family-name:var(--font-display)] text-[26px] leading-none font-extrabold tracking-[-0.02em]">{qiymat}</span>
        {birlik && <span className="text-[12px] text-ink-3">{birlik}</span>}
      </span>
      {seriya && <Sparkline qiymatlar={seriya} rang={rang} />}
    </>
  )
  const klass = 'flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface px-4 pt-4 pb-1 transition'
  return href ? <Link href={href} className={`${klass} hover:border-ink-3`}>{ichi}</Link> : <div className={`${klass} pb-4`}>{ichi}</div>
}

export function UmumiyBolim({ h, g, oylar }: { h: Hisobot; g: HisobotGrafik; oylar: { davr: string; tushum: number }[] }) {
  const kun = g.kunlar
  const davJ = foiz(g.joriy.kelgan, g.joriy.belgi)
  const davO = foiz(g.oldingi.kelgan, g.oldingi.belgi)
  const davKun = kun.filter((k) => k.belgi > 0).map((k) => ({ x: kunOy(k.sana), davomat: Math.round((k.kelgan * 100) / k.belgi) }))
  const usullar = h.usul.map((u) => ({ nom: USUL_NOMI[u.nom] ?? u.nom, qiymat: Number(u.summa) }))

  return (
    <>
      {/* Ko'rsatkichlar — LevelUp kabi: kichik grafik + o'tgan davrga nisbatan % */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          nom="Tushum"
          qiymat={`${(Number(g.joriy.tushum) / 1_000_000).toFixed(1)}M`}
          birlik="so‘m"
          trend={<Trend joriy={Number(g.joriy.tushum)} oldingi={Number(g.oldingi.tushum)} />}
          seriya={kun.map((k) => Number(k.tushum))}
          rang={RANG.ok}
        />
        <Kpi
          nom="Davomat"
          qiymat={davJ === null ? '—' : `${davJ.toFixed(1)}%`}
          trend={<Trend joriy={davJ} oldingi={davO} birlik="pp" />}
          seriya={davKun.map((d) => d.davomat)}
          rang={RANG.ink3}
        />
        <Kpi
          nom="Yangi yozilishlar"
          qiymat={String(g.joriy.yangi)}
          trend={<Trend joriy={g.joriy.yangi} oldingi={g.oldingi.yangi} />}
          seriya={kun.map((k) => k.yangi)}
          rang={RANG.ok}
        />
        <Kpi
          nom="Qarzdorlar"
          qiymat={String(g.qarzdorlar)}
          birlik="o‘quvchi"
          href="/crm/qarzdorlar"
          trend={<span className="text-[11px] text-ink-3">hozir</span>}
          seriya={undefined}
        />
      </div>

      {(Number(h.tasdiqlanmagan) > 0 || h.darslar.qilinmagan > 0) && (
        <div className="flex flex-wrap gap-2.5">
          {Number(h.tasdiqlanmagan) > 0 && (
            <Link href="/crm/tolovlar?filtr=tasdiqlanmagan" className="rounded-[10px] border border-accent-line bg-accent-soft px-3.5 py-2 text-[12.5px] text-ink hover:brightness-95">
              Tasdiq kutmoqda: <b>{pul(h.tasdiqlanmagan)} so‘m</b>
            </Link>
          )}
          {h.darslar.qilinmagan > 0 && (
            <span className="rounded-[10px] border border-brand/30 bg-brand-soft px-3.5 py-2 text-[12.5px] text-ink">
              Davomat qilinmagan: <b>{h.darslar.qilinmagan}</b> / {h.darslar.kutilgan} dars
            </span>
          )}
        </div>
      )}

      {/* Asosiy grafik — kunlik tushum */}
      <Card className="flex flex-col gap-1 px-5 pt-5 pb-3">
        <span className="lbl">Tushum · kunlar bo‘yicha</span>
        <span className="flex flex-wrap items-baseline gap-2.5">
          <span className="tnum font-[family-name:var(--font-display)] text-[34px] leading-tight font-extrabold tracking-[-0.02em]">{pul(g.joriy.tushum)}</span>
          <span className="text-[14px] text-ink-3">so‘m</span>
          <Trend joriy={Number(g.joriy.tushum)} oldingi={Number(g.oldingi.tushum)} />
          <span className="text-[12px] text-ink-3">{g.joriy.tolov} ta to‘lov · o‘tgan davrga nisbatan</span>
        </span>
        {kun.length > 1 ? (
          <MaydonGrafik data={kun.map((k) => ({ x: kunOy(k.sana), y: Number(k.tushum) }))} nom="Tushum" />
        ) : (
          <p className="py-6 text-[13px] text-ink-3">Grafik uchun kamida 2 kunlik oraliq tanlang.</p>
        )}
      </Card>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className="flex flex-col">
          <CardHeader title="Davomat · kunlar bo‘yicha" meta={davJ === null ? undefined : `o‘rtacha ${davJ.toFixed(1)}%`} />
          <div className="px-3 pb-4">
            {davKun.length === 0 ? (
              <div className="px-2"><Empty>Bu oraliqda davomat yo‘q.</Empty></div>
            ) : (
              <ChiziqGrafik data={davKun} seriyalar={[{ kalit: 'davomat', nom: 'Davomat', rang: RANG.ok }]} format="foiz" />
            )}
          </div>
        </Card>
        <Card className="flex flex-col">
          <CardHeader title="To‘lov usullari" meta="ulush" />
          <div className="px-5 pb-5">
            {usullar.length === 0 ? <Empty>Bu oraliqda to‘lov yo‘q.</Empty> : <HalqaGrafik data={usullar} />}
          </div>
        </Card>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader title="Eng ko‘p tushum — guruhlar" meta="tanlangan oraliqda" />
          <div className="px-3 pb-4">
            {g.guruhlar.length === 0 ? (
              <div className="px-2"><Empty>Bu oraliqda to‘lov yo‘q.</Empty></div>
            ) : (
              <UstunGrafik
                gorizontal
                balandlik={Math.max(160, g.guruhlar.length * 38)}
                data={g.guruhlar.map((x) => ({ x: x.nom.split(', ')[0].split(' · ').filter((_, i) => i !== 2).join(' · '), tushum: Number(x.tushum) }))}
                seriyalar={[{ kalit: 'tushum', nom: 'Tushum', rang: RANG.brand }]}
              />
            )}
          </div>
        </Card>
        <Card className="flex flex-col">
          <CardHeader title="Ustozlar bo‘yicha tushum" meta={<Link href="/crm/hisobotlar?bolim=ustozlar" className="text-accent hover:text-brand">Batafsil →</Link>} />
          <div className="px-3 pb-4">
            {h.ustoz.length === 0 ? (
              <div className="px-2"><Empty>Bu oraliqda to‘lov yo‘q.</Empty></div>
            ) : (
              <UstunGrafik
                gorizontal
                balandlik={Math.max(160, h.ustoz.length * 38)}
                data={h.ustoz.map((u) => ({ x: u.nom === '—' ? 'Guruhga bog‘lanmagan' : u.nom, tushum: Number(u.summa) }))}
                seriyalar={[{ kalit: 'tushum', nom: 'Tushum', rang: RANG.accent }]}
              />
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader title="Oylar bo‘yicha tushum" meta="to‘lov qaysi oy uchun · oxirgi 12 oy" />
          <div className="px-3 pb-4">
            {oylar.length === 0 ? (
              <div className="px-2"><Empty>Hali to‘lov yo‘q.</Empty></div>
            ) : (
              <UstunGrafik data={oylar.map((m) => ({ x: davrQisqa(m.davr), tushum: Number(m.tushum) }))} seriyalar={[{ kalit: 'tushum', nom: 'Tushum', rang: RANG.brand }]} />
            )}
          </div>
        </Card>
        <Card className="flex flex-col">
          <CardHeader title="Probniylar" meta="shu oraliqda yozilgan" />
          <div className="grid grid-cols-2 gap-3 px-5 pb-2 sm:grid-cols-4">
            {([['Jami', h.probniy.jami], ['Doimiy', h.probniy.yozildi], ['Kelmadi', h.probniy.kelmadi], ['Rad etdi', h.probniy.rad]] as const).map(([nom, son]) => (
              <span key={nom} className="flex flex-col gap-1">
                <span className="lbl">{nom}</span>
                <span className="tnum font-[family-name:var(--font-display)] text-[22px] font-bold">{son}</span>
              </span>
            ))}
          </div>
          <p className="px-5 pb-4 text-[12px] text-ink-3">
            {h.probniy.kutilmoqda} tasi hali kutilmoqda.
            {h.probniy.jami > 0 && <> Doimiyga o‘tish: <b>{Math.round((h.probniy.yozildi * 100) / h.probniy.jami)}%</b>.</>}
          </p>
        </Card>
      </div>
    </>
  )
}

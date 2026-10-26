import Link from 'next/link'
import { Card, CardHeader, Stat, BarRow, Empty } from '@/components/ui'
import { ChiziqGrafik, UstunGrafik as Ustunlar } from '@/components/grafiklar'
import { RANG } from '@/lib/grafik-rang'
import { pul, davrNomi, davrQisqa, sanaQisqa } from '@/lib/format'
import type { HisobotDavomat, HisobotIlova, HisobotMoliya, HisobotOquvchilar, HisobotOrtacha, HisobotUstoz } from '@/lib/types'

/** Guruh sig'imi — markaz qoidasi: "Guruhda 12 kishidan ortiq emas". Individual (IND) dars — 1 kishi */
const SIGIM = 12
const sigim = (nom: string) => (/\bIND\b/i.test(nom) ? 1 : SIGIM)

const foiz = (a: number, b: number) => (b > 0 ? Math.round((a * 100) / b) : null)

function FoizBelgi({ f, yaxshi = 90, orta = 70 }: { f: number | null; yaxshi?: number; orta?: number }) {
  if (f === null) return <span className="text-ink-4">—</span>
  const ton = f >= yaxshi ? 'bg-ok-soft text-ok' : f >= orta ? 'bg-accent-soft text-accent' : 'bg-brand-soft text-brand'
  return <span className={`tnum inline-block rounded-md px-1.5 py-0.5 text-[12px] font-bold ${ton}`}>{f}%</span>
}

/** Jadval qobig'i — telefonda gorizontal suriladi */
function Jadval({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[13px]">{children}</table>
    </div>
  )
}
/** Manba havolasi (26.10): jadvaldagi raqam — o'z ro'yxatiga */
const rq = 'underline decoration-line underline-offset-2 hover:text-brand hover:decoration-brand'
const tafsilot = (tur: string, davr: string) => `/crm/hisobotlar/tafsilot?tur=${tur}&davr=${davr}`
const tolovlar = (davr: string) => `/crm/tolovlar?filtr=faol&davr=${davr}`
const royxat = (tur: string, davr?: string) => `/crm/hisobotlar/royxat?tur=${tur}${davr ? `&davr=${davr}` : ''}`
/** Oraliqli ro'yxat (Davomat, Ustozlar): kim — guruh yoki ustoz */
const oraliqRoyxat = (tur: string, dan: string, gacha: string, kim?: string) =>
  `/crm/hisobotlar/royxat?tur=${tur}&dan=${dan}&gacha=${gacha}${kim ? `&kim=${encodeURIComponent(kim)}` : ''}`

const th = 'px-3 py-2.5 text-right text-[11px] font-semibold tracking-wide text-ink-3 uppercase first:pl-5 first:text-left last:pr-5'
const td = 'tnum px-3 py-2.5 text-right first:pl-5 first:text-left last:pr-5'

/* ================================================================== */
/*  MOLIYA                                                             */
/* ================================================================== */

export function MoliyaBolimi({ m }: { m: HisobotMoliya }) {
  const joriy = m.oylar.at(-1)
  const joriyFoiz = joriy ? foiz(Number(joriy.yigilgan), Number(joriy.hisoblangan)) : null
  const oylar = m.oylar.filter((o) => Number(o.hisoblangan) > 0 || Number(o.yigilgan) > 0)
  const jami = oylar.reduce(
    (a, o) => ({
      h: a.h + Number(o.hisoblangan), y: a.y + Number(o.yigilgan),
      c: a.c + Number(o.chegirma), v: a.v + Number(o.vip), t: a.t + Number(o.tuzatish),
    }),
    { h: 0, y: 0, c: 0, v: 0, t: 0 },
  )
  const maxQarz = Math.max(1, ...m.qarz_oylar.map((q) => Number(q.qarz)))

  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={`${joriy ? davrNomi(joriy.davr) : 'Shu oy'} — to‘lashi kerak`} value={Number(joriy?.hisoblangan ?? 0)} sub={`${joriy?.yozilish ?? 0} ta yozilish · so‘m`} href={joriy ? tafsilot('hisoblangan', joriy.davr) : undefined} />
        <Stat
          href={joriy ? tolovlar(joriy.davr) : undefined}
          label="Shu oy uchun yig‘ildi"
          value={Number(joriy?.yigilgan ?? 0)}
          sub={joriyFoiz === null ? 'so‘m' : `${joriyFoiz}% yig‘ildi · so‘m`}
          ton={joriyFoiz !== null && joriyFoiz >= 90 ? 'ok' : 'accent'}
        />
        <Stat label="Jami qarz" value={Number(m.qarz)} sub={`${m.qarzdor_yozilish} ta qarzdor yozilish · so‘m`} ton="brand" border="brand" href="/crm/qarzdorlar" />
        <Stat label={`${davrNomi(m.keyingi_davr)} — kutilmoqda`} value={Number(m.keyingi_kutilgan)} sub="chegirma, VIP, tuzatish hisobga olingan" ton="ok" href={tafsilot('keyingi', m.keyingi_davr)} />
      </div>

      <Card className="flex flex-col">
        <CardHeader title="To‘lashi kerak va yig‘ilgan" meta="to‘lov qaysi oy uchun qilingan bo‘yicha" />
        {oylar.length === 0 ? (
          <div className="px-5 pb-5"><Empty>Bu oraliqda hisob yo‘q.</Empty></div>
        ) : (
          <div className="flex flex-col gap-2 px-3 pb-4">
            <Ustunlar
              data={oylar.map((o) => ({ x: davrQisqa(o.davr), kerak: Number(o.hisoblangan), yigildi: Number(o.yigilgan) }))}
              seriyalar={[{ kalit: 'kerak', nom: 'To‘lashi kerak', rang: RANG.ink3 }, { kalit: 'yigildi', nom: 'Yig‘ildi', rang: RANG.brand }]}
            />
            <div className="flex flex-wrap gap-x-5 gap-y-1 px-2 text-[12px] text-ink-3">
              {oylar.map((o) => (
                <span key={o.davr} className="flex items-center gap-1.5">
                  {davrQisqa(o.davr)}: <FoizBelgi f={foiz(Number(o.yigilgan), Number(o.hisoblangan))} /> yig‘ildi
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="flex flex-col overflow-hidden">
          <CardHeader title="Oylar bo‘yicha" meta="so‘m" />
          <Jadval>
            <thead className="border-y border-line bg-surface-2/60">
              <tr>
                <th className={th}>Oy</th><th className={th}>To‘lashi kerak</th><th className={th}>Yig‘ildi</th>
                <th className={th}>%</th><th className={th}>Chegirma</th><th className={th}>VIP</th><th className={th}>Tuzatish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {oylar.map((o) => (
                <tr key={o.davr}>
                  <td className={`${td} font-semibold`}>{davrNomi(o.davr)}</td>
                  <td className={td}><Link href={tafsilot('hisoblangan', o.davr)} className={rq}>{pul(o.hisoblangan)}</Link></td>
                  <td className={td}><Link href={tolovlar(o.davr)} className={rq}>{pul(o.yigilgan)}</Link></td>
                  <td className={td}><FoizBelgi f={foiz(Number(o.yigilgan), Number(o.hisoblangan))} /></td>
                  <td className={`${td} text-ink-3`}><Link href={tafsilot('chegirma', o.davr)} className={rq}>{pul(o.chegirma)}</Link></td>
                  <td className={`${td} text-ink-3`}><Link href={tafsilot('vip', o.davr)} className={rq}>{pul(o.vip)}</Link></td>
                  <td className={`${td} text-ink-3`}><Link href={tafsilot('tuzatish', o.davr)} className={rq}>{pul(o.tuzatish)}</Link></td>
                </tr>
              ))}
            </tbody>
            {oylar.length > 1 && (
              <tfoot className="border-t-2 border-line font-bold">
                <tr>
                  <td className={td}>Jami</td><td className={td}>{pul(jami.h)}</td><td className={td}>{pul(jami.y)}</td>
                  <td className={td}><FoizBelgi f={foiz(jami.y, jami.h)} /></td>
                  <td className={td}>{pul(jami.c)}</td><td className={td}>{pul(jami.v)}</td><td className={td}>{pul(jami.t)}</td>
                </tr>
              </tfoot>
            )}
          </Jadval>
          <p className="px-5 py-3 text-[11.5px] leading-relaxed text-ink-3">
            Chegirma, VIP va tuzatish — markaz bermagan pul: shu summalar to‘lashi kerakdan allaqachon ayirilgan.
          </p>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Qarz qaysi oylardan" meta={<Link href="/crm/qarzdorlar" className="text-accent hover:text-brand">Qarzdorlar →</Link>} />
          <div className="flex flex-col px-5 pb-4">
            {m.qarz_oylar.length === 0 ? (
              <Empty>Qarz yo‘q.</Empty>
            ) : (
              m.qarz_oylar.map((q) => <BarRow key={q.davr} label={davrNomi(q.davr)} value={Number(q.qarz)} max={maxQarz} />)
            )}
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
              To‘lov avval eng eski oyni yopadi. Eski oylarda qolgan qarz — birinchi navbatda undiriladigan pul.
              {Number(m.oldindan) > 0 && <> Oldindan to‘langan (qarzdan ortiq): <b>{pul(m.oldindan)}</b> so‘m.</>}
              {Number(m.boglanmagan_tolov) > 0 && <> Fanga bog‘lanmagan to‘lov: <b>{pul(m.boglanmagan_tolov)}</b> so‘m.</>}
            </p>
          </div>
        </Card>
      </div>
    </>
  )
}

/* ================================================================== */
/*  O'QUVCHILAR                                                        */
/* ================================================================== */

export function OquvchilarBolimi({ o }: { o: HisobotOquvchilar }) {
  // Ma'lumot boshlanmagan oylar (tizimdan oldin) ko'rsatilmaydi
  const boshi = o.oylar.findIndex((m) => m.faol_fan > 0 || m.yangi_fan > 0 || m.probniy > 0)
  const oylar = boshi < 0 ? [] : o.oylar.slice(boshi)
  const maxFan = Math.max(1, ...o.fanlar.map((f) => f.yozilish))
  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        <Stat label="Faol bolalar" value={String(o.faol_bola)} sub="haqiqiy bolalar soni" href={royxat('faol_bola')} />
        <Stat label="Fan bo‘yicha" value={String(o.faol_fan)} sub="2 fanli bola — 2 marta" href={royxat('faol_fan')} />
        <Stat label="2 fanga qatnaydi" value={String(o.ikki_fanli)} sub="bola" href={royxat('ikki_fanli')} />
        <Stat label="VIP" value={String(o.vip)} sub="to‘lamaydi" ton="accent" href={royxat('vip')} />
        <Stat label="Arxivda" value={String(o.arxiv)} sub="ketgan bolalar" href={royxat('arxiv')} />
      </div>

      <Card className="flex flex-col">
        <CardHeader title="Oy oxirida faol bolalar" meta="bola · fan bo‘yicha" />
        <div className="px-3 pb-4">
          <Ustunlar
            format="son"
            data={oylar.map((m) => ({ x: davrQisqa(m.davr), fan: m.faol_fan, bola: m.faol_bola }))}
            seriyalar={[{ kalit: 'fan', nom: 'Fan bo‘yicha', rang: RANG.ink3 }, { kalit: 'bola', nom: 'Bolalar', rang: RANG.brand }]}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="flex flex-col overflow-hidden">
          <CardHeader title="Oqim: kim keldi, kim ketdi" meta="oyma-oy" />
          <Jadval>
            <thead className="border-y border-line bg-surface-2/60">
              <tr>
                <th className={th}>Oy</th><th className={th}>Yangi bola</th><th className={th}>Ketdi</th>
                <th className={th}>Faol (oy oxiri)</th><th className={th}>Probniy → doimiy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {oylar.map((m) => (
                <tr key={m.davr}>
                  <td className={`${td} font-semibold`}>{davrNomi(m.davr)}</td>
                  <td className={td}>
                    <Link href={royxat('yangi_bola', m.davr)} className={`font-bold text-ok ${rq}`}>+{m.yangi_bola}</Link>
                    <span className="text-ink-3"> · <Link href={royxat('yangi_fan', m.davr)} className={rq}>{m.yangi_fan} fan</Link></span>
                  </td>
                  <td className={td}>
                    <Link href={royxat('ketgan_bola', m.davr)} className={`${m.ketgan_bola ? 'font-bold text-brand' : 'text-ink-4'} ${rq}`}>−{m.ketgan_bola}</Link>
                    <span className="text-ink-3"> · <Link href={royxat('tugagan_fan', m.davr)} className={rq}>{m.tugagan_fan} fan</Link></span>
                  </td>
                  <td className={td}>
                    <Link href={royxat('oy_faol_bola', m.davr)} className={rq}>{m.faol_bola}</Link>{' '}
                    <span className="text-ink-3">· <Link href={royxat('oy_faol_fan', m.davr)} className={rq}>{m.faol_fan} fan</Link></span>
                  </td>
                  <td className={td}>
                    {m.probniy ? (
                      <>
                        <Link href={royxat('probniy_yozildi', m.davr)} className={rq}>{m.probniy_yozildi}</Link>/
                        <Link href={royxat('probniy', m.davr)} className={rq}>{m.probniy}</Link>{' '}
                        <FoizBelgi f={foiz(m.probniy_yozildi, m.probniy)} yaxshi={50} orta={30} />
                      </>
                    ) : <span className="text-ink-4">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Jadval>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Fanlar bo‘yicha" meta="hozir faol" />
          <div className="flex flex-col px-5 pb-4">
            {o.fanlar.length === 0 ? (
              <Empty>Faol yozilish yo‘q.</Empty>
            ) : (
              o.fanlar.map((f) => (
                <Link key={f.fan} href={`/crm/hisobotlar/royxat?tur=fan&kim=${encodeURIComponent(f.fan)}`} className="-mx-2 rounded-lg px-2 transition hover:bg-surface-2">
                  <BarRow label={`${f.fan} · ${f.guruh} guruh`} value={f.yozilish} max={maxFan} format={(n) => `${n} o‘quvchi`} />
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
    </>
  )
}

/* ================================================================== */
/*  USTOZLAR                                                           */
/* ================================================================== */

export function UstozlarBolimi({ u, dan, gacha }: { u: HisobotUstoz[]; dan: string; gacha: string }) {
  const r = (tur: string, kim: string) => oraliqRoyxat(tur, dan, gacha, kim)
  const jami = u.reduce(
    (a, x) => ({
      g: a.g + x.guruh, y: a.y + x.yozilish, d: a.d + x.dars, b: a.b + x.belgi, k: a.k + x.kelgan,
      t: a.t + Number(x.tushum), q: a.q + Number(x.qarz), w: a.w + x.woblar,
    }),
    { g: 0, y: 0, d: 0, b: 0, k: 0, t: 0, q: 0, w: 0 },
  )
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader title="Ustozlar solishtirmasi" meta="davomat, tushum va woblar — tanlangan oraliqda; qarz — hozirgi" />
      {u.length === 0 ? (
        <div className="px-5 pb-5"><Empty>Faol ustoz yo‘q.</Empty></div>
      ) : (
        <Jadval>
          <thead className="border-y border-line bg-surface-2/60">
            <tr>
              <th className={th}>Ustoz</th><th className={th}>Guruh</th><th className={th}>O‘quvchi</th><th className={th}>Dars</th>
              <th className={th}>Davomat</th><th className={th}>Tushum</th><th className={th}>Qarz</th><th className={th}>Woblar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {u.map((x) => (
              <tr key={x.id}>
                <td className={`${td} font-semibold`}><Link href={`/crm/ustozlar/${x.id}`} className="hover:text-brand hover:underline">{x.ism}</Link></td>
                <td className={td}><Link href={`/crm/guruhlar?ustoz=${x.id}&holat=faol`} className={rq}>{x.guruh}</Link></td>
                <td className={td}><Link href={`/crm/hisobotlar/royxat?tur=ustoz_oquvchi&kim=${x.id}`} className={rq}>{x.yozilish}</Link></td>
                <td className={td}><Link href={r('ustoz_dars', x.id)} className={rq}>{x.dars}</Link></td>
                <td className={td}><Link href={r('ustoz_kelgan', x.id)} title={`${x.kelgan} / ${x.belgi} belgi`}><FoizBelgi f={foiz(x.kelgan, x.belgi)} /></Link></td>
                <td className={td}><Link href={r('ustoz_tushum', x.id)} className={rq}>{pul(x.tushum)}</Link></td>
                <td className={`${td} ${Number(x.qarz) > 0 ? 'text-brand' : 'text-ink-4'}`}><Link href={`/crm/hisobotlar/royxat?tur=ustoz_qarz&kim=${x.id}`} className={rq}>{pul(x.qarz)}</Link></td>
                <td className={`${td} text-accent`}><Link href={r('ustoz_woblar', x.id)} className={rq}>{x.woblar}</Link></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-line font-bold">
            <tr>
              <td className={td}>Jami</td><td className={td}>{jami.g}</td><td className={td}>{jami.y}</td><td className={td}>{jami.d}</td>
              <td className={td}><FoizBelgi f={foiz(jami.k, jami.b)} /></td><td className={td}>{pul(jami.t)}</td>
              <td className={td}>{pul(jami.q)}</td><td className={td}>{jami.w}</td>
            </tr>
          </tfoot>
        </Jadval>
      )}
      <p className="px-5 py-3 text-[11.5px] leading-relaxed text-ink-3">
        O‘quvchi — faol yozilishlar (2 fanli bola har ustozda alohida). Tushum — shu ustoz guruhlariga bog‘langan to‘lovlar.
      </p>
    </Card>
  )
}

/* ================================================================== */
/*  DAVOMAT                                                            */
/* ================================================================== */

export function DavomatBolimi({ d, dan, gacha }: { d: HisobotDavomat; dan: string; gacha: string }) {
  const r = (tur: string, kim?: string) => oraliqRoyxat(tur, dan, gacha, kim)
  const b = d.belgilar
  const keldi = b.keldi + b.kechikdi
  const qoyilgan = b.kutilgan - b.belgilanmagan
  const tola = d.guruhlar.filter((g) => g.oquvchi >= sigim(g.nom)).length
  const bosh = d.guruhlar.reduce((a, g) => a + Math.max(0, sigim(g.nom) - g.oquvchi), 0)
  // Faqat shu oraliqda darsi bo'lgan guruhlar; belgilanmagani ko'p — tepada
  const guruhlar = d.guruhlar
    .filter((g) => g.dars_reja > 0)
    .sort((x, y) => y.s_belgilanmagan - x.s_belgilanmagan || y.kutilgan - x.kutilgan)
  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
        <Stat
          label="Darslar"
          value={`${d.darslar.otildi} / ${d.darslar.reja}`}
          sub={d.darslar.belgilanmagan ? `${d.darslar.belgilanmagan} ta darsga davomat qo‘yilmagan` : 'hamma darsga davomat qo‘yilgan'}
          ton={d.darslar.belgilanmagan ? 'brand' : 'ok'}
          href={r(d.darslar.belgilanmagan ? 'dav_dars_qilinmagan' : 'dav_dars')}
        />
        <Stat label="Belgi bo‘lishi kerak" value={String(b.kutilgan)} sub="dars kuni × guruhdagi o‘quvchi" href={r('dav_kutilgan')} />
        <Stat
          href={r('dav_keldi')}
          label="Keldi"
          value={String(keldi)}
          sub={`${foiz(keldi, qoyilgan) ?? '—'}% belgilanganlardan${b.kechikdi ? ` · ${b.kechikdi} kechikdi` : ''}`}
          ton="ok"
        />
        <Stat label="Kelmadi" value={String(b.kelmadi)} sub={b.sababli ? `+ ${b.sababli} sababli` : 'sababli yo‘q'} ton={b.kelmadi ? 'accent' : 'ok'} href={r('dav_kelmadi')} />
        <Stat
          href={r('dav_belgisiz')}
          label="Belgilanmagan"
          value={String(b.belgilanmagan)}
          sub={`${foiz(b.belgilanmagan, b.kutilgan) ?? 0}% — ustoz belgi qo‘ymagan`}
          ton={b.belgilanmagan ? 'brand' : 'ok'}
          border={b.belgilanmagan ? 'brand' : undefined}
        />
      </div>

      <Card className="flex flex-col overflow-hidden">
        <CardHeader title="Guruhlar bo‘yicha belgilar" meta="jadval bo‘yicha, bugungacha · dam kunlari hisobga olinmaydi" />
        {guruhlar.length === 0 ? (
          <div className="px-5 pb-5"><Empty>Bu oraliqda dars yo‘q.</Empty></div>
        ) : (
          <Jadval>
            <thead className="border-y border-line bg-surface-2/60">
              <tr>
                <th className={th}>Guruh</th><th className={th}>Ustoz</th><th className={th}>Darslar</th>
                <th className={th}>Belgi</th><th className={th}>Keldi</th><th className={th}>Kelmadi</th>
                <th className={th}>Sababli</th><th className={th}>Belgilanmagan</th><th className={th}>Davomat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {guruhlar.map((g) => (
                <tr key={g.id}>
                  <td className={`${td} max-w-[260px] truncate font-semibold`}>
                    <Link href={`/crm/davomat/${g.id}`} className="hover:text-brand">{g.nom.split(' · ').slice(0, 1).join('')} <span className="font-normal text-ink-3">{g.nom.split(' · ').slice(2).join(' · ')}</span></Link>
                  </td>
                  <td className={`${td} text-ink-2`}>{g.ustoz}</td>
                  <td className={td}>
                    <Link href={r('dav_dars_otildi', g.id)} className={`${g.dars_otildi < g.dars_reja ? 'text-brand' : ''} ${rq}`}>{g.dars_otildi}</Link>
                    <span className="text-ink-3"> / <Link href={r('dav_dars', g.id)} className={rq}>{g.dars_reja}</Link></span>
                  </td>
                  <td className={td}><Link href={r('dav_kutilgan', g.id)} className={rq}>{g.kutilgan}</Link></td>
                  <td className={`${td} text-ok`}><Link href={r('dav_keldi', g.id)} className={rq}>{g.s_keldi}</Link></td>
                  <td className={td}>{g.s_kelmadi ? <Link href={r('dav_kelmadi', g.id)} className={rq}>{g.s_kelmadi}</Link> : <span className="text-ink-4">0</span>}</td>
                  <td className={td}>{g.s_sababli ? <Link href={r('dav_sababli', g.id)} className={rq}>{g.s_sababli}</Link> : <span className="text-ink-4">0</span>}</td>
                  <td className={td}>{g.s_belgilanmagan ? <Link href={r('dav_belgisiz', g.id)} className={`font-bold text-brand ${rq}`}>{g.s_belgilanmagan}</Link> : <span className="text-ink-4">0</span>}</td>
                  <td className={td}><FoizBelgi f={foiz(g.s_keldi, g.s_keldi + g.s_kelmadi + g.s_sababli)} yaxshi={85} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-line bg-surface-2/60 font-semibold">
              <tr>
                <td className={td}>Jami</td><td className={td} />
                <td className={td}><Link href={r('dav_dars_otildi')} className={rq}>{d.darslar.otildi}</Link> / <Link href={r('dav_dars')} className={rq}>{d.darslar.reja}</Link></td>
                <td className={td}><Link href={r('dav_kutilgan')} className={rq}>{b.kutilgan}</Link></td>
                <td className={td}><Link href={r('dav_keldi')} className={rq}>{keldi}</Link></td>
                <td className={td}><Link href={r('dav_kelmadi')} className={rq}>{b.kelmadi}</Link></td>
                <td className={td}><Link href={r('dav_sababli')} className={rq}>{b.sababli}</Link></td>
                <td className={td}><Link href={r('dav_belgisiz')} className={rq}>{b.belgilanmagan}</Link></td>
                <td className={td}><FoizBelgi f={foiz(keldi, qoyilgan)} yaxshi={85} /></td>
              </tr>
            </tfoot>
          </Jadval>
        )}
        <p className="px-5 py-3 text-[11.5px] leading-relaxed text-ink-3">
          Belgi bo‘lishi kerak — har dars kuni o‘sha kuni guruhda bo‘lgan o‘quvchilar soni (keyin qo‘shilgan yoki chiqib ketgan bola o‘sha kunlarga sanalmaydi).
          Keldi — kechikib kelganlar bilan. Davomat foizi — belgi qo‘yilganlardan.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="flex flex-col">
          <CardHeader title="Haftalik davomat" meta="hafta boshi (dushanba) bo‘yicha, %" />
          {d.haftalar.length === 0 ? (
            <div className="px-5 pb-5"><Empty>Bu oraliqda davomat yo‘q.</Empty></div>
          ) : (
            <div className="px-3 pb-4">
              <ChiziqGrafik
                format="foiz"
                data={d.haftalar.map((h) => ({ x: sanaQisqa(h.hafta).slice(0, 5), davomat: Math.round(foiz(h.kelgan, h.belgi) ?? 0) }))}
                seriyalar={[{ kalit: 'davomat', nom: 'Davomat', rang: RANG.ok }]}
              />
            </div>
          )}
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Ko‘p dars qoldiradiganlar" meta="2+ marta kelmagan" />
          <ul className="flex flex-col divide-y divide-line">
            {d.qoldiruvchilar.length === 0 ? (
              <li className="px-5 pb-4"><Empty>Bunday o‘quvchi yo‘q.</Empty></li>
            ) : (
              d.qoldiruvchilar.map((q) => (
                <li key={q.student_id}>
                  <Link href={`/crm/oquvchilar/${q.student_id}`} className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-surface-2">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-semibold">{q.fish}</span>
                      <span className="truncate text-[11.5px] text-ink-3">{q.guruh}</span>
                    </span>
                    <span className="tnum shrink-0 text-[12.5px]">
                      <b className="text-brand">{q.kelmadi}</b> <span className="text-ink-3">/ {q.belgi}</span>
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <Stat label="To‘lgan guruhlar" value={`${tola} / ${d.guruhlar.length}`} sub={`guruh ${SIGIM} kishilik, individual — 1`} href="/crm/guruhlar?holat=faol" />
        <Stat label="Bo‘sh joylar" value={String(bosh)} sub="faol guruhlarda — yangi o‘quvchi uchun" ton="ok" href="/crm/guruhlar?holat=faol" />
      </div>
    </>
  )
}

/* ================================================================== */
/*  O'RTACHA TO'LOV (0091) — Moliya ichida                             */
/* ================================================================== */

const ortacha = (tushum: number, soni: number) => (soni > 0 ? Math.round(tushum / soni) : 0)

export function OrtachaTolovBolimi({ o }: { o: HisobotOrtacha }) {
  const oylar = o.filter((m) => Number(m.fan) > 0 || Number(m.tushum) > 0)
  const joriy = oylar.at(-1)
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader title="O‘rtacha to‘lov — 1 fan uchun" meta="oy uchun tushum ÷ shu oyda o‘qigan fanlar" />
      {!joriy ? (
        <div className="px-5 pb-5"><Empty>Bu oraliqda ma’lumot yo‘q.</Empty></div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3.5 px-5 pb-4 sm:grid-cols-3">
            <Stat label={`${davrNomi(joriy.davr)} — o‘rtacha`} value={ortacha(Number(joriy.tushum), Number(joriy.fan))} sub="1 fan uchun · so‘m" ton="brand" href={royxat('ortacha_fan', joriy.davr)} />
            <Stat label="Tushum" value={Number(joriy.tushum)} sub="shu oy uchun to‘langan · so‘m" href={royxat('ortacha_tolov', joriy.davr)} />
            <Stat label="Fanlar" value={String(joriy.fan)} sub={`${joriy.bola} bola · ${joriy.vip_fan} VIP`} href={royxat('ortacha_fan', joriy.davr)} />
          </div>
          <Jadval>
            <thead className="border-y border-line bg-surface-2/60">
              <tr>
                <th className={th}>Oy</th><th className={th}>Tushum</th><th className={th}>Fanlar</th><th className={th}>Bola</th>
                <th className={th}>O‘rtacha</th><th className={th}>VIPsiz o‘rtacha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {oylar.map((m) => (
                <tr key={m.davr}>
                  <td className={`${td} font-semibold`}>{davrNomi(m.davr)}</td>
                  <td className={td}><Link href={royxat('ortacha_tolov', m.davr)} className={rq}>{pul(m.tushum)}</Link></td>
                  <td className={td}><Link href={royxat('ortacha_fan', m.davr)} className={rq}>{m.fan}</Link></td>
                  <td className={`${td} text-ink-3`}>{m.bola}</td>
                  <td className={`${td} font-bold`}>{pul(ortacha(Number(m.tushum), Number(m.fan)))}</td>
                  <td className={`${td} text-ink-3`}>{pul(ortacha(Number(m.tushum), Number(m.fan) - Number(m.vip_fan)))}</td>
                </tr>
              ))}
            </tbody>
          </Jadval>
          <div className="flex flex-col gap-1.5 border-t border-line px-5 py-3">
            <span className="lbl">{davrNomi(joriy.davr)} — fanlar bo‘yicha</span>
            {joriy.fanlar.map((f) => (
              <div key={f.nom} className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                <span>
                  {f.nom}{' '}
                  <Link href={`${royxat('ortacha_fan', joriy.davr)}&kim=${encodeURIComponent(f.nom)}`} className={`text-ink-3 ${rq}`}>· {f.soni} ta</Link>
                </span>
                <span className="tnum">
                  <b>{pul(ortacha(Number(f.tushum), Number(f.soni)))}</b>{' '}
                  <Link href={`${royxat('ortacha_tolov', joriy.davr)}&kim=${encodeURIComponent(f.nom)}`} className={`text-ink-3 ${rq}`}>({pul(f.tushum)})</Link>
                </span>
              </div>
            ))}
          </div>
          <p className="px-5 pb-4 text-[11.5px] leading-relaxed text-ink-3">
            Oyning kamida bir kunida o‘qigan har kim sanaladi — oy ichida qo‘shilgan yoki ketgan ham; to‘lagani tushumga kiradi.
            2 fanda o‘qigan bola — 2 fan. To‘lov, yangi o‘quvchi yoki ketish darhol shu yerda aks etadi.
          </p>
        </>
      )}
    </Card>
  )
}

/* ================================================================== */
/*  ILOVA (0092) — O'quvchilar ichida                                  */
/* ================================================================== */

const ROL_NOMI: Record<string, string> = {
  oquvchi: 'O‘quvchi', ota_ona: 'Ota-ona', ustoz: 'Ustoz', admin: 'Admin', direktor: 'Direktor', qabulxona: 'Qabulxona', manager: 'Manager',
}
const PLATFORMA_NOMI: Record<string, string> = { iphone: 'iPhone', android: 'Android', kompyuter: 'Kompyuter' }

export function IlovaBolimi({ i }: { i: HisobotIlova }) {
  const rollar = Object.entries(i.rollar).sort((a, b) => b[1] - a[1])
  const maxRol = Math.max(1, ...rollar.map(([, n]) => n))
  return (
    <Card className="flex flex-col">
      <CardHeader title="Ilovani o‘rnatganlar" meta={i.boshlangan ? `${sanaQisqa(i.boshlangan.slice(0, 10))} dan sanalmoqda` : 'sanash boshlandi'} />
      <div className="grid grid-cols-1 gap-3.5 px-5 pb-4 sm:grid-cols-3">
        <Stat label="O‘rnatgan odamlar" value={String(i.odam)} sub={`${i.qurilma} ta qurilma`} ton="brand" />
        <Stat label="Oxirgi 7 kunda ochgan" value={String(i.hafta)} sub="odam" />
        <Stat
          label="Qurilmalar"
          value={String(i.qurilma)}
          sub={Object.entries(i.platformalar).map(([k, n]) => `${PLATFORMA_NOMI[k] ?? k} ${n}`).join(' · ') || '—'}
        />
      </div>
      <div className="flex flex-col px-5 pb-4">
        {rollar.length === 0 ? (
          <Empty>Hali hech kim ilovani o‘rnatgan holda ochmagan.</Empty>
        ) : (
          rollar.map(([rol, n]) => <BarRow key={rol} label={ROL_NOMI[rol] ?? rol} value={n} max={maxRol} />)
        )}
        {(i.royxat?.length ?? 0) > 0 && (
          <div className="mt-4 flex flex-col">
            <span className="lbl mb-1.5">Kim o‘rnatgan</span>
            <ul className="flex flex-col divide-y divide-line">
              {[...(i.royxat ?? [])]
                .sort((a, b) => (ROL_NOMI[a.rol] ?? a.rol).localeCompare(ROL_NOMI[b.rol] ?? b.rol, 'uz') || a.ism.localeCompare(b.ism, 'uz'))
                .map((x) => (
                  <li key={`${x.ism}-${x.birinchi}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-[13px]">
                    <span className="font-semibold">
                      {x.ism} <span className="font-normal text-ink-3">· {ROL_NOMI[x.rol] ?? x.rol}</span>
                    </span>
                    <span className="text-[12px] text-ink-3">
                      {x.platformalar.map((k) => PLATFORMA_NOMI[k] ?? k).join(', ')} · oxirgi: {sanaQisqa(x.oxirgi.slice(0, 10))}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
          Ilova telefon ekraniga o‘rnatilgan holda ochilganda sanaladi (kuniga bir marta). Sanash shu ko‘rsatkich qo‘shilgan kundan boshlangan —
          o‘rnatgan, lekin o‘shandan beri ochmagan odam hali ko‘rinmaydi.
        </p>
      </div>
    </Card>
  )
}

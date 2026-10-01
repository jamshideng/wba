import Link from 'next/link'
import { Card, CardHeader, Stat, BarRow, Empty } from '@/components/ui'
import { ChiziqGrafik, UstunGrafik as Ustunlar } from '@/components/grafiklar'
import { RANG } from '@/lib/grafik-rang'
import { pul, davrNomi, davrQisqa, sanaQisqa } from '@/lib/format'
import type { HisobotDavomat, HisobotMoliya, HisobotOquvchilar, HisobotUstoz } from '@/lib/types'

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
        <Stat label={`${joriy ? davrNomi(joriy.davr) : 'Shu oy'} — to‘lashi kerak`} value={Number(joriy?.hisoblangan ?? 0)} sub={`${joriy?.yozilish ?? 0} ta yozilish · so‘m`} />
        <Stat
          label="Shu oy uchun yig‘ildi"
          value={Number(joriy?.yigilgan ?? 0)}
          sub={joriyFoiz === null ? 'so‘m' : `${joriyFoiz}% yig‘ildi · so‘m`}
          ton={joriyFoiz !== null && joriyFoiz >= 90 ? 'ok' : 'accent'}
        />
        <Stat label="Jami qarz" value={Number(m.qarz)} sub={`${m.qarzdor_yozilish} ta qarzdor yozilish · so‘m`} ton="brand" border="brand" />
        <Stat label={`${davrNomi(m.keyingi_davr)} — kutilmoqda`} value={Number(m.keyingi_kutilgan)} sub="chegirma, VIP, tuzatish hisobga olingan" ton="ok" />
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
                  <td className={td}>{pul(o.hisoblangan)}</td>
                  <td className={td}>{pul(o.yigilgan)}</td>
                  <td className={td}><FoizBelgi f={foiz(Number(o.yigilgan), Number(o.hisoblangan))} /></td>
                  <td className={`${td} text-ink-3`}>{pul(o.chegirma)}</td>
                  <td className={`${td} text-ink-3`}>{pul(o.vip)}</td>
                  <td className={`${td} text-ink-3`}>{pul(o.tuzatish)}</td>
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
        <Stat label="Faol bolalar" value={String(o.faol_bola)} sub="haqiqiy bolalar soni" />
        <Stat label="Fan bo‘yicha" value={String(o.faol_fan)} sub="2 fanli bola — 2 marta" />
        <Stat label="2 fanga qatnaydi" value={String(o.ikki_fanli)} sub="bola" />
        <Stat label="VIP" value={String(o.vip)} sub="to‘lamaydi" ton="accent" />
        <Stat label="Arxivda" value={String(o.arxiv)} sub="ketgan bolalar" />
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
                    <span className="font-bold text-ok">+{m.yangi_bola}</span>
                    <span className="text-ink-3"> · {m.yangi_fan} fan</span>
                  </td>
                  <td className={td}>
                    <span className={m.ketgan_bola ? 'font-bold text-brand' : 'text-ink-4'}>−{m.ketgan_bola}</span>
                    <span className="text-ink-3"> · {m.tugagan_fan} fan</span>
                  </td>
                  <td className={td}>{m.faol_bola} <span className="text-ink-3">· {m.faol_fan} fan</span></td>
                  <td className={td}>
                    {m.probniy ? (
                      <>{m.probniy_yozildi}/{m.probniy} <FoizBelgi f={foiz(m.probniy_yozildi, m.probniy)} yaxshi={50} orta={30} /></>
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
                <BarRow key={f.fan} label={`${f.fan} · ${f.guruh} guruh`} value={f.yozilish} max={maxFan} format={(n) => `${n} o‘quvchi`} />
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

export function UstozlarBolimi({ u }: { u: HisobotUstoz[] }) {
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
                <td className={`${td} font-semibold`}>{x.ism}</td>
                <td className={td}>{x.guruh}</td>
                <td className={td}>{x.yozilish}</td>
                <td className={td}>{x.dars}</td>
                <td className={td}><FoizBelgi f={foiz(x.kelgan, x.belgi)} /></td>
                <td className={td}>{pul(x.tushum)}</td>
                <td className={`${td} ${Number(x.qarz) > 0 ? 'text-brand' : 'text-ink-4'}`}>{pul(x.qarz)}</td>
                <td className={`${td} text-accent`}>{x.woblar}</td>
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

export function DavomatBolimi({ d }: { d: HisobotDavomat }) {
  const umumiy = foiz(d.jami_kelgan, d.jami_belgi)
  const tola = d.guruhlar.filter((g) => g.oquvchi >= sigim(g.nom)).length
  const bosh = d.guruhlar.reduce((a, g) => a + Math.max(0, sigim(g.nom) - g.oquvchi), 0)
  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <Stat label="Davomat" value={umumiy === null ? '—' : `${umumiy}%`} sub={`${d.jami_kelgan} / ${d.jami_belgi} belgi`} ton={umumiy !== null && umumiy >= 85 ? 'ok' : 'accent'} />
        <Stat label="Ko‘p qoldiradi" value={String(d.qoldiruvchilar.length)} sub="2+ marta kelmagan bola" ton={d.qoldiruvchilar.length ? 'brand' : 'ok'} />
        <Stat label="To‘lgan guruhlar" value={`${tola} / ${d.guruhlar.length}`} sub={`guruh ${SIGIM} kishilik, individual — 1`} />
        <Stat label="Bo‘sh joylar" value={String(bosh)} sub="faol guruhlarda — yangi o‘quvchi uchun" ton="ok" />
      </div>

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

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="flex flex-col overflow-hidden">
          <CardHeader title="Guruhlar" meta="to‘lishi va davomati" />
          <Jadval>
            <thead className="border-y border-line bg-surface-2/60">
              <tr><th className={th}>Guruh</th><th className={th}>Ustoz</th><th className={th}>To‘lishi</th><th className={th}>Davomat</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.guruhlar.map((g) => (
                <tr key={g.id}>
                  <td className={`${td} max-w-[260px] truncate font-semibold`}>
                    <Link href={`/crm/guruhlar/${g.id}`} className="hover:text-brand">{g.nom.split(' · ').slice(0, 1).join('')} <span className="font-normal text-ink-3">{g.nom.split(' · ').slice(2).join(' · ')}</span></Link>
                  </td>
                  <td className={`${td} text-ink-2`}>{g.ustoz}</td>
                  <td className={td}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-16 overflow-hidden rounded bg-surface-2">
                        <span className={`block h-2 ${g.oquvchi >= sigim(g.nom) ? 'bg-ok' : 'bg-brand'}`} style={{ width: `${Math.min(100, (g.oquvchi / sigim(g.nom)) * 100)}%` }} />
                      </span>
                      {g.oquvchi}/{sigim(g.nom)}
                    </span>
                  </td>
                  <td className={td}><FoizBelgi f={foiz(g.kelgan, g.belgi)} yaxshi={85} /></td>
                </tr>
              ))}
            </tbody>
          </Jadval>
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
    </>
  )
}

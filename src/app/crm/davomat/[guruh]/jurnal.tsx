'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { davomatBelgila, probniyBelgila, woblarBer } from './actions'
import type { AttendanceStatus } from '@/lib/types'

export type JurnalQatori = {
  /** O'quvchi ID si yoki probniy uchun lead uuid */
  student_id: string
  /** Probniy — hali o'quvchi emas, pul hisoblanmaydi (0030) */
  probniy?: boolean
  fish: string
  /** Guruhga qo'shilgan kun — undan oldingi kataklar yopiq */
  boshlandi: string
  /** Chiqib ketgan kun (bo'lsa) — undan keyingi kataklar yopiq */
  tugadi: string | null
  /** Guruhdan chiqqan — faqat ko'rish */
  ketgan: boolean
  belgilar: Record<string, AttendanceStatus>
  /** Bugungi darsdagi woblar */
  bugun: number
  /** Umumiy woblar balansi */
  umumiy: number
}

export type DarsKuni = { sana: string; kun: number; hafta: string }

/** Kim nimani o'zgartira oladi: admin — o'tgan kunlar ham, ustoz — faqat bugun (Q5). */
export type Huquq = 'hammasi' | 'bugun' | 'yoq'

/* Faqat ikki holat: keldi (✓) va kelmadi (✗). Bosilganda navbat:
   bo'sh → keldi → kelmadi → bo'sh. Eski yozuvlardagi "kechikdi" keldi,
   "sababli" kelmadi bo'lib ko'rinadi (bazada o'zgarmaydi). */
type Ikki = 'keldi' | 'kelmadi'
const NAVBAT: (Ikki | null)[] = [null, 'keldi', 'kelmadi']

function ikkiga(h: AttendanceStatus | null | undefined): Ikki | null {
  if (!h) return null
  return h === 'keldi' || h === 'kechikdi' ? 'keldi' : 'kelmadi'
}

const BELGI: Record<Ikki, { nom: string; ton: string }> = {
  keldi: { nom: 'Keldi', ton: 'border-ok bg-ok text-white' },
  kelmadi: { nom: 'Kelmadi', ton: 'border-brand bg-brand text-white' },
}

function Belgi({ holat }: { holat: Ikki }) {
  return holat === 'keldi' ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

/**
 * Oylik davomat jurnali — qatorlarda o'quvchilar, ustunlarda guruhning
 * DARS KUNLARI (groups.kunlar). Katak bosilsa darhol saqlanadi.
 *
 * Bugungi ustun ajratib ko'rsatiladi. Kelajak kunlari va o'quvchi
 * guruhda bo'lmagan kunlar yopiq. Ustoz faqat bugunni, admin o'tgan
 * kunlarni ham tuzatadi — bu qoida bazada ham (davomat_belgila).
 */
export function Jurnal({
  guruhId,
  kunlar,
  bugun,
  boshlangich,
  huquq,
  woblarOchiq,
}: {
  guruhId: string
  kunlar: DarsKuni[]
  bugun: string
  boshlangich: JurnalQatori[]
  huquq: Huquq
  /** Bugun shu guruhning dars kuni va jurnal joriy oyda */
  woblarOchiq: boolean
}) {
  const [qatorlar, setQatorlar] = useState(boshlangich)
  const [xato, setXato] = useState<string | null>(null)
  const [xabar, setXabar] = useState<string | null>(null)
  const [kutilayotgan, setKutilayotgan] = useState<Set<string>>(new Set())
  const [woblarKirish, setWoblarKirish] = useState<Record<string, string>>({})
  const [, boshla] = useTransition()
  const jadvalRef = useRef<HTMLDivElement>(null)

  // Ochilganda bugungi (yoki oxirgi o'tgan) kunga siljiydi — telefonda ham kerakli ustun ko'rinsin
  useEffect(() => {
    const quti = jadvalRef.current
    const ustun = quti?.querySelector<HTMLElement>('[data-bugun="1"]') ?? [...(quti?.querySelectorAll<HTMLElement>('[data-otgan="1"]') ?? [])].at(-1)
    if (quti && ustun) quti.scrollLeft = Math.max(0, ustun.offsetLeft - quti.clientWidth / 2)
  }, [])

  const tahrirmi = (q: JurnalQatori, sana: string) =>
    !q.ketgan &&
    sana <= bugun &&
    sana >= q.boshlandi &&
    (!q.tugadi || sana <= q.tugadi) &&
    (huquq === 'hammasi' || (huquq === 'bugun' && sana === bugun))

  const belgiQoy = (sid: string, sana: string, holat: AttendanceStatus | null) =>
    setQatorlar((qs) =>
      qs.map((q) => {
        if (q.student_id !== sid) return q
        const belgilar = { ...q.belgilar }
        if (holat) belgilar[sana] = holat
        else delete belgilar[sana]
        return { ...q, belgilar }
      }),
    )

  /** Bir kun uchun bir nechta o'zgarish — optimistik, xato bo'lsa qaytadi. */
  function saqla(sana: string, ozgarish: Record<string, AttendanceStatus | null>, probniy = false) {
    const oldingi = Object.fromEntries(
      Object.keys(ozgarish).map((sid) => [sid, qatorlar.find((q) => q.student_id === sid)?.belgilar[sana] ?? null]),
    )
    for (const [sid, h] of Object.entries(ozgarish)) belgiQoy(sid, sana, h)

    const kalitlar = Object.keys(ozgarish).map((sid) => `${sid}|${sana}`)
    setKutilayotgan((s) => new Set([...s, ...kalitlar]))
    setXato(null)

    boshla(async () => {
      const [[lead, holat]] = Object.entries(ozgarish)
      const javob = probniy
        ? await probniyBelgila(guruhId, sana, lead, holat)
        : await davomatBelgila(guruhId, sana, ozgarish)
      setKutilayotgan((s) => {
        const n = new Set(s)
        kalitlar.forEach((k) => n.delete(k))
        return n
      })
      if (!javob.ok) {
        for (const [sid, h] of Object.entries(oldingi)) belgiQoy(sid, sana, h)
        setXato(javob.xato)
        return
      }
      setXabar('Saqlandi')
    })
  }

  function katakBos(q: JurnalQatori, sana: string) {
    const hozir = ikkiga(q.belgilar[sana])
    const keyingi = NAVBAT[(NAVBAT.indexOf(hozir) + 1) % NAVBAT.length]
    saqla(sana, { [q.student_id]: keyingi }, q.probniy)
  }

  const bugunUstunmi = kunlar.some((k) => k.sana === bugun)
  const bugunTahrir = bugunUstunmi && huquq !== 'yoq'

  function hammasiKeldi() {
    const ozgarish: Record<string, AttendanceStatus> = {}
    for (const q of qatorlar) if (!q.probniy && tahrirmi(q, bugun) && !q.belgilar[bugun]) ozgarish[q.student_id] = 'keldi'
    if (Object.keys(ozgarish).length) saqla(bugun, ozgarish)
  }

  function woblarBerish(q: JurnalQatori) {
    const ball = Number(woblarKirish[q.student_id] ?? '')
    if (!Number.isInteger(ball) || ball === 0 || ball < -10 || ball > 10) {
      setXato('Woblar −10 dan +10 gacha butun son bo‘lsin, 0 emas.')
      return
    }
    setXato(null)
    const kalit = `${q.student_id}|woblar`
    setKutilayotgan((s) => new Set([...s, kalit]))

    boshla(async () => {
      const javob = await woblarBer(guruhId, q.student_id, ball)
      setKutilayotgan((s) => {
        const n = new Set(s)
        n.delete(kalit)
        return n
      })
      if (!javob.ok) {
        setXato(javob.xato)
        return
      }
      setQatorlar((qs) =>
        qs.map((x) => (x.student_id === q.student_id ? { ...x, bugun: javob.natija, umumiy: x.umumiy + ball } : x)),
      )
      setWoblarKirish((w) => ({ ...w, [q.student_id]: '' }))
      setXabar(`${q.fish}: ${ball > 0 ? '+' : ''}${ball} woblar`)
    })
  }

  const bugungiJami = qatorlar.reduce((a, q) => a + q.bugun, 0)
  const ustunKeng = woblarOchiq && huquq !== 'yoq'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-ink-3">
        {(Object.keys(BELGI) as Ikki[]).map((h) => (
          <span key={h} className="flex items-center gap-1.5">
            <span className={`flex size-5 items-center justify-center rounded-[5px] border ${BELGI[h].ton}`}>
              <Belgi holat={h} />
            </span>
            {BELGI[h].nom}
          </span>
        ))}
        <span className="text-ink-4">· katakni bosing — keyingi holatga o‘tadi</span>
        {bugunTahrir && (
          <button
            type="button"
            onClick={hammasiKeldi}
            className="ml-auto min-h-11 rounded-[9px] border border-line px-3 text-[12.5px] text-ink-2 transition hover:border-ink-3 hover:text-ink"
          >
            Bugun hammasi keldi
          </button>
        )}
      </div>

      {xato ? (
        <p role="alert" className="rounded-[10px] border border-brand bg-brand-soft px-4 py-3 text-[13px]">
          Saqlanmadi: {xato}
        </p>
      ) : (
        <p role="status" className="min-h-5 text-[12.5px] text-ok">
          {kutilayotgan.size ? 'Saqlanmoqda…' : xabar}
        </p>
      )}

      <div ref={jadvalRef} className="overflow-x-auto rounded-[12px] border border-line bg-surface">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-ink-3">
              <th scope="col" className="sticky left-0 z-10 min-w-[130px] bg-surface px-3 py-2.5 sm:min-w-[190px] text-left text-[12px] font-semibold">
                O‘quvchilar ({qatorlar.filter((q) => !q.ketgan).length})
              </th>
              {kunlar.map((k) => {
                const bugunmi = k.sana === bugun
                return (
                  <th
                    key={k.sana}
                    scope="col"
                    data-bugun={bugunmi ? '1' : undefined}
                    data-otgan={k.sana < bugun ? '1' : undefined}
                    className={`min-w-[52px] px-1 py-2 text-center font-[family-name:var(--font-mono)] text-[11.5px] font-medium ${bugunmi ? 'bg-accent-soft text-accent' : ''}`}
                  >
                    <span className="block">{k.sana.slice(8, 10)}.{k.sana.slice(5, 7)}</span>
                    <span className="block text-[10px] text-ink-4">{k.hafta}</span>
                  </th>
                )
              })}
              <th scope="col" className="min-w-[60px] px-2 text-center text-[11.5px] font-semibold">Bugun</th>
              <th scope="col" className="min-w-[68px] px-2 text-center text-[11.5px] font-semibold">Umumiy</th>
              {ustunKeng && (
                <th scope="col" className="min-w-[150px] px-2 text-center text-[11.5px] font-semibold">
                  Woblar berish · bugun jami {bugungiJami}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {qatorlar.map((q, i) => (
              <tr key={q.student_id} className={`border-b border-line-soft last:border-b-0 ${q.ketgan ? 'opacity-55' : ''}`}>
                <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left font-normal">
                  <span className="flex items-center gap-2">
                    <span className="tnum w-5 shrink-0 text-right text-[11.5px] text-ink-4">{i + 1}.</span>
                    <span className="max-w-[110px] truncate font-semibold sm:max-w-none">{q.fish}</span>
                    {q.ketgan && <span className="shrink-0 text-[11px] text-ink-4">chiqqan</span>}
                    {q.probniy && <span className="shrink-0 rounded-[5px] bg-accent-soft px-1.5 text-[10.5px] font-semibold text-accent">probniy</span>}
                  </span>
                </th>
                {kunlar.map((k) => {
                  const holat = ikkiga(q.belgilar[k.sana])
                  const ochiq = tahrirmi(q, k.sana)
                  const kutmoqda = kutilayotgan.has(`${q.student_id}|${k.sana}`)
                  const bugunmi = k.sana === bugun
                  const guruhdami = k.sana >= q.boshlandi && (!q.tugadi || k.sana <= q.tugadi)
                  return (
                    <td key={k.sana} className={`px-1 py-1 text-center ${bugunmi ? 'bg-accent-soft/60' : ''}`}>
                      {guruhdami || holat ? (
                        <button
                          type="button"
                          disabled={!ochiq}
                          onClick={() => katakBos(q, k.sana)}
                          aria-label={`${q.fish}, ${k.sana}: ${holat ? BELGI[holat].nom : 'belgilanmagan'}`}
                          className={`mx-auto flex size-11 items-center justify-center rounded-[8px] border transition ${
                            holat ? BELGI[holat].ton : 'border-line bg-bg'
                          } ${ochiq ? 'cursor-pointer hover:brightness-95' : 'cursor-default'} ${!ochiq && !holat ? 'opacity-40' : ''} ${kutmoqda ? 'animate-pulse' : ''}`}
                        >
                          {holat && <Belgi holat={holat} />}
                        </button>
                      ) : (
                        <span className="text-ink-4" aria-hidden="true">·</span>
                      )}
                    </td>
                  )
                })}
                <td className="tnum px-2 text-center font-[family-name:var(--font-mono)] text-[13px] text-accent">
                  {q.probniy ? <span className="text-ink-4">—</span> : q.bugun ? (q.bugun > 0 ? `+${q.bugun}` : q.bugun) : <span className="text-ink-4">0</span>}
                </td>
                <td className="tnum px-2 text-center font-[family-name:var(--font-mono)] text-[13px] font-semibold">{q.probniy ? <span className="text-ink-4">—</span> : q.umumiy}</td>
                {ustunKeng && (
                  <td className="px-2 py-1">
                    {!q.ketgan && !q.probniy && (
                      <span className="flex items-center justify-center gap-1.5">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={-10}
                          max={10}
                          value={woblarKirish[q.student_id] ?? ''}
                          onChange={(e) => setWoblarKirish((w) => ({ ...w, [q.student_id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && woblarBerish(q)}
                          placeholder="0"
                          aria-label={`${q.fish}: woblar soni`}
                          className="h-11 w-16 rounded-[8px] border border-line bg-bg px-2 text-center font-[family-name:var(--font-mono)] text-[13px]"
                        />
                        <button
                          type="button"
                          onClick={() => woblarBerish(q)}
                          disabled={kutilayotgan.has(`${q.student_id}|woblar`)}
                          className="min-h-11 rounded-[8px] bg-accent px-3 text-[12.5px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                        >
                          Berish
                        </button>
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

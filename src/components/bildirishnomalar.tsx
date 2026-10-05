'use client'

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { BTUR_NOMI, natijaSavollarga, type BildirishnomaTuri, type MeningBildirishnomam, type SorovnomaNatija } from '@/lib/bildirishnoma'
import { bildirishnomaBelgila, sorovnomagaJavob } from '@/app/crm/bildirishnomalar/actions'

/**
 * Sayt ichidagi bildirishnomalar (0047):
 *   · oddiylari — tepadan sirpanib tushadi (3 tagacha), 15 soniyadan keyin
 *     qo'ng'iroqchaga yashirinadi (yopilmaydi — keyin ham topiladi);
 *   · muhimlari — ekran o'rtasida, yopilmaguncha / javob berilmaguncha;
 *   · so'rovnoma — javob shu yerning o'zida, keyin natija.
 * Animatsiya faqat transform/opacity (GPU) — sahifani og'irlashtirmaydi.
 */

const RANG: Record<BildirishnomaTuri, string> = {
  eslatma: 'text-accent bg-accent-soft',
  elon: 'text-brand bg-brand-soft',
  reklama: 'text-ok bg-ok-soft',
  sorovnoma: 'text-[#6d7cff] bg-[#6d7cff1a]',
}

function TurBelgisi({ turi }: { turi: BildirishnomaTuri }) {
  const p = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <span className={`grid size-9 shrink-0 place-items-center rounded-[10px] ${RANG[turi]}`} aria-hidden>
      {turi === 'eslatma' && <svg {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>}
      {turi === 'elon' && <svg {...p}><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>}
      {turi === 'reklama' && <svg {...p}><path d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6l-5 3.6 1.9-5.8L4 8.8h6.1z" /></svg>}
      {turi === 'sorovnoma' && <svg {...p}><path d="M3 3v18h18" /><path d="M8 17V11M13 17V7M18 17v-4" /></svg>}
    </span>
  )
}

function Havola({ href, children }: { href: string; children: React.ReactNode }) {
  const klass = 'inline-flex min-h-10 items-center rounded-[9px] bg-brand px-3.5 text-[12.5px] font-bold text-white transition hover:brightness-110'
  if (href === '#') return <span className={klass}>{children}</span>
  return href.startsWith('/')
    ? <Link href={href} className={klass}>{children}</Link>
    : <a href={href} target="_blank" rel="noopener noreferrer" className={klass}>{children}</a>
}

/** Bitta bildirishnoma kartasi (toast, modal va admin ko'rinishida bir xil) */
export function BildirishnomaKarta({
  b, onYop, onJavob, namuna = false,
}: {
  b: MeningBildirishnomam
  onYop?: () => void
  onJavob?: (natija: SorovnomaNatija[] | null) => void
  namuna?: boolean
}) {
  const [tanlov, setTanlov] = useState<number[]>([])
  const [natija, setNatija] = useState<SorovnomaNatija[] | null>(null)
  const [xato, setXato] = useState<string | null>(null)
  const [band, boshla] = useTransition()

  const savollar = b.savollar ?? []
  const birNechta = savollar.length > 1
  const tayyor = savollar.length > 0 && savollar.every((q) => q.variantlar.some((v) => tanlov.includes(v.id)))
  const javoblanganSoni = savollar.filter((q) => q.variantlar.some((v) => tanlov.includes(v.id))).length

  const tanla = (q: (typeof savollar)[number], id: number) =>
    setTanlov((t) => {
      if (q.kop_tanlov) return t.includes(id) ? t.filter((x) => x !== id) : [...t, id]
      const boshqa = new Set(q.variantlar.map((v) => v.id))
      return [...t.filter((x) => !boshqa.has(x)), id]
    })

  const ovoz = () => {
    if (namuna || !tayyor) return
    setXato(null)
    boshla(async () => {
      const r = await sorovnomagaJavob(b.id, tanlov)
      if (r.xato) return setXato(r.xato)
      setNatija(b.natija_ochiq ? (r.natija ?? []) : [])
      onJavob?.(b.natija_ochiq ? (r.natija ?? []) : null)
    })
  }

  return (
    <div className="flex gap-3">
      <TurBelgisi turi={b.turi} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="lbl">{BTUR_NOMI[b.turi]}{b.muhim ? ' · muhim' : ''}</span>
            <span className="text-[14.5px] leading-snug font-bold text-ink">{b.sarlavha}</span>
          </div>
          {onYop && (
            <button type="button" onClick={onYop} aria-label="Yopish" className="-mt-1 -mr-1 grid grid-cols-1 size-9 shrink-0 place-items-center rounded-lg text-ink-3 transition hover:bg-surface-2 hover:text-ink">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        {b.matn && <p className="text-[13px] leading-relaxed whitespace-pre-line text-ink-2">{b.matn}</p>}

        {b.turi === 'sorovnoma' && savollar.length > 0 && (
          natija ? (
            natija.length ? (
              <div className="flex flex-col gap-3">
                {natijaSavollarga(natija).map((q) => (
                  <div key={q.savol_id} className="flex flex-col gap-1.5">
                    {birNechta && <span className="text-[12.5px] font-semibold text-ink">{q.savol_matn}</span>}
                    <ul className="flex flex-col gap-1.5">
                      {q.variantlar.map((n) => {
                        const f = n.jami ? Math.round((n.ovoz * 100) / n.jami) : 0
                        const meniki = tanlov.includes(n.variant_id)
                        return (
                          <li key={n.variant_id} className="relative overflow-hidden rounded-[8px] border border-line px-3 py-2 text-[12.5px]">
                            <span className="absolute inset-y-0 left-0 bg-[#6d7cff22] transition-[width] duration-700" style={{ width: `${f}%` }} />
                            <span className="relative flex justify-between gap-2">
                              <span className={meniki ? 'font-bold text-ink' : 'text-ink-2'}>{n.matn}{meniki ? ' ✓' : ''}</span>
                              <b className="tnum text-ink">{f}%</b>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
                <p className="text-[11.5px] text-ink-3">{natija[0]?.jami ?? 0} kishi javob berdi · rahmat!</p>
              </div>
            ) : <p className="text-[12.5px] font-semibold text-ok">Javobingiz qabul qilindi — rahmat!</p>
          ) : b.javob_berdim && !namuna ? (
            <p className="text-[12.5px] font-semibold text-ok">Siz javob bergansiz — rahmat!</p>
          ) : (
            <div className="flex flex-col gap-3">
              {savollar.map((q, i) => (
                <fieldset key={q.id} className="flex flex-col gap-1.5">
                  {(birNechta || q.matn !== b.sarlavha) && (
                    <legend className="mb-1.5 text-[13px] leading-snug font-semibold text-ink">
                      {birNechta && <span className="tnum mr-1 text-ink-3">{i + 1}.</span>}
                      {q.matn}
                      {q.kop_tanlov && <span className="ml-1 text-[11.5px] font-normal text-ink-3">(bir nechtasini tanlasa bo‘ladi)</span>}
                    </legend>
                  )}
                  {q.variantlar.map((v) => {
                    const tanlangan = tanlov.includes(v.id)
                    return (
                      <button
                        key={v.id}
                        type="button"
                        aria-pressed={tanlangan}
                        onClick={() => tanla(q, v.id)}
                        className={`flex min-h-11 items-center gap-2.5 rounded-[9px] border px-3 text-left text-[13px] transition ${
                          tanlangan ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-surface text-ink-2 hover:border-ink-3'
                        }`}
                      >
                        <span className={`grid size-4 shrink-0 place-items-center border-2 ${q.kop_tanlov ? 'rounded-[4px]' : 'rounded-full'} ${tanlangan ? 'border-brand bg-brand' : 'border-ink-4'}`}>
                          {tanlangan && <span className="size-1.5 rounded-full bg-white" />}
                        </span>
                        {v.matn}
                      </button>
                    )
                  })}
                </fieldset>
              ))}
              {xato && <p role="alert" className="text-[12px] text-brand">{xato}</p>}
              <button
                type="button"
                disabled={!tayyor || band || namuna}
                onClick={ovoz}
                className="mt-0.5 min-h-11 rounded-[9px] bg-brand px-4 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {band ? 'Yuborilmoqda…' : birNechta && !tayyor ? `Javob berish · ${javoblanganSoni}/${savollar.length}` : birNechta ? 'Javob berish' : 'Ovoz berish'}
              </button>
            </div>
          )
        )}

        {b.havola && b.havola_matn && <div><Havola href={b.havola}>{b.havola_matn}</Havola></div>}
      </div>
    </div>
  )
}

/** Sarlavhadagi qo'ng'iroqcha + tepadan tushadigan xabarlar */
export function Bildirishnomalar({ royxat }: { royxat: MeningBildirishnomam[] }) {
  const [items, setItems] = useState(royxat)
  const [yashirin, setYashirin] = useState<Set<number>>(new Set())
  const [panel, setPanel] = useState(false)
  const belgilangan = useRef<Set<number>>(new Set())
  const panelRef = useRef<HTMLDivElement>(null)

  // Server yangi ro'yxat yuborsa (boshqa sahifaga o'tganda) — qo'shamiz
  useEffect(() => {
    setItems((eski) => {
      const bor = new Map(eski.map((x) => [x.id, x]))
      return royxat.map((x) => bor.get(x.id) ?? x)
    })
  }, [royxat])

  const ochiqlar = items.filter((b) => !b.yopilgan && !yashirin.has(b.id))
  const muhim = ochiqlar.find((b) => b.muhim)
  const toastlar = ochiqlar.filter((b) => !b.muhim).slice(0, 3)
  const oqilmagan = items.filter((b) => !b.yopilgan).length
  const korinayotgan = (muhim ? [muhim] : toastlar).map((b) => b.id).join(',')
  const toastKalit = toastlar.map((b) => b.id).join(',')

  // Ilova ikonkasidagi raqam = yopilmagan xabarlar (qo'ng'iroqchadagi bilan bir xil).
  // Service worker push kelganda shu sondan davom ettiradi (public/sw.js, BELGI).
  useEffect(() => {
    void ikonkaRaqami(oqilmagan)
  }, [oqilmagan])

  // Ko'rsatilganlarni "ko'rdi" deb belgilash (bir marta)
  useEffect(() => {
    for (const id of korinayotgan.split(',').filter(Boolean).map(Number)) {
      const b = items.find((x) => x.id === id)
      if (b && !b.korilgan && !belgilangan.current.has(id)) {
        belgilangan.current.add(id)
        void bildirishnomaBelgila(id, false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat ko'rinayotganlar o'zgarganda
  }, [korinayotgan])

  // Oddiylar 15 soniyadan keyin qo'ng'iroqchaga yashirinadi (yopilmaydi)
  useEffect(() => {
    // Muhim oyna ochiq turganda oddiylar ko'rinmaydi — taymer ham sanamaydi
    if (!toastKalit || muhim) return
    const idlar = toastKalit.split(',').map(Number)
    const t = setTimeout(() => {
      setYashirin((s) => new Set([...s, ...idlar.filter((id) => items.find((x) => x.id === id)?.turi !== 'sorovnoma')]))
    }, 15000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- taymer faqat ro'yxat o'zgarganda qayta boshlanadi
  }, [toastKalit, muhim?.id])

  // Panel tashqarisiga bosilsa — yopiladi
  useEffect(() => {
    if (!panel) return
    const bos = (e: MouseEvent) => { if (!panelRef.current?.contains(e.target as Node)) setPanel(false) }
    document.addEventListener('mousedown', bos)
    return () => document.removeEventListener('mousedown', bos)
  }, [panel])

  const yop = (id: number) => {
    setItems((s) => s.map((x) => (x.id === id ? { ...x, yopilgan: true } : x)))
    void bildirishnomaBelgila(id, true)
  }
  const javobBerdi = (id: number) =>
    setItems((s) => s.map((x) => (x.id === id ? { ...x, javob_berdim: true } : x)))
  const ochish = (id: number) => {
    setPanel(false)
    setYashirin((s) => { const n = new Set(s); n.delete(id); return n })
    setItems((s) => s.map((x) => (x.id === id ? { ...x, yopilgan: false } : x)))
  }

  return (
    <>
      {/* Qo'ng'iroqcha */}
      <div className="relative" ref={panelRef}>
        <button
          type="button"
          onClick={() => setPanel((p) => !p)}
          aria-label={`Bildirishnomalar${oqilmagan ? ` — ${oqilmagan} ta yangi` : ''}`}
          aria-expanded={panel}
          className="relative grid grid-cols-1 size-10 place-items-center rounded-[10px] border border-line bg-surface text-ink-2 transition hover:border-ink-3 hover:text-ink"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {oqilmagan > 0 && (
            <span className="tnum absolute -top-1.5 -right-1.5 grid grid-cols-1 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10.5px] leading-5 font-bold text-white ring-2 ring-bg">
              {oqilmagan}
            </span>
          )}
        </button>
        {panel && (
          <div className="bn-tushish absolute right-0 z-50 mt-2 flex max-h-[70vh] w-[min(92vw,380px)] flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-xl">
            <div className="border-b border-line px-4 py-3 text-[13.5px] font-bold">Bildirishnomalar</div>
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-ink-3">Hozircha xabar yo‘q.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line overflow-y-auto">
                {items.map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => ochish(b.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-2">
                      <TurBelgisi turi={b.turi} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[13px] font-semibold text-ink">{b.sarlavha}</span>
                        <span className="text-[11.5px] text-ink-3">{BTUR_NOMI[b.turi]}{b.turi === 'sorovnoma' && !b.javob_berdim ? ' · javob kutilmoqda' : ''}</span>
                      </span>
                      {!b.yopilgan && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-label="yangi" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Xabarlar va oyna — body'ga (sarlavhadagi backdrop-blur fixed'ni o'ziga bog'lab olmasin) */}
      {createPortal(
        <>
      {/* Tepadan tushadigan oddiy xabarlar */}
      {toastlar.length > 0 && !muhim && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2.5 px-3" aria-live="polite">
          {toastlar.map((b) => (
            <div key={b.id} className="bn-tushish pointer-events-auto max-h-[80dvh] w-full max-w-[440px] overflow-y-auto overscroll-contain rounded-[16px] border border-line bg-surface/95 p-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)] backdrop-blur">
              <BildirishnomaKarta b={b} onYop={() => yop(b.id)} onJavob={() => javobBerdi(b.id)} />
            </div>
          ))}
        </div>
      )}

      {/* Muhim — ekran o'rtasida */}
      {muhim && (
        <div className="fixed inset-0 z-[80] grid grid-cols-1 place-items-center bg-black/40 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={muhim.sarlavha}>
          <div className="bn-tushish max-h-[90dvh] w-full max-w-[460px] overflow-y-auto overscroll-contain rounded-[18px] border border-line bg-surface p-5 shadow-2xl">
            <BildirishnomaKarta
              b={muhim}
              onYop={muhim.turi === 'sorovnoma' && !muhim.javob_berdim ? undefined : () => yop(muhim.id)}
              onJavob={() => javobBerdi(muhim.id)}
            />
            {muhim.turi === 'sorovnoma' && !muhim.javob_berdim && (
              <button type="button" onClick={() => setYashirin((s) => new Set([...s, muhim.id]))} className="mt-2 min-h-11 w-full text-center text-[13px] text-ink-3 hover:text-ink">
                Keyinroq javob beraman
              </button>
            )}
          </div>
        </div>
      )}
        </>,
        document.body,
      )}
    </>
  )
}

/** Ekrandagi ilova ikonkasidagi qizil raqam (Badging API; iPhone — iOS 16.4+, o'rnatilgan ilovada). */
async function ikonkaRaqami(son: number) {
  try {
    const n = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
    if (son > 0) await n.setAppBadge?.(son)
    else await n.clearAppBadge?.()
    if ('caches' in window) await (await caches.open('wba-belgi')).put('/belgi', new Response(String(son)))
  } catch {}
}

/**
 * Telefon va kompyuterda sarlavha alohida — komponent faqat ko'rinayotgan
 * joyda ishlaydi (aks holda xabarlar ikki marta chiqardi). Serverda hech
 * narsa chizilmaydi: qaysi ekran ekanini faqat brauzer biladi.
 */
const KATTA = '(min-width: 1024px)'
function kattami(): boolean | null {
  return typeof window === 'undefined' ? null : window.matchMedia(KATTA).matches
}
export function BildirishnomaJoyi({ joy, royxat }: { joy: 'mobil' | 'kompyuter'; royxat: MeningBildirishnomam[] }) {
  const katta = useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(KATTA)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    kattami,
    () => null,
  )
  if (katta === null || katta !== (joy === 'kompyuter')) return null
  return <Bildirishnomalar royxat={royxat} />
}

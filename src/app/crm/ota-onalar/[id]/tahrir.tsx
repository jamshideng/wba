'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { kirishKlass, Maydon } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { otaOnaTahrir } from '@/app/crm/hisoblar/actions'

type ParolTuri = 'yoq' | 'avto' | 'qolda'

/** Brauzerda xavfsiz tasodifiy parol (12 belgi) */
function avtoParol(): string {
  const b = new Uint8Array(9)
  crypto.getRandomValues(b)
  return btoa(String.fromCharCode(...b)).replace(/\+/g, 'a').replace(/\//g, 'b')
}

/**
 * Ota-onani tahrirlash oynasi (Vertix shabloni, WBA uslubida):
 * 1) Ota-ona: ism, familiya, telefon, login; 2) Xavfsizlik: parolni
 * avto-generatsiya yoki qo'lda. SMS yo'q — avto parol oynada ko'rinadi,
 * admin nusxalab beradi (manzilga tushmaydi).
 */
export function OtaOnaTahrir({
  id,
  ism,
  familiya,
  telefon,
  login,
}: {
  id: string
  ism: string
  familiya: string
  telefon: string
  login: string
}) {
  const [ochiq, setOchiq] = useState(false)
  const [xavfsizlik, setXavfsizlik] = useState(false)
  const [turi, setTuri] = useState<ParolTuri>('yoq')
  const [parol, setParol] = useState('')

  useEffect(() => {
    if (!ochiq) return
    const tugma = (e: KeyboardEvent) => { if (e.key === 'Escape') setOchiq(false) }
    document.addEventListener('keydown', tugma)
    return () => document.removeEventListener('keydown', tugma)
  }, [ochiq])

  const tanla = (t: ParolTuri) => {
    setTuri(t)
    setParol(t === 'avto' ? avtoParol() : '')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOchiq(true)}
        className="inline-flex min-h-11 items-center rounded-[10px] border border-line bg-surface px-4 text-[13.5px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink"
      >
        Tahrirlash
      </button>
      {ochiq &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] grid grid-cols-1 place-items-center bg-black/40 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label="Ota-onani tahrirlash"
            onClick={() => setOchiq(false)}
          >
            <div
              className="bn-tushish flex max-h-[92dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-[18px] border border-line bg-surface shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                <span className="flex flex-col gap-0.5">
                  <span className="text-[17px] font-bold text-ink">Ota-onani tahrirlash</span>
                  <span className="text-[12.5px] text-ink-3">Quyidagi ma’lumotlarni o‘zgartiring</span>
                </span>
                <button
                  type="button"
                  onClick={() => setOchiq(false)}
                  aria-label="Yopish"
                  className="grid size-11 shrink-0 place-items-center rounded-[10px] text-[20px] text-ink-3 hover:bg-surface-2 hover:text-ink"
                >
                  ×
                </button>
              </div>

              <form action={otaOnaTahrir} className="flex min-h-0 flex-1 flex-col">
                <input type="hidden" name="ota_ona" value={id} />
                <input type="hidden" name="parol_turi" value={turi} />
                <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-7 place-items-center rounded-[8px] bg-brand-soft text-[13px] font-bold text-brand">1</span>
                    <span className="text-[14.5px] font-bold">Ota-ona / vasiy</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Maydon nom="Ism">
                      <input name="ism" required maxLength={40} defaultValue={ism} className={kirishKlass} />
                    </Maydon>
                    <Maydon nom="Familiya">
                      <input name="familiya" required maxLength={40} defaultValue={familiya} className={kirishKlass} />
                    </Maydon>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Maydon nom="Telefon raqami">
                      <input name="telefon" inputMode="tel" defaultValue={telefon} placeholder="90 123 45 67" className={kirishKlass} />
                    </Maydon>
                    <Maydon nom="Login">
                      <input name="email" required autoComplete="off" defaultValue={login} className={kirishKlass} />
                    </Maydon>
                  </div>

                  <div className="flex flex-col rounded-[12px] border border-line">
                    <button
                      type="button"
                      onClick={() => setXavfsizlik((x) => !x)}
                      aria-expanded={xavfsizlik}
                      className="flex min-h-14 items-center justify-between gap-3 px-4 text-left"
                    >
                      <span className="flex flex-col">
                        <span className="text-[14px] font-semibold">Xavfsizlik</span>
                        <span className="text-[12px] text-ink-3">Parolni yangilash</span>
                      </span>
                      <span className="text-[13px] text-ink-3">{xavfsizlik ? '▲' : '▼'}</span>
                    </button>
                    {xavfsizlik && (
                      <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Parol">
                          {(
                            [
                              ['avto', 'Avto-generatsiya', 'Tizim parol yaratadi — nusxalab bering'],
                              ['qolda', 'Qo‘lda', 'Yangi parolni o‘zingiz kiriting'],
                            ] as const
                          ).map(([t, nom, izoh]) => (
                            <button
                              key={t}
                              type="button"
                              role="radio"
                              aria-checked={turi === t}
                              onClick={() => tanla(t)}
                              className={`flex min-h-14 flex-col justify-center rounded-[10px] border px-3 py-2 text-left ${
                                turi === t ? 'border-brand bg-brand-soft' : 'border-line hover:border-ink-3'
                              }`}
                            >
                              <span className={`text-[13.5px] font-semibold ${turi === t ? 'text-brand' : 'text-ink'}`}>{nom}</span>
                              <span className="text-[11.5px] text-ink-3">{izoh}</span>
                            </button>
                          ))}
                        </div>
                        {turi !== 'yoq' && (
                          <Maydon nom="Yangi parol" izoh={turi === 'avto' ? 'Nusxalab oling — saqlangandan keyin ko‘rinmaydi' : 'Kamida 8 belgi'}>
                            <input
                              name="parol"
                              required
                              minLength={8}
                              autoComplete="new-password"
                              value={parol}
                              onChange={(e) => setParol(e.target.value)}
                              className={kirishKlass}
                            />
                          </Maydon>
                        )}
                        {turi !== 'yoq' && (
                          <button type="button" onClick={() => tanla('yoq')} className="min-h-11 self-start text-[12.5px] text-ink-3 hover:text-ink">
                            Parolni o‘zgartirmaslik
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="border-t border-line px-5 py-4">
                  <Yuborish>Saqlash</Yuborish>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

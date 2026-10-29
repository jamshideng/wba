'use client'

import { useState } from 'react'
import { Maydon, kirishKlass } from '@/components/forma'
import { Button } from '@/components/ui'
import { TUR_NOMI, type OylikBolim, type OylikTestTuri } from '@/lib/oylik-test'

/** Tez qo'shish: IELTS guruhlarida ko'p ishlatiladigan bo'limlar.
    100 — foizda, 9 — IELTS band (Jamshid, 28.10: "Grammar 70% · Writing 7/9") */
const TAYYOR: OylikBolim[] = [
  { nom: 'Grammar', maks: 100 },
  { nom: 'Vocabulary', maks: 100 },
  { nom: 'Listening', maks: 9 },
  { nom: 'Reading', maks: 9 },
  { nom: 'Writing', maks: 9 },
  { nom: 'Speaking', maks: 9 },
]

/**
 * Test turi: foiz / ball / bo'limlar. Bo'limlarni ustoz o'zi qo'shadi
 * (nomi va maks balli). Forma oddiy server action bilan yuboriladi —
 * bu komponent faqat maydonlarni ko'rsatib-yashiradi.
 */
export function TestSozlamasi({
  turi: boshTuri,
  maks,
  bolimlar: boshBolimlar,
  qulf,
}: {
  turi: OylikTestTuri
  maks: number | null
  bolimlar: OylikBolim[]
  /** E'lon qilingan natija bor — ustoz o'zgartirolmaydi */
  qulf: boolean
}) {
  const [turi, setTuri] = useState<OylikTestTuri>(boshTuri)
  const [bolimlar, setBolimlar] = useState<{ nom: string; maks: string }[]>(
    boshBolimlar.length ? boshBolimlar.map((b) => ({ nom: b.nom, maks: String(b.maks) })) : [{ nom: '', maks: '' }],
  )

  const ozgartir = (i: number, k: 'nom' | 'maks', v: string) =>
    setBolimlar((b) => b.map((x, j) => (j === i ? { ...x, [k]: v } : x)))

  return (
    <fieldset disabled={qulf} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Test turi">
        {(Object.keys(TUR_NOMI) as OylikTestTuri[]).map((t) => (
          <label
            key={t}
            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border px-4 text-[13.5px] font-semibold ${
              turi === t ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-2'
            }`}
          >
            <input type="radio" name="turi" value={t} checked={turi === t} onChange={() => setTuri(t)} className="sr-only" />
            {TUR_NOMI[t]}
          </label>
        ))}
      </div>

      {turi === 'foiz' && (
        <p className="text-[12.5px] text-ink-3">Har o‘quvchiga natija foizda yoziladi (0–100).</p>
      )}

      {turi === 'ball' && (
        <Maydon nom="Maksimal ball" izoh="Masalan 40 — keyin har o‘quvchiga 34 kabi ball yoziladi, foiz o‘zi hisoblanadi.">
          <input name="maks" inputMode="decimal" required defaultValue={maks ?? ''} placeholder="40" className={`${kirishKlass} max-w-40`} />
        </Maydon>
      )}

      {turi === 'ielts' && (
        <p className="text-[12.5px] text-ink-3">
          Listening, Reading, Writing, Speaking — har biri 0–9 (0.5 qadam). Overall band IELTS qoidasi bilan
          hisoblanadi: o‘rtacha 6.25 → 6.5, 6.75 → 7.0.
        </p>
      )}

      {turi === 'bolimlar' && (
        <div className="flex flex-col gap-2">
          <span className="lbl">Bo‘limlar va shkalasi</span>
          <p className="text-[12px] text-ink-3">
            Maks: <b>100</b> — foizda (Grammar 70%), <b>9</b> — IELTS band (Writing 7/9). Har bo‘lim alohida ko‘rinadi;
            umumiy foiz — yozilgan bo‘limlar o‘rtachasi.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TAYYOR.filter((t) => !bolimlar.some((b) => b.nom.trim().toLowerCase() === t.nom.toLowerCase())).map((t) => (
              <button
                key={t.nom}
                type="button"
                onClick={() =>
                  setBolimlar((x) => [...x.filter((b) => b.nom.trim() || b.maks.trim()), { nom: t.nom, maks: String(t.maks) }].slice(0, 10))
                }
                className="min-h-11 rounded-[10px] border border-line px-3 text-[12.5px] font-semibold text-ink-2 hover:border-ink-3"
              >
                + {t.nom} {t.maks === 100 ? '(%)' : `(/${t.maks})`}
              </button>
            ))}
          </div>
          {bolimlar.map((b, i) => (
            <div key={i} className="flex max-w-xl gap-2">
              <input
                name="bolim_nom"
                value={b.nom}
                onChange={(e) => ozgartir(i, 'nom', e.target.value)}
                placeholder="Bo‘lim nomi (Reading)"
                aria-label={`${i + 1}-bo‘lim nomi`}
                className={`${kirishKlass} min-w-0 flex-1`}
              />
              <input
                name="bolim_maks"
                value={b.maks}
                onChange={(e) => ozgartir(i, 'maks', e.target.value)}
                inputMode="decimal"
                list="oylik-maks"
                placeholder="100 / 9"
                aria-label={`${i + 1}-bo‘lim maksimal bali`}
                className={`${kirishKlass} !w-24 shrink-0`}
              />
              <button
                type="button"
                onClick={() => setBolimlar((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : x))}
                aria-label={`${i + 1}-bo‘limni olib tashlash`}
                className="min-h-11 min-w-11 shrink-0 rounded-[10px] border border-line text-ink-3 hover:text-brand"
              >
                ×
              </button>
            </div>
          ))}
          <datalist id="oylik-maks">
            <option value="100">foizda</option>
            <option value="9">IELTS band</option>
          </datalist>
          {bolimlar.length < 10 && (
            <button
              type="button"
              onClick={() => setBolimlar((x) => [...x, { nom: '', maks: '' }])}
              className="min-h-11 self-start rounded-[10px] px-3 text-[13px] font-semibold text-brand hover:bg-brand-soft"
            >
              + Bo‘lim qo‘shish
            </button>
          )}
        </div>
      )}

      {!qulf && (
        <div>
          <Button type="submit">Sozlamani saqlash</Button>
        </div>
      )}
    </fieldset>
  )
}

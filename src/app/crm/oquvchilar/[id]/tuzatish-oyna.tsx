'use client'

/**
 * 0147 — Tuzatish oynasi: oyning dars sanalari, admin "kelmadi" kunlarini
 * tanlaydi, summa jonli hisoblanadi (yakuniy summa — bazada, tuzatish_darslar_qosh).
 */
import { useEffect, useMemo, useState, useTransition } from 'react'
import { tuzatishOynaOl, tuzatishDarslarQosh, type TuzatishOyna, type TuzatishDarsHolati } from '../actions'
import { Maydon, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { pul, sana } from '@/lib/format'

const KLASS: Record<TuzatishDarsHolati, string> = {
  keldi: 'border-ok bg-ok-soft text-ok cursor-not-allowed',
  kelmadi: 'border-brand-line bg-brand-soft text-brand cursor-pointer hover:brightness-110',
  belgilanmagan: 'border-warn bg-surface-2 text-warn cursor-not-allowed',
  ayirilgan: 'border-line bg-surface-2 text-ink-4 line-through cursor-not-allowed',
  otilmagan: 'border-dashed border-line bg-surface text-ink-4 cursor-not-allowed',
}

const IZOH: Record<TuzatishDarsHolati, string> = {
  keldi: 'Keldi',
  kelmadi: 'Kelmadi — tanlash mumkin',
  belgilanmagan: 'Avval ustoz davomatni belgilashi kerak',
  ayirilgan: 'Ayirilgan',
  otilmagan: 'Hali o‘tilmagan',
}

export function TuzatishOynasi({
  studentId,
  enrollmentId,
  boshlandi,
  tugadi,
  standartDavr,
}: {
  studentId: string
  enrollmentId: string
  boshlandi: string
  tugadi: string | null
  standartDavr: string
}) {
  const [davr, setDavr] = useState(standartDavr)
  const [oyna, setOyna] = useState<TuzatishOyna | null>(null)
  const [xato, setXato] = useState<string | null>(null)
  const [tanlangan, setTanlangan] = useState<Set<string>>(new Set())
  const [tekshirdim, setTekshirdim] = useState(false)
  const [yuklanmoqda, boshla] = useTransition()

  useEffect(() => {
    setTanlangan(new Set())
    setTekshirdim(false)
    boshla(async () => {
      const r = await tuzatishOynaOl(enrollmentId, davr)
      setOyna(r.data ?? null)
      setXato(r.xato ?? null)
    })
  }, [enrollmentId, davr])

  const k = tanlangan.size
  // Bazadagi formula bilan bir xil: round(oylik ÷ n) × k — ko'rsatilgan raqam = haqiqiy summa
  const birDars = oyna?.bir_dars ? Number(oyna.bir_dars) : 0
  const summa = birDars * k
  // Ortiqcha to'lov: shu oy uchun to'langan − tuzatishdan keyingi summa (bazadagi bilan bir xil)
  const ortiqcha = useMemo(() => {
    if (!oyna || k === 0) return 0
    return Math.max(0, Number(oyna.tolangan) - (Number(oyna.qoldiq) - summa))
  }, [oyna, k, summa])
  // Naqd — faqat shu tuzatish summasi, ortiqchadan ko'p emas (bazada ham least(summa, ortiqcha))
  const naqdSumma = Math.min(summa, ortiqcha)
  const [qaytarish, setQaytarish] = useState<'keyingi_oy' | 'naqd'>('keyingi_oy')
  useEffect(() => {
    if (ortiqcha === 0) setQaytarish('keyingi_oy')
  }, [ortiqcha])

  function almashtir(id: string) {
    setTanlangan((eski) => {
      const yangi = new Set(eski)
      if (yangi.has(id)) yangi.delete(id)
      else yangi.add(id)
      return yangi
    })
  }

  const qoldaBor = (oyna?.qolda.length ?? 0) > 0
  const saqlashMumkin = k > 0 && !!oyna?.oylik && (!qoldaBor || tekshirdim)

  return (
    <form action={tuzatishDarslarQosh} className="mt-2 flex flex-col gap-3">
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="enrollment_id" value={enrollmentId} />
      <input type="hidden" name="davr" value={davr} />
      {[...tanlangan].map((id) => (
        <input key={id} type="hidden" name="dars" value={id} />
      ))}
      {tekshirdim && <input type="hidden" name="tekshirdim" value="1" />}

      <Maydon nom="Oy">
        <input
          type="month"
          value={davr}
          min={boshlandi.slice(0, 7)}
          max={tugadi ? tugadi.slice(0, 7) : undefined}
          onChange={(e) => e.target.value && setDavr(e.target.value)}
          className={`${kirishKlass} w-44`}
        />
      </Maydon>

      {xato && <p className="text-[12.5px] text-brand">{xato}</p>}
      {yuklanmoqda && !oyna && <p className="text-[12.5px] text-ink-3">Yuklanmoqda…</p>}

      {oyna && (
        <>
          {oyna.oylik == null ? (
            <p className="text-[12.5px] text-warn">Bu oy uchun hisob-faktura yo‘q — avval oy hisoblansin.</p>
          ) : (
            <p className="text-[12px] text-ink-3">
              Oylik to‘lov {pul(oyna.oylik)} so‘m · oyda {oyna.n} dars · bir dars {pul(oyna.bir_dars ?? 0)} so‘m
            </p>
          )}

          {oyna.darslar.length === 0 ? (
            <p className="text-[12.5px] text-ink-3">Bu oyda dars yo‘q.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">
              {oyna.darslar.map((d) => {
                const tanlandi = !!d.lesson_id && tanlangan.has(d.lesson_id)
                const bosiladi = d.holat === 'kelmadi' && !!d.lesson_id
                return (
                  <button
                    key={d.sana}
                    type="button"
                    disabled={!bosiladi}
                    aria-pressed={tanlandi}
                    title={IZOH[d.holat]}
                    onClick={() => d.lesson_id && almashtir(d.lesson_id)}
                    className={`flex min-h-11 flex-col items-center justify-center rounded-[9px] border px-1 py-1.5 text-[12.5px] transition ${KLASS[d.holat]} ${
                      tanlandi ? 'ring-2 ring-brand ring-offset-1 ring-offset-surface font-semibold' : ''
                    }`}
                  >
                    <span className="tnum font-[family-name:var(--font-mono)]">{sana(d.sana).slice(0, 5)}</span>
                    <span className="text-[10.5px]">
                      {d.holat === 'ayirilgan'
                        ? 'ayirilgan'
                        : d.holat === 'belgilanmagan'
                          ? 'belgisiz'
                          : d.holat === 'otilmagan'
                            ? 'o‘tilmagan'
                            : d.zamena
                              ? 'zamena'
                              : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3">
            <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-sm bg-ok" /> keldi</span>
            <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-sm bg-brand" /> kelmadi (tanlanadi)</span>
            <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-sm bg-warn" /> belgilanmagan — avval ustoz davomatni belgilashi kerak</span>
            <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-sm bg-ink-4" /> ayirilgan</span>
            <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-sm border border-dashed border-ink-4" /> hali o‘tilmagan</span>
          </div>

          {oyna.qulf && (
            <p className="rounded-[9px] border border-warn px-3 py-2 text-[12px] text-ink-2">
              Bu oy ustoz oyligi qulflangan: o‘quvchiga chegirma darhol beriladi, ustoz qismi direktor qarorini kutadi.
            </p>
          )}

          {qoldaBor && (
            <div className="rounded-[9px] border border-warn px-3 py-2 text-[12px] text-ink-2">
              <b>Bu oyda qo‘lda tuzatish bor:</b>
              <ul className="mt-1 list-disc pl-4">
                {oyna.qolda.map((q) => (
                  <li key={q.id}>
                    {pul(q.summa)} so‘m · {sana(q.sana.slice(0, 10))} · {q.sabab}
                  </li>
                ))}
              </ul>
              <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2">
                <input type="checkbox" checked={tekshirdim} onChange={(e) => setTekshirdim(e.target.checked)} className="size-4" />
                Tekshirdim, ikki marta emas
              </label>
            </div>
          )}

          <div className="rounded-[9px] bg-surface-2 px-3 py-2.5 text-[13px]">
            {k === 0 ? (
              <span className="text-ink-3">Kelmagan darslarni tanlang</span>
            ) : (
              <span className="tnum font-[family-name:var(--font-mono)] font-semibold">
                {k} dars × {pul(birDars)} = {pul(summa)} so‘m
              </span>
            )}
          </div>

          {/* Tanlov faqat ortiqcha to'lov chiqqanda; aks holda summa shu oy qarzidan ayiriladi */}
          {ortiqcha > 0 ? (
            <fieldset className="flex flex-col gap-1 text-[12.5px]">
              <legend className="lbl mb-1">Oy to‘langan — tuzatishdan keyin ortiqcha {pul(ortiqcha)} so‘m</legend>
              <label className="flex min-h-11 cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="qaytarish"
                  value="keyingi_oy"
                  checked={qaytarish === 'keyingi_oy'}
                  onChange={() => setQaytarish('keyingi_oy')}
                  className="size-4"
                />
                Keyingi oyga o‘tkazish — {pul(naqdSumma)} so‘m keyingi oy to‘lovidan ayiriladi
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="qaytarish"
                  value="naqd"
                  checked={qaytarish === 'naqd'}
                  onChange={() => setQaytarish('naqd')}
                  className="size-4"
                />
                Naqd qaytarish — {pul(naqdSumma)} so‘m (kassadan chiqadi, direktorga xabar boradi)
              </label>
            </fieldset>
          ) : (
            <input type="hidden" name="qaytarish" value="keyingi_oy" />
          )}

          <Maydon nom="Izoh" izoh="Ixtiyoriy">
            <input name="izoh" placeholder="Masalan: kasal" className={kirishKlass} />
          </Maydon>

          {saqlashMumkin ? (
            <Yuborish kutish="Saqlanmoqda…">Saqlash</Yuborish>
          ) : (
            <button type="button" disabled className="min-h-11 rounded-[9px] border border-line px-4 text-[13px] text-ink-4">
              Saqlash
            </button>
          )}
        </>
      )}
    </form>
  )
}

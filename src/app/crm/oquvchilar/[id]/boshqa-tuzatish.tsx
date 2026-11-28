'use client'

/**
 * "Boshqa tuzatish" — qo'lda summa (oy o'rtasida boshlagan va boshqa holatlar).
 * 0147: shu oyda dars bo'yicha tuzatish bo'lsa — ogohlantirish va belgi
 * (kelmagan dars uchun ikki marta berilmasin). Serverda ham tekshiriladi.
 */
import { useState } from 'react'
import { tuzatishQosh } from '../actions'
import { Maydon, kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { pul } from '@/lib/format'

export function BoshqaTuzatish({
  studentId,
  enrollmentId,
  boshlandi,
  tugadi,
  standartDavr,
  darslarTuzatish,
}: {
  studentId: string
  enrollmentId: string
  boshlandi: string
  tugadi: string | null
  standartDavr: string
  /** shu yozilishdagi faol dars bo'yicha tuzatishlar */
  darslarTuzatish: { davr: string; summa: number; sabab: string }[]
}) {
  const [davr, setDavr] = useState(standartDavr)
  const [tekshirdim, setTekshirdim] = useState(false)
  const shuOy = darslarTuzatish.filter((t) => t.davr === davr)

  return (
    <form action={tuzatishQosh} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="enrollment_id" value={enrollmentId} />
      {tekshirdim && <input type="hidden" name="tekshirdim" value="1" />}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_2fr]">
        <Maydon nom="Oy">
          <input
            type="month"
            name="davr"
            required
            min={boshlandi.slice(0, 7)}
            max={tugadi ? tugadi.slice(0, 7) : undefined}
            value={davr}
            onChange={(e) => {
              setDavr(e.target.value)
              setTekshirdim(false)
            }}
            className={kirishKlass}
          />
        </Maydon>
        <Maydon nom="Ayiriladi">
          <input name="summa" required inputMode="decimal" placeholder="150 000" className={kirishKlass} />
        </Maydon>
        <Maydon nom="Sabab" izoh="Majburiy">
          <input name="sabab" required minLength={3} placeholder="Masalan: oy o‘rtasida boshladi" className={kirishKlass} />
        </Maydon>
      </div>

      {shuOy.length > 0 && (
        <div className="rounded-[9px] border border-warn px-3 py-2 text-[12px] text-ink-2">
          <b>Bu oyda dars bo‘yicha tuzatish bor:</b>
          <ul className="mt-1 list-disc pl-4">
            {shuOy.map((t, i) => (
              <li key={i}>
                {pul(t.summa)} so‘m · {t.sabab}
              </li>
            ))}
          </ul>
          <p className="mt-1">Kelmagan dars uchun qo‘lda ham summa yozilsa, shu dars ikki marta qayta hisoblanadi.</p>
          <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-2">
            <input type="checkbox" required checked={tekshirdim} onChange={(e) => setTekshirdim(e.target.checked)} className="size-4" />
            Tekshirdim, ikki marta emas
          </label>
        </div>
      )}

      <p className="text-[11.5px] text-ink-3">
        Faqat tanlangan oy uchun: o‘sha oyning to‘lovidan ayiriladi. Kelmagan darslar uchun yuqoridagi “Tuzatish” oynasidan foydalaning.
      </p>
      <Yuborish kutish="…" tur="ikkilamchi">Boshqa tuzatishni yozish</Yuborish>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { kirishKlass } from '@/components/forma'
import type { StudentStatus } from '@/lib/types'

const SABABLAR = ['Ta’til', 'Kasallik', 'Safar / ko‘chish', 'Imtihon / maktab', 'Moliyaviy']

/**
 * Holat tanlovi. "Tanaffus" tanlansa — qaytish sanasi va sababi so'raladi:
 * dashboard'da "qaytishi kutilayotganlar" ro'yxatiga tushadi (0046).
 */
export function HolatMaydoni({
  holat, qaytish, sabab, bugun,
}: { holat: StudentStatus; qaytish: string | null; sabab: string | null; bugun: string }) {
  const [h, setH] = useState<StudentStatus>(holat)
  return (
    <div className="flex flex-col gap-3">
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="lbl">Holat</span>
        <select name="holat" value={h} onChange={(e) => setH(e.target.value as StudentStatus)} className={kirishKlass}>
          <option value="faol">Faol</option>
          <option value="tanaffus">Tanaffus (vaqtincha kelmaydi)</option>
          <option value="ketgan">Ketgan</option>
        </select>
        <span className="text-[11.5px] leading-snug text-ink-3">Ketgan — guruhlaridan alohida chiqariladi</span>
      </label>

      {h === 'tanaffus' && (
        <div className="grid gap-3 rounded-[10px] border border-accent-line bg-accent-soft p-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="lbl">Qachon qaytadi</span>
            <input name="qaytish_sana" type="date" min={bugun} defaultValue={qaytish ?? ''} className={kirishKlass} />
            <span className="text-[11.5px] leading-snug text-ink-3">Shu kuni va bir kun oldin dashboard eslatadi</span>
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="lbl">Sabab</span>
            <input name="tanaffus_sabab" list="tanaffus-sabablar" maxLength={120} defaultValue={sabab ?? ''} placeholder="Ta’til, kasallik…" className={kirishKlass} />
            <datalist id="tanaffus-sabablar">
              {SABABLAR.map((s) => <option key={s} value={s} />)}
            </datalist>
          </label>
        </div>
      )}
    </div>
  )
}

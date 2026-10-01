import { Maydon, kirishKlass } from '@/components/forma'

export type ChegirmaQiymati = {
  chegirma_summa?: number
  chegirma_oy?: number | null
  chegirma2_summa?: number
  chegirma2_oy?: number | null
  chegirma_sabab?: string | null
}

/** Bo'sh katak: 0 so'm yoki muddatsiz (null) — formada bo'sh ko'rinadi. */
const qiy = (n: number | null | undefined) => (n ? String(n) : '')

/**
 * Ikki bosqichli chegirma — Qatnashuv varag'idagi F..I ustunlar bilan bir xil.
 *   1-bosqich: N oy yoki doimiy (necha oy bo'sh)
 *   2-bosqich: 1-si tugagach boshlanadi, odatda kamroq; N oy yoki doimiy
 * 1-bosqich doimiy bo'lsa 2-bosqichga navbat kelmaydi.
 */
export function ChegirmaMaydonlari({
  qiymat,
  ochiq = false,
  sarlavha = 'Chegirma (ixtiyoriy)',
}: {
  qiymat?: ChegirmaQiymati
  ochiq?: boolean
  sarlavha?: string
}) {
  return (
    <details open={ochiq} className="rounded-[10px] border border-line px-4 py-3">
      <summary className="cursor-pointer text-[13px] text-ink-2">{sarlavha}</summary>
      <div className="mt-3 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Maydon nom="1-chegirma, oyiga" izoh="50 yoki 50000">
            <input name="chegirma_summa" inputMode="decimal" placeholder="0" defaultValue={qiy(qiymat?.chegirma_summa)} className={kirishKlass} />
          </Maydon>
          <Maydon nom="Necha oy" izoh="bo‘sh — doimiy">
            <input name="chegirma_oy" type="number" min={1} placeholder="doimiy" defaultValue={qiy(qiymat?.chegirma_oy)} className={kirishKlass} />
          </Maydon>
          <Maydon nom="2-chegirma, oyiga" izoh="1-si tugagach">
            <input name="chegirma2_summa" inputMode="decimal" placeholder="0" defaultValue={qiy(qiymat?.chegirma2_summa)} className={kirishKlass} />
          </Maydon>
          <Maydon nom="Necha oy" izoh="bo‘sh — doimiy">
            <input name="chegirma2_oy" type="number" min={1} placeholder="doimiy" defaultValue={qiy(qiymat?.chegirma2_oy)} className={kirishKlass} />
          </Maydon>
        </div>
        <Maydon nom="Sababi">
          <input name="chegirma_sabab" placeholder="Masalan: 600 000 to‘lagan" defaultValue={qiymat?.chegirma_sabab ?? ''} className={kirishKlass} />
        </Maydon>
      </div>
    </details>
  )
}

/** Uchta telefon — botdagi Probniy va O'quvchilar varag'idagi kabi. */
export function TelefonMaydonlari({
  qiymat,
}: {
  qiymat?: { ota_tel?: string | null; ona_tel?: string | null; shaxsiy_tel?: string | null }
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Maydon nom="Shaxsiy telefon">
        <input name="shaxsiy_tel" type="tel" defaultValue={qiymat?.shaxsiy_tel ?? ''} placeholder="90 123 45 67" className={kirishKlass} />
      </Maydon>
      <Maydon nom="Ota telefoni">
        <input name="ota_tel" type="tel" defaultValue={qiymat?.ota_tel ?? ''} placeholder="90 123 45 67" className={kirishKlass} />
      </Maydon>
      <Maydon nom="Ona telefoni">
        <input name="ona_tel" type="tel" defaultValue={qiymat?.ona_tel ?? ''} placeholder="90 123 45 67" className={kirishKlass} />
      </Maydon>
    </div>
  )
}

import { kirishKlass } from '@/components/forma'

export type TanlashOquvchi = { id: string; fish: string }
export type TanlashSinov = { id: string; ism: string }

/**
 * Ota-onaga farzand tanlash (0116/0117): o'quvchilar va sinov darsidagi
 * bolalar bitta ro'yxatda, ikki guruhda. Qiymat: "S:S012" yoki "L:<uuid>".
 */
export function FarzandTanlash({
  oquvchilar,
  sinovdagilar,
  tanlangan,
  majburiy = true,
}: {
  oquvchilar: TanlashOquvchi[]
  sinovdagilar: TanlashSinov[]
  tanlangan?: string
  majburiy?: boolean
}) {
  return (
    <select name="farzand" required={majburiy} defaultValue={tanlangan ?? ''} className={kirishKlass}>
      <option value="" disabled>
        Farzandni tanlang
      </option>
      {oquvchilar.length > 0 && (
        <optgroup label="O‘quvchilar">
          {oquvchilar.map((o) => (
            <option key={o.id} value={`S:${o.id}`}>
              {o.fish} · {o.id}
            </option>
          ))}
        </optgroup>
      )}
      {sinovdagilar.length > 0 && (
        <optgroup label="Sinov darsidagilar">
          {sinovdagilar.map((l) => (
            <option key={l.id} value={`L:${l.id}`}>
              {l.ism} · sinov darsi
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

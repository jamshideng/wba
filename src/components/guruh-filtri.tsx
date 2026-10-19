import Link from 'next/link'
import { JonliForma } from '@/components/jonli-forma'
import { IconSearch } from '@/components/icons'
import { kunlarNomi, vaqt } from '@/lib/format'
import { filtrFaolmi, kunKaliti, type FiltrGuruh, type GuruhSorov } from '@/lib/guruh-filtr'

const selectKlass = 'min-h-11 w-full max-w-full rounded-[9px] border border-line bg-surface px-3 text-[13.5px] text-ink'

/**
 * Guruh filtri (Guruhlar, Davomat). Jonli — yozish/tanlash bilan natija yangilanadi.
 * Variantlar shu ro'yxatdagi guruhlardan olinadi: bitta variant bo'lsa maydon ko'rinmaydi.
 */
export function GuruhFiltri({
  yol,
  guruhlar,
  fanlar,
  s,
  ustozTanlovi,
  holatTanlovi = false,
}: {
  yol: string
  guruhlar: FiltrGuruh[]
  fanlar: { id: string; nom: string }[]
  s: GuruhSorov
  ustozTanlovi: boolean
  holatTanlovi?: boolean
}) {
  const noyob = <T,>(x: T[]) => [...new Set(x)]
  const fanIdlar = noyob(guruhlar.map((g) => g.subject_id).filter((x): x is string => Boolean(x)))
  const fanVariant = fanlar.filter((f) => fanIdlar.includes(f.id))
  const ustozlar = noyob(guruhlar.filter((g) => g.teacher_id).map((g) => `${g.teacher_id}|${g.teachers?.ism ?? g.teacher_id}`))
    .map((x) => x.split('|'))
    .sort((a, b) => a[1].localeCompare(b[1]))
  const kunlar = noyob(guruhlar.map((g) => kunKaliti(g.kunlar)).filter(Boolean)).sort()
  const vaqtlar = noyob(guruhlar.map((g) => (g.boshlanish ?? '').slice(0, 5)).filter(Boolean)).sort()

  return (
    <JonliForma className="flex flex-wrap items-end gap-2.5">
      <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
        <span className="lbl">Qidiruv</span>
        <span className="flex min-h-11 items-center gap-2.5 rounded-[9px] border border-line bg-surface px-3">
          <IconSearch size={15} />
          <input
            name="q"
            type="search"
            defaultValue={s.q ?? ''}
            autoComplete="off"
            placeholder={ustozTanlovi ? 'Guruh, ID yoki ustoz…' : 'Guruh nomi yoki ID…'}
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-4"
          />
        </span>
      </label>

      {fanVariant.length > 1 && (
        <label className="flex min-w-0 max-w-full flex-col gap-1.5">
          <span className="lbl">Fan</span>
          <select name="fan" defaultValue={s.fan ?? ''} className={selectKlass}>
            <option value="">Hammasi</option>
            {fanVariant.map((f) => (
              <option key={f.id} value={f.id}>{f.nom}</option>
            ))}
          </select>
        </label>
      )}

      {ustozTanlovi && ustozlar.length > 1 && (
        <label className="flex min-w-0 max-w-full flex-col gap-1.5">
          <span className="lbl">Ustoz</span>
          <select name="ustoz" defaultValue={s.ustoz ?? ''} className={selectKlass}>
            <option value="">Hammasi</option>
            {ustozlar.map(([id, ism]) => (
              <option key={id} value={id}>{ism}</option>
            ))}
          </select>
        </label>
      )}

      {kunlar.length > 1 && (
        <label className="flex min-w-0 max-w-full flex-col gap-1.5">
          <span className="lbl">Kunlar</span>
          <select name="kun" defaultValue={s.kun ?? ''} className={selectKlass}>
            <option value="">Hammasi</option>
            {kunlar.map((k) => (
              <option key={k} value={k}>{kunlarNomi(k.split(',').map(Number))}</option>
            ))}
          </select>
        </label>
      )}

      {vaqtlar.length > 1 && (
        <label className="flex min-w-0 max-w-full flex-col gap-1.5">
          <span className="lbl">Vaqt</span>
          <select name="vaqt" defaultValue={s.vaqt ?? ''} className={selectKlass}>
            <option value="">Hammasi</option>
            {vaqtlar.map((v) => (
              <option key={v} value={v}>{vaqt(v)}</option>
            ))}
          </select>
        </label>
      )}

      {holatTanlovi && (
        <label className="flex min-w-0 max-w-full flex-col gap-1.5">
          <span className="lbl">Holat</span>
          <select name="holat" defaultValue={s.holat ?? ''} className={selectKlass}>
            <option value="">Hammasi</option>
            <option value="faol">Faol</option>
            <option value="yopilgan">Yopilgan</option>
          </select>
        </label>
      )}

      {filtrFaolmi(s) && (
        <Link href={yol} className="flex min-h-11 items-center px-2 text-[13px] text-ink-3 hover:text-ink">
          Tozalash
        </Link>
      )}
    </JonliForma>
  )
}

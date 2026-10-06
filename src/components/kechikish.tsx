/**
 * Ustozlar kechikishi (0060) — sahifalar orasida umumiy bo'laklar:
 * Ustozlar davomati, Hisobotlar, ustoz sahifasi, "Kechikishlarim".
 */

import { Badge, Empty } from '@/components/ui'

export type KechikishYozuv = {
  id: string
  sheets_id: string | null
  group_id: string | null
  sana: string
  daqiqa: number
  sabab: string | null
  kiritilgan: string | null
  teachers: { ism: string } | null
  groups: { nom: string } | null
}

export const KECHIKISH_USTUNLAR =
  'id, sheets_id, group_id, sana, daqiqa, sabab, kiritilgan, teacher_id, teachers(ism), groups(nom)'

function sanaQisqa(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function vaqtToshkent(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(Date.parse(iso) + 5 * 3600_000).toISOString()
  return `${d.slice(8, 10)}.${d.slice(5, 7)} ${d.slice(11, 16)}`
}

/** Daqiqaga qarab rang: 15 gacha — sariq, undan ko'p — qizil. */
export function DaqiqaBelgi({ daqiqa }: { daqiqa: number }) {
  return (
    <span className="whitespace-nowrap">
      <Badge ton={daqiqa > 15 ? 'brand' : 'accent'}>{daqiqa} daq</Badge>
    </span>
  )
}

export function KechikishJadval({
  royxat,
  ustozsiz = false,
  bosh = 'Bu davrda kechikish yo‘q — demak hamma o‘z vaqtida kelgan.',
  amal,
}: {
  royxat: KechikishYozuv[]
  /** Bitta ustozning sahifasida ustoz ustuni kerak emas */
  ustozsiz?: boolean
  bosh?: string
  /** Ixtiyoriy oxirgi ustun (tahrirlash) */
  amal?: (k: KechikishYozuv) => React.ReactNode
}) {
  if (!royxat.length) return <Empty>{bosh}</Empty>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="text-left">
            <th className="lbl px-2 py-2 font-normal">Sana</th>
            {!ustozsiz && <th className="lbl px-2 py-2 font-normal">Ustoz</th>}
            <th className="lbl px-2 py-2 font-normal">Guruh</th>
            <th className="lbl px-2 py-2 font-normal">Kech</th>
            <th className="lbl px-2 py-2 font-normal">Sabab</th>
            <th className="lbl px-2 py-2 text-right font-normal">Kiritilgan</th>
            {amal && <th className="lbl px-2 py-2 font-normal"><span className="sr-only">Amal</span></th>}
          </tr>
        </thead>
        <tbody>
          {royxat.map((k) => (
            <tr key={k.id} className="border-t border-line-soft">
              <td className="tnum px-2 py-2.5 whitespace-nowrap">{sanaQisqa(k.sana)}</td>
              {!ustozsiz && <td className="px-2 py-2.5 font-semibold whitespace-nowrap">{k.teachers?.ism ?? '—'}</td>}
              <td className="max-w-[260px] truncate px-2 py-2.5 text-ink-2" title={k.groups?.nom ?? ''}>{k.groups?.nom ?? '—'}</td>
              <td className="px-2 py-2.5"><DaqiqaBelgi daqiqa={k.daqiqa} /></td>
              <td className="px-2 py-2.5 text-ink-3">{k.sabab ?? '—'}</td>
              <td className="tnum px-2 py-2.5 text-right font-[family-name:var(--font-mono)] text-[11.5px] whitespace-nowrap text-ink-3">
                {vaqtToshkent(k.kiritilgan)}
                <span className="block text-[10px] text-ink-4">{k.sheets_id ? `Sheets · ${k.sheets_id}` : 'saytda'}</span>
              </td>
              {amal && <td className="px-2 py-2.5 text-right">{amal(k)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Ustozlar bo'yicha jamlanma: necha marta, jami va eng ko'p daqiqa. */
export function KechikishJamlanma({ royxat }: { royxat: KechikishYozuv[] }) {
  const jam = new Map<string, { ism: string; soni: number; daqiqa: number; eng: number }>()
  for (const k of royxat) {
    const ism = k.teachers?.ism ?? '—'
    const x = jam.get(ism) ?? { ism, soni: 0, daqiqa: 0, eng: 0 }
    x.soni++
    x.daqiqa += k.daqiqa
    x.eng = Math.max(x.eng, k.daqiqa)
    jam.set(ism, x)
  }
  const qatorlar = [...jam.values()].sort((a, b) => b.daqiqa - a.daqiqa)
  if (!qatorlar.length) return <Empty>Kechikkan ustoz yo‘q.</Empty>
  const max = Math.max(...qatorlar.map((q) => q.daqiqa))
  return (
    <ul className="flex flex-col">
      {qatorlar.map((q) => (
        <li key={q.ism} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-3 border-b border-line-soft py-2 last:border-0">
          <span className="truncate text-[13px] font-semibold">{q.ism}</span>
          <span className="h-3 overflow-hidden rounded-[4px] bg-surface-2">
            <span className="block h-3 rounded-[4px] bg-brand" style={{ width: `${(q.daqiqa / max) * 100}%` }} />
          </span>
          <span className="tnum text-right font-[family-name:var(--font-mono)] text-[12px] whitespace-nowrap text-ink-2">
            {q.soni} marta · {q.daqiqa} daq
          </span>
        </li>
      ))}
    </ul>
  )
}

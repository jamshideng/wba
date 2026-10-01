import Link from 'next/link'
import { Card } from '@/components/ui'
import { bosh, sanaQisqa, telefon } from '@/lib/format'

export type Tanaffusdagi = {
  id: string
  fish: string
  qaytish_sana: string | null
  tanaffus_sabab: string | null
  ota_tel: string | null
  ona_tel: string | null
  shaxsiy_tel: string | null
}

/** Qaytishga necha kun: 0 — bugun, manfiy — o'tib ketgan */
function kunFarqi(sana: string, bugun: string) {
  return Math.round((Date.parse(`${sana}T00:00:00Z`) - Date.parse(`${bugun}T00:00:00Z`)) / 86_400_000)
}

function Qachon({ sana, bugun }: { sana: string | null; bugun: string }) {
  if (!sana) return <span className="text-[12px] text-ink-3">sana aytilmagan</span>
  const d = kunFarqi(sana, bugun)
  const [matn, ton] =
    d < 0 ? [`${-d} kun o‘tdi`, 'text-brand'] :
    d === 0 ? ['bugun', 'text-ok'] :
    d === 1 ? ['ertaga', 'text-accent'] :
    [`${d} kundan keyin`, 'text-ink-2']
  return (
    <span className="flex flex-col items-end gap-0.5">
      <span className={`text-[13.5px] font-bold ${ton}`}>{matn}</span>
      <span className="tnum font-[family-name:var(--font-mono)] text-[10.5px] text-ink-3">{sanaQisqa(sana)}</span>
    </span>
  )
}

/**
 * "Qaytishi kutilmoqda" (LevelUp "Ожидают возврата" g'oyasi, 0046).
 * Tanaffusdagi o'quvchilar qaytish sanasi bo'yicha; bugun/ertaga
 * qaytadiganlar va muddati o'tganlar yuqorida — admin qo'ng'iroq qiladi.
 */
export function QaytishKutilmoqda({ royxat, jami, bugun }: { royxat: Tanaffusdagi[]; jami: number; bugun: string }) {
  const yaqin = royxat.filter((o) => o.qaytish_sana && kunFarqi(o.qaytish_sana, bugun) <= 1).length
  return (
    <Card className="flex flex-col overflow-hidden border-accent-line!">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-accent-soft px-5 py-3.5">
        <span className="flex flex-col gap-0.5">
          <span className="lbl text-accent!">Qaytishi kutilmoqda</span>
          <span className="text-[15px] font-bold text-ink">
            {jami} o‘quvchi tanaffusda{yaqin ? ` · ${yaqin} tasi bugun-ertaga qaytadi` : ''}
          </span>
        </span>
        <span className="text-[11.5px] text-ink-3">qaytishidan bir kun oldin va o‘sha kuni qo‘ng‘iroq qiling</span>
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {royxat.map((o) => {
          const tel = o.ota_tel ?? o.ona_tel ?? o.shaxsiy_tel
          return (
            <li key={o.id} className="flex items-center gap-3 px-5 py-3">
              <span className="grid grid-cols-1 size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-[11.5px] font-bold text-accent">
                {bosh(o.fish)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Link href={`/crm/oquvchilar/${o.id}`} className="truncate text-[13.5px] font-semibold hover:text-brand">{o.fish}</Link>
                <span className="truncate text-[12px] text-ink-3">
                  {o.tanaffus_sabab ?? 'sabab yozilmagan'}
                  {tel && (
                    <>
                      {' · '}
                      <a href={`tel:${tel}`} className="tnum text-ink-2 hover:text-brand">{telefon(tel)}</a>
                    </>
                  )}
                </span>
              </span>
              <Qachon sana={o.qaytish_sana} bugun={bugun} />
            </li>
          )
        })}
      </ul>
      {jami > royxat.length && (
        <Link href="/crm/oquvchilar?holat=tanaffus" className="border-t border-line px-5 py-2.5 text-center text-[12.5px] text-accent hover:text-brand">
          Hammasi ({jami}) →
        </Link>
      )}
    </Card>
  )
}

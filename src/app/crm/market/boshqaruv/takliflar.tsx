import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, Badge, Empty } from '@/components/ui'
import { kirishKlass } from '@/components/forma'
import { Yuborish } from '@/components/yuborish'
import { TAKLIF_HOLATLARI, TAKLIF_HOLAT_NOMI, TAKLIF_HOLAT_TONI, sanaVaqt, type Taklif, type TaklifHolati } from '@/lib/market'
import { taklifHolati } from '../actions'

/**
 * Admin: o'quvchi takliflari (0065). Holat: Yangi → Ko'rib chiqamiz →
 * Siz uchun olib kelindi / Rad etildi. Holat o'zgarsa o'quvchiga Telegram xabari.
 * "Mahsulot qilish" — yangi mahsulot formasi taklifdan to'ldiriladi.
 */
export async function TakliflarBolimi({ holat, admin }: { holat?: string; admin: boolean }) {
  const tanlov = TAKLIF_HOLATLARI.find((h) => h === holat) ?? null
  const supabase = await createClient()
  let soorov = supabase.from('woblr_takliflar').select('*').order('created_at', { ascending: false }).limit(200)
  if (tanlov) soorov = soorov.eq('holat', tanlov)
  const { data } = await soorov
  const royxat = (data ?? []) as Taklif[]

  const idlar = [...new Set(royxat.map((t) => t.student_id))]
  const { data: oquvchilar } = idlar.length
    ? await supabase.from('students').select('id, fish').in('id', idlar)
    : { data: [] }
  const ism = new Map((oquvchilar ?? []).map((o) => [o.id as string, o.fish as string]))
  const yol = `/crm/market/boshqaruv?bolim=taklif${tanlov ? `&holat=${tanlov}` : ''}`

  return (
    <>
      <nav aria-label="Taklif holati" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {([null, ...TAKLIF_HOLATLARI] as (TaklifHolati | null)[]).map((h) => (
          <Link
            key={h ?? 'hammasi'}
            href={`/crm/market/boshqaruv?bolim=taklif${h ? `&holat=${h}` : ''}`}
            aria-current={tanlov === h ? 'page' : undefined}
            className={`flex min-h-11 shrink-0 items-center rounded-[10px] px-3.5 text-[13px] font-semibold transition ${
              tanlov === h ? 'bg-ink text-bg' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
            }`}
          >
            {h ? TAKLIF_HOLAT_NOMI[h] : 'Hammasi'}
          </Link>
        ))}
      </nav>

      {royxat.length === 0 ? (
        <Card className="p-5"><Empty>{tanlov ? 'Bu holatda taklif yo‘q.' : 'Hali taklif yo‘q.'}</Empty></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {royxat.map((t) => (
            <Card key={t.id} className="flex flex-col gap-3 p-4">
              <div className="flex gap-3">
                {t.rasm_url ? (
                  <a href={t.rasm_url} target="_blank" rel="noreferrer" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.rasm_url} alt={t.nom} className="size-20 rounded-[10px] border border-line object-cover" />
                  </a>
                ) : (
                  <span className="flex size-20 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-[11px] text-ink-4">rasm yo‘q</span>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[14.5px] font-bold">{t.nom}</span>
                    <Badge ton={TAKLIF_HOLAT_TONI[t.holat]} nuqta>{TAKLIF_HOLAT_NOMI[t.holat]}</Badge>
                  </div>
                  <span className="text-[12px] text-ink-3">
                    <Link href={`/crm/oquvchilar/${t.student_id}`} className="font-semibold text-ink-2 hover:text-brand">{ism.get(t.student_id) ?? t.student_id}</Link>
                    {' · '}{t.qachon === 'keyingi_bozor' ? 'keyingi bozorga' : 'umumiy'} · {sanaVaqt(t.created_at)}
                    {t.taxminiy_narx ? ` · ~${t.taxminiy_narx} woblar` : ''}
                  </span>
                  {t.tavsif && <p className="text-[13px] leading-relaxed whitespace-pre-line text-ink-2">{t.tavsif}</p>}
                  {t.izoh && <p className="text-[12.5px] text-ink-3">Izoh: {t.izoh}</p>}
                  {t.havola && (
                    <a href={t.havola} target="_blank" rel="noreferrer nofollow" className="truncate text-[12.5px] text-accent underline underline-offset-2">
                      {t.havola}
                    </a>
                  )}
                </div>
              </div>

              <form action={taklifHolati} className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="qaytish" value={yol} />
                <label className="flex flex-col gap-1">
                  <span className="lbl">Holat</span>
                  <select name="holat" defaultValue={t.holat} className={kirishKlass}>
                    {TAKLIF_HOLATLARI.map((h) => (
                      <option key={h} value={h}>{TAKLIF_HOLAT_NOMI[h]}</option>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-40 flex-1 flex-col gap-1">
                  <span className="lbl">O‘quvchiga javob</span>
                  <input name="admin_javob" maxLength={500} defaultValue={t.admin_javob ?? ''} placeholder="Ixtiyoriy" className={kirishKlass} />
                </label>
                <Yuborish tur="ikkilamchi">Saqlash</Yuborish>
                {admin && (
                  <Link
                    href={`/crm/market/boshqaruv/mahsulot/yangi?taklif=${t.id}`}
                    className="flex min-h-11 items-center rounded-[10px] border border-line px-3.5 text-[13px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink"
                  >
                    Mahsulot qilish
                  </Link>
                )}
              </form>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

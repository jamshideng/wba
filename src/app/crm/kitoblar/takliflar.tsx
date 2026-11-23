import { createClient } from '@/lib/supabase/server'
import { Card, Empty, Badge } from '@/components/ui'
import { kirishKlass } from '@/components/forma'
import { bugunToshkent } from '@/lib/format'
import type { KitobTaklif, KitobTaklifHolati } from '@/lib/types'
import { taklifBekor, taklifHolati, taklifKeldi } from './taklif-actions'
import { TaklifForma } from './taklif-forma'

/*
 * 0144 — ustoz kitob takliflari.
 * Rahbariyat: ochiq takliflar bir xil kitob (nom + fan) bo'yicha guruhlanadi;
 * guruhda belgilanganlarga bittada "Buyurtma qilindi" / "Rad etish" / "Keldi".
 * Ustoz: o'z takliflari, "Yangi"da tahrir va bekor.
 */

const HOLAT: Record<KitobTaklifHolati, { nom: string; ton: 'ok' | 'accent' | 'jim' | 'brand' }> = {
  yangi: { nom: 'Yangi', ton: 'accent' },
  buyurtma_qilindi: { nom: 'Buyurtma qilindi', ton: 'brand' },
  keldi: { nom: 'Keldi', ton: 'ok' },
  rad_etildi: { nom: 'Rad etildi', ton: 'jim' },
  bekor_qilindi: { nom: 'Bekor qilindi', ton: 'jim' },
}
const OCHIQ: KitobTaklifHolati[] = ['yangi', 'buyurtma_qilindi']

const TUGMA = 'inline-flex min-h-11 items-center justify-center rounded-[10px] px-4 text-[13px] font-semibold transition'

function vaqt(iso: string) {
  return new Date(iso).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function Muqova({ url, katta = false }: { url: string; katta?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Supabase storage muqovasi
    <img src={url} alt="Muqova" loading="lazy" className={`${katta ? 'h-28 w-20' : 'h-16 w-12'} shrink-0 rounded-md border border-line object-cover`} />
  )
}

/* ------------------------------------------------------------ */
/* Rahbariyat                                                    */
/* ------------------------------------------------------------ */

export async function TakliflarTab({ fanlar, katalog }: { fanlar: { id: string; nom: string }[]; katalog: { id: string; nom: string }[] }) {
  const supabase = await createClient()
  const [{ data }, { data: ustozlar }] = await Promise.all([
    supabase.from('kitob_takliflar').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('teachers').select('id, ism'),
  ])
  const ro = (data ?? []) as KitobTaklif[]
  const ustoz = new Map((ustozlar ?? []).map((u) => [u.id as string, u.ism as string]))
  const fanNomi = new Map(fanlar.map((f) => [f.id, f.nom]))
  const kimIdlar = [...new Set(ro.map((t) => t.ozgartirdi).filter((x): x is string => !!x))]
  const { data: kimlar } = kimIdlar.length ? await supabase.from('profiles').select('id, ism').in('id', kimIdlar) : { data: [] }
  const kim = new Map((kimlar ?? []).map((k) => [k.id as string, k.ism as string]))

  // Ochiq takliflar — bir xil kitob bo'yicha guruh (eng eskisi birinchi)
  const guruhlar = new Map<string, KitobTaklif[]>()
  for (const t of [...ro].reverse()) {
    if (!OCHIQ.includes(t.holat)) continue
    const l = guruhlar.get(t.kalit) ?? []
    l.push(t)
    guruhlar.set(t.kalit, l)
  }
  const yopiq = ro.filter((t) => !OCHIQ.includes(t.holat))

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="lbl">Ochiq takliflar ({guruhlar.size} kitob)</h2>
        {guruhlar.size === 0 ? (
          <Card className="p-6"><Empty>Ochiq taklif yo‘q.</Empty></Card>
        ) : (
          [...guruhlar.values()].map((g) => {
            const bosh = g[0]
            const jami = g.reduce((a, t) => a + t.soni, 0)
            return (
              <Card key={bosh.kalit} className="p-4">
                <form className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <Muqova url={bosh.rasm_url} katta />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-[15px] font-semibold">{bosh.nom}</span>
                      <span className="text-[12px] text-ink-3">
                        {fanNomi.get(bosh.subject_id) ?? bosh.subject_id} · {g.length} ta taklif · jami {jami} dona
                      </span>
                      <ul className="mt-1 flex flex-col gap-1.5">
                        {g.map((t) => (
                          <li key={t.id}>
                            <label className="flex cursor-pointer items-start gap-2.5 rounded-[9px] border border-line px-3 py-2 text-[13px] hover:bg-surface-2">
                              <input type="checkbox" name="id" value={t.id} defaultChecked className="mt-0.5 size-4.5 shrink-0" />
                              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="font-semibold">
                                  {ustoz.get(t.teacher_id) ?? t.teacher_id} — {t.soni} ta
                                  <span className="ml-2 align-middle"><Badge ton={HOLAT[t.holat].ton}>{HOLAT[t.holat].nom}</Badge></span>
                                </span>
                                <span className="text-ink-2">{t.sabab}</span>
                                <span className="text-[11.5px] text-ink-3">
                                  {vaqt(t.created_at)}
                                  {t.nom !== bosh.nom ? ` · “${t.nom}”` : ''}
                                  {t.javob ? ` · Izoh: ${t.javob}` : ''}
                                </span>
                                {t.havola && (
                                  <a href={t.havola} target="_blank" rel="noopener noreferrer nofollow" className="w-fit text-[12px] text-brand underline">
                                    Havola
                                  </a>
                                )}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <input name="javob" maxLength={500} placeholder="Ustozlarga izoh (rad etishda — sabab, majburiy)" className={kirishKlass} />
                  <div className="flex flex-wrap gap-2">
                    {g.some((t) => t.holat === 'yangi') && (
                      <button type="submit" formAction={taklifHolati} name="holat" value="buyurtma_qilindi" className={`${TUGMA} bg-brand text-white hover:opacity-90`}>
                        Buyurtma qilindi
                      </button>
                    )}
                    <button type="submit" formAction={taklifHolati} name="holat" value="rad_etildi" className={`${TUGMA} border border-line bg-surface text-ink-2 hover:text-crit`}>
                      Rad etish
                    </button>
                  </div>

                  <details className="rounded-[10px] border border-line p-3 text-[13px]">
                    <summary className="min-h-11 cursor-pointer content-center font-semibold">Keldi — katalogga qo‘shish</summary>
                    <div className="mt-2 flex flex-col gap-2.5">
                      <label className="flex flex-col gap-1">
                        <span className="lbl">Katalogga</span>
                        <select name="kitob" className={kirishKlass} defaultValue="">
                          <option value="">Yangi kitob sifatida qo‘shish</option>
                          {katalog.map((k) => <option key={k.id} value={k.id}>Mavjudiga bog‘lash: {k.nom}</option>)}
                        </select>
                      </label>
                      <div className="flex flex-wrap gap-2.5">
                        <label className="flex min-w-56 flex-1 flex-col gap-1">
                          <span className="lbl">Nomi (yangi kitob uchun)</span>
                          <input name="nom" maxLength={200} defaultValue={bosh.nom} className={kirishKlass} />
                        </label>
                        <label className="flex min-w-44 flex-col gap-1">
                          <span className="lbl">Fan</span>
                          <select name="fan" className={kirishKlass} defaultValue={bosh.subject_id}>
                            {fanlar.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                          </select>
                        </label>
                      </div>
                      <label className="flex min-h-11 items-center gap-2.5">
                        <input type="checkbox" name="kirim" value="ha" defaultChecked className="size-4.5" />
                        Darhol kirim ham qilish
                      </label>
                      <div className="flex flex-wrap gap-2.5">
                        <label className="flex w-32 flex-col gap-1">
                          <span className="lbl">Kirim soni</span>
                          <input type="number" name="kirim_soni" min={1} max={10000} defaultValue={jami} className={`${kirishKlass} tnum`} />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="lbl">Sana</span>
                          <input type="date" name="kirim_sana" defaultValue={bugunToshkent()} className={kirishKlass} />
                        </label>
                      </div>
                      <p className="text-[12px] text-ink-3">Nom, fan va muqova katalogga o‘tadi; belgilangan takliflar “Keldi” bo‘ladi, ustozlar xabar oladi.</p>
                      <div>
                        <button type="submit" formAction={taklifKeldi} className={`${TUGMA} bg-ok text-white hover:opacity-90`}>
                          Keldi — katalogga qo‘shish
                        </button>
                      </div>
                    </div>
                  </details>
                </form>
              </Card>
            )
          })
        )}
      </section>

      {yopiq.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="lbl">Tarix</h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {yopiq.map((t) => (
                <li key={t.id} className="flex items-start gap-3 px-4 py-3 text-[13px]">
                  <Muqova url={t.rasm_url} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold">{t.nom} — {t.soni} ta</span>
                    <span className="text-[11.5px] text-ink-3">
                      {ustoz.get(t.teacher_id) ?? t.teacher_id} · {fanNomi.get(t.subject_id) ?? t.subject_id} · {vaqt(t.created_at)}
                    </span>
                    {t.javob && <span className="text-[12px] text-ink-2">Sabab/izoh: {t.javob}</span>}
                    {t.ozgartirish_vaqt && (
                      <span className="text-[11.5px] text-ink-3">{t.ozgartirdi ? `${kim.get(t.ozgartirdi) ?? '—'}, ` : ''}{vaqt(t.ozgartirish_vaqt)}</span>
                    )}
                  </span>
                  <Badge ton={HOLAT[t.holat].ton}>{HOLAT[t.holat].nom}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </>
  )
}

/* ------------------------------------------------------------ */
/* Ustoz                                                         */
/* ------------------------------------------------------------ */

export async function TakliflarimTab({ uid, ustozId, fanlar }: { uid: string; ustozId: string; fanlar: { id: string; nom: string }[] }) {
  const supabase = await createClient()
  // RLS: ustozga faqat o'z takliflari; ikki rolli xodimda RLS hammasini ochadi — shuning uchun aniq filtr
  const { data } = await supabase.from('kitob_takliflar').select('*').eq('teacher_id', ustozId).order('created_at', { ascending: false }).limit(100)
  const ro = (data ?? []) as KitobTaklif[]
  const fanNomi = new Map(fanlar.map((f) => [f.id, f.nom]))

  return (
    <>
      <Card className="flex flex-col gap-2 p-4">
        <h2 className="lbl">Katalogda yo‘q kitobni taklif qiling</h2>
        <TaklifForma uid={uid} fanlar={fanlar} />
      </Card>
      {ro.length === 0 ? (
        <Card className="p-6"><Empty>Hali taklif yo‘q.</Empty></Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {ro.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 px-4 py-3 text-[13px]">
                <div className="flex items-start gap-3">
                  <Muqova url={t.rasm_url} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold">{t.nom} — {t.soni} ta</span>
                    <span className="text-[11.5px] text-ink-3">{fanNomi.get(t.subject_id) ?? t.subject_id} · {vaqt(t.created_at)}</span>
                    <span className="text-ink-2">{t.sabab}</span>
                    {t.javob && <span className="text-[12px] text-ink-2">Izoh: {t.javob}</span>}
                  </span>
                  <Badge ton={HOLAT[t.holat].ton}>{HOLAT[t.holat].nom}</Badge>
                </div>
                {t.holat === 'yangi' && (
                  <>
                    <details className="text-[12.5px]">
                      <summary className="min-h-11 cursor-pointer content-center text-ink-3">Tahrirlash</summary>
                      <div className="mt-2">
                        <TaklifForma
                          uid={uid}
                          fanlar={fanlar}
                          qiymat={{ id: t.id, nom: t.nom, subject_id: t.subject_id, soni: t.soni, sabab: t.sabab, rasm_url: t.rasm_url, havola: t.havola }}
                        />
                      </div>
                    </details>
                    <details className="text-[12.5px]">
                      <summary className="min-h-11 cursor-pointer content-center text-ink-3">Bekor qilish</summary>
                      <form action={taklifBekor} className="mt-2 flex flex-wrap gap-2">
                        <input type="hidden" name="id" value={t.id} />
                        <input name="sabab" maxLength={300} placeholder="Sabab (ixtiyoriy)" className={`${kirishKlass} max-w-sm flex-1`} />
                        <button type="submit" className={`${TUGMA} border border-line bg-surface text-ink-2 hover:text-crit`}>Bekor qilish</button>
                      </form>
                    </details>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
